from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, UploadFile, File
from typing import Dict, Any, Optional, Set, List
import asyncio
from pathlib import Path
from PIL import Image
from io import BytesIO
import uuid
import logging
import wave
import re
from pymediainfo import MediaInfo

logger = logging.getLogger(__name__)

from models.schemas import (
    Project, GenerateImagesRequest, GenerateAudiosRequest,
    GenerationStatus, GenerationStatusResponse,
    SplitStoryboardRequest, GeneratePromptsRequest, GeneratePromptsResponse,
    SubtitleSegment, TextSegment, AudioClip, ProjectType
)
from core.storage import storage
from core.llm import LLMClient
from core.comfyui import ComfyUIClient
from core.tts import TTSClient
from config import settings

router = APIRouter(prefix="/api", tags=["generation"])

generation_tasks: Dict[str, Dict[str, Any]] = {}
active_generations: Set[str] = set()

_comfyui_semaphore = asyncio.Semaphore(settings.comfyui_concurrent_limit)
_tts_semaphore = asyncio.Semaphore(settings.tts_concurrent_limit)

async def generate_single_image(project_id: str, sb_id: str):
    key = f"{project_id}:{sb_id}"
    if key in active_generations:
        return
    active_generations.add(key)

    try:
        async with _comfyui_semaphore:
            project = storage.load_project(project_id)
            if not project:
                return

            storyboard = None
            sb_index = 0
            for idx, sb in enumerate(project.storyboards):
                if sb.id == sb_id:
                    storyboard = sb
                    sb_index = idx
                    break

            if not storyboard:
                return

            storyboard.imageStatus = GenerationStatus.GENERATING
            storage.save_project(project)

            char_map = {c.id: c for c in project.characters}
            characters = [char_map[cid] for cid in storyboard.characterIds if cid in char_map]

            if not storyboard.imagePrompt:
                settings_obj = storage.load_global_settings()
                llm_client = LLMClient(settings_obj)
                surrounding_sbs = _get_surrounding_storyboards(project.storyboards, sb_index)
                storyboard.imagePrompt = await llm_client.generate_image_prompt_enhanced(
                    storyboard,
                    project,
                    surrounding_sbs,
                    global_settings=settings_obj
                )

            full_prompt = storyboard.imagePrompt
            for char in characters:
                if char.characterPrompt:
                    full_prompt = f"{char.characterPrompt}, {full_prompt}"

            negative_prompt = storyboard.negativePrompt or project.negativePrompt
            for char in characters:
                if char.negativePrompt:
                    negative_prompt = f"{negative_prompt}, {char.negativePrompt}"

            comfy_client = ComfyUIClient()
            img_data = await comfy_client.generate_image(
                prompt=full_prompt,
                negative_prompt=negative_prompt,
                width=1024,
                height=1024
            )

            proj_dir = Path(settings.data_dir) / "projects" / project_id
            img_path = proj_dir / "images" / f"sb-{storyboard.index:03d}.png"

            img = Image.open(BytesIO(img_data))
            img.save(img_path, "PNG")

            storyboard.imagePath = f"images/sb-{storyboard.index:03d}.png"
            storyboard.imageStatus = GenerationStatus.COMPLETED
            storyboard.imageError = None

            project.generationProgress.imagesCompleted += 1
            storage.save_project(project)

    except Exception as e:
        project = storage.load_project(project_id)
        if project:
            for sb in project.storyboards:
                if sb.id == sb_id:
                    sb.imageStatus = GenerationStatus.FAILED
                    sb.imageError = str(e)
            storage.save_project(project)
    finally:
        active_generations.discard(key)

async def generate_single_audio(project_id: str, sb_id: str):
    key = f"{project_id}:{sb_id}:audio"
    if key in active_generations:
        return
    active_generations.add(key)

    try:
        async with _tts_semaphore:
            project = storage.load_project(project_id)
            if not project:
                return

            storyboard = None
            for sb in project.storyboards:
                if sb.id == sb_id:
                    storyboard = sb
                    break

            if not storyboard:
                return

            text = storyboard.narration or storyboard.dialogue or storyboard.sceneDescription
            if not text or not text.strip():
                storyboard.audioStatus = GenerationStatus.COMPLETED
                storyboard.audioDuration = 0
                storage.save_project(project)
                return

            storyboard.audioStatus = GenerationStatus.GENERATING
            storage.save_project(project)

            settings_obj = storage.load_global_settings()
            tts_client = TTSClient(settings_obj)

            # 获取 TTS 配置：优先使用分镜独立配置，其次使用角色配置
            tts_config = None
            if hasattr(storyboard, 'ttsConfig') and storyboard.ttsConfig:
                tts_config = storyboard.ttsConfig
            elif storyboard.characterIds:
                char_map = {c.id: c for c in project.characters}
                for char_id in storyboard.characterIds:
                    if char_id in char_map:
                        char = char_map[char_id]
                        if hasattr(char, 'ttsConfig') and char.ttsConfig:
                            tts_config = char.ttsConfig
                            break

            audio_data, duration = await tts_client.synthesize(text, tts_config=tts_config)

            proj_dir = Path(settings.data_dir) / "projects" / project_id
            audio_path = proj_dir / "audio" / f"sb-{storyboard.index:03d}.wav"

            with open(audio_path, "wb") as f:
                f.write(audio_data)

            storyboard.audioPath = f"audio/sb-{storyboard.index:03d}.wav"
            storyboard.audioDuration = duration
            storyboard.audioStatus = GenerationStatus.COMPLETED
            storyboard.audioError = None

            project.generationProgress.audioCompleted += 1
            storage.save_project(project)

    except Exception as e:
        project = storage.load_project(project_id)
        if project:
            for sb in project.storyboards:
                if sb.id == sb_id:
                    sb.audioStatus = GenerationStatus.FAILED
                    sb.audioError = str(e)
            storage.save_project(project)
    finally:
        active_generations.discard(key)

@router.post("/projects/{project_id}/characters/extract")
async def extract_characters(project_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.sourceText or not project.sourceText.strip():
        raise HTTPException(status_code=400, detail="No source text available")

    settings_obj = storage.load_global_settings()
    llm_client = LLMClient(settings_obj)

    try:
        char_dicts = await llm_client.extract_characters(
            project.sourceText,
            project=project,
            global_settings=settings_obj
        )

        if char_dicts:
            from models.schemas import Character
            for char_dict in char_dicts:
                char = Character(
                    name=char_dict.get("name", ""),
                    description=char_dict.get("description", ""),
                    characterPrompt=f"{char_dict.get('description', '')}, {char_dict.get('personality', '')}"
                )
                project.characters.append(char)

        storage.save_project(project)
        return {"characters": project.characters, "charactersExtracted": len(char_dicts)}
    except Exception as e:
        logger.error(f"Failed to extract characters: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract characters: {str(e)}")

def _auto_associate_scene(scene_description: str, scenes: list) -> Optional[str]:
    """自动关联场景 - 简单的关键词匹配逻辑"""
    if not scenes:
        return None

    scene_desc_lower = scene_description.lower()
    for scene in scenes:
        if scene.name.lower() in scene_desc_lower or scene.description.lower() in scene_desc_lower:
            return scene.id
    return None


def _auto_associate_characters(scene_description: str, characters: list) -> list:
    """自动关联角色 - 简单的关键词匹配逻辑"""
    if not characters:
        return []

    char_ids = []
    scene_desc_lower = scene_description.lower()
    for char in characters:
        if char.name.lower() in scene_desc_lower:
            char_ids.append(char.id)
    return char_ids


def _get_surrounding_storyboards(storyboards: list, current_index: int, context_count: int = 5) -> list:
    """获取前后指定数量的分镜"""
    start = max(0, current_index - context_count)
    end = min(len(storyboards), current_index + context_count + 1)
    return storyboards[start:end]


async def _generate_prompts_for_project(project: Project):
    """为项目的所有分镜生成画图提示词（增强版）"""
    try:
        settings_obj = storage.load_global_settings()
        llm_client = LLMClient(settings_obj)

        for idx, sb in enumerate(project.storyboards):
            if not sb.imagePrompt:
                try:
                    surrounding_sbs = _get_surrounding_storyboards(project.storyboards, idx)
                    sb.imagePrompt = await llm_client.generate_image_prompt_enhanced(
                        sb,
                        project,
                        surrounding_sbs,
                        global_settings=settings_obj
                    )
                except Exception as e:
                    logger.error(f"Failed to generate prompt for storyboard {sb.id}: {e}")

        storage.save_project(project)
    except Exception as e:
        logger.error(f"Failed to generate prompts: {e}")


@router.post("/projects/{project_id}/storyboards/split")
async def split_storyboard(project_id: str, request: SplitStoryboardRequest):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.sourceText or not project.sourceText.strip():
        raise HTTPException(status_code=400, detail="No source text available")

    # 按行分割文本
    lines = project.sourceText.split('\n')
    current_lines = []
    current_index = len(project.storyboards)

    from models.schemas import Storyboard

    for line in lines:
        line = line.strip()
        if not line:
            continue  # 跳过空行

        current_lines.append(line)

        if len(current_lines) >= request.lines_per_storyboard:
            # 凑够指定行数，创建分镜
            scene_desc = "\n".join(current_lines)
            storyboard = Storyboard(
                index=current_index,
                sceneDescription=scene_desc,
                dialogue="",
                narration="",
                characterIds=_auto_associate_characters(scene_desc, project.characters),
                sceneId=_auto_associate_scene(scene_desc, project.scenes)
            )
            project.storyboards.append(storyboard)
            current_lines = []
            current_index += 1

    # 处理剩余的行
    if current_lines:
        scene_desc = "\n".join(current_lines)
        storyboard = Storyboard(
            index=current_index,
            sceneDescription=scene_desc,
            dialogue="",
            narration="",
            characterIds=_auto_associate_characters(scene_desc, project.characters),
            sceneId=_auto_associate_scene(scene_desc, project.scenes)
        )
        project.storyboards.append(storyboard)

    project.generationProgress.imagesTotal = len(project.storyboards)
    project.generationProgress.audioTotal = len(project.storyboards)
    storage.save_project(project)

    # 自动批量生成提示词
    await _generate_prompts_for_project(project)

    return {"storyboards": project.storyboards}

@router.post("/projects/{project_id}/generate/image")
async def generate_image(
    project_id: str,
    storyboard_id: str = Query(..., description="Storyboard ID to generate"),
    background_tasks: BackgroundTasks = None
):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if background_tasks:
        background_tasks.add_task(generate_single_image, project_id, storyboard_id)
    return {"status": "queued"}

@router.post("/projects/{project_id}/generate/images")
async def generate_images(project_id: str, request: GenerateImagesRequest, background_tasks: BackgroundTasks):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    target_sb_ids = request.storyboardIds or [sb.id for sb in project.storyboards]

    to_generate = []
    for sb in project.storyboards:
        if sb.id in target_sb_ids:
            if request.forceRegenerate or sb.imageStatus in [GenerationStatus.PENDING, GenerationStatus.FAILED]:
                to_generate.append(sb.id)

    project.generationProgress.imagesTotal = len(target_sb_ids)
    project.generationProgress.imagesCompleted = len([
        sb for sb in project.storyboards if sb.imageStatus == GenerationStatus.COMPLETED and sb.id not in to_generate
    ])
    storage.save_project(project)

    for sb_id in to_generate:
        background_tasks.add_task(generate_single_image, project_id, sb_id)

    return {"status": "queued", "count": len(to_generate)}

@router.post("/projects/{project_id}/generate/audio")
async def generate_audio(
    project_id: str,
    storyboard_id: str = Query(..., description="Storyboard ID to generate"),
    background_tasks: BackgroundTasks = None
):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if background_tasks:
        background_tasks.add_task(generate_single_audio, project_id, storyboard_id)
    return {"status": "queued"}

@router.post("/projects/{project_id}/generate/audios")
async def generate_audios(project_id: str, request: GenerateAudiosRequest, background_tasks: BackgroundTasks):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    target_sb_ids = request.storyboardIds or [sb.id for sb in project.storyboards]

    to_generate = []
    for sb in project.storyboards:
        if sb.id in target_sb_ids:
            if request.forceRegenerate or sb.audioStatus in [GenerationStatus.PENDING, GenerationStatus.FAILED]:
                to_generate.append(sb.id)

    project.generationProgress.audioTotal = len(target_sb_ids)
    project.generationProgress.audioCompleted = len([
        sb for sb in project.storyboards if sb.audioStatus == GenerationStatus.COMPLETED and sb.id not in to_generate
    ])
    storage.save_project(project)

    for sb_id in to_generate:
        background_tasks.add_task(generate_single_audio, project_id, sb_id)

    return {"status": "queued", "count": len(to_generate)}

@router.post("/projects/{project_id}/storyboards/generate-prompts", response_model=GeneratePromptsResponse)
async def generate_storyboard_prompts(project_id: str, request: GeneratePromptsRequest):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    settings_obj = storage.load_global_settings()
    llm_client = LLMClient(settings_obj)

    target_sbs = project.storyboards
    if request.storyboardIds:
        target_sbs = [sb for sb in project.storyboards if sb.id in request.storyboardIds]

    updated_count = 0
    for target_sb in target_sbs:
        try:
            sb_index = next((i for i, sb in enumerate(project.storyboards) if sb.id == target_sb.id), 0)
            surrounding_sbs = _get_surrounding_storyboards(project.storyboards, sb_index)
            target_sb.imagePrompt = await llm_client.generate_image_prompt_enhanced(
                target_sb,
                project,
                surrounding_sbs,
                global_settings=settings_obj
            )
            updated_count += 1
        except Exception as e:
            logger.error(f"Failed to generate prompt for storyboard {target_sb.id}: {e}")

    storage.save_project(project)
    return GeneratePromptsResponse(success=True, updated=updated_count)


@router.get("/projects/{project_id}/generate/status", response_model=GenerationStatusResponse)
async def get_generation_status(project_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    in_progress_images = [sb.id for sb in project.storyboards if sb.imageStatus == GenerationStatus.GENERATING]
    failed_images = [{"id": sb.id, "error": sb.imageError} for sb in project.storyboards if sb.imageStatus == GenerationStatus.FAILED]

    in_progress_audio = [sb.id for sb in project.storyboards if sb.audioStatus == GenerationStatus.GENERATING]
    failed_audio = [{"id": sb.id, "error": sb.audioError} for sb in project.storyboards if sb.audioStatus == GenerationStatus.FAILED]

    return GenerationStatusResponse(
        images={
            "completed": project.generationProgress.imagesCompleted,
            "total": project.generationProgress.imagesTotal,
            "inProgress": in_progress_images,
            "failed": failed_images
        },
        audio={
            "completed": project.generationProgress.audioCompleted,
            "total": project.generationProgress.audioTotal,
            "inProgress": in_progress_audio,
            "failed": failed_audio
        }
    )


def parse_srt_time(time_str: str) -> float:
    """解析 SRT 时间格式为秒"""
    match = re.match(r'(\d+):(\d+):(\d+),(\d+)', time_str)
    if match:
        hours = int(match.group(1))
        minutes = int(match.group(2))
        seconds = int(match.group(3))
        milliseconds = int(match.group(4))
        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000.0
    return 0.0


def parse_vtt_time(time_str: str) -> float:
    """解析 VTT 时间格式为秒"""
    time_str = time_str.strip()
    if '.' not in time_str:
        time_str = time_str + '.000'

    parts = time_str.split(':')
    if len(parts) == 3:
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = float(parts[2])
        return hours * 3600 + minutes * 60 + seconds
    elif len(parts) == 2:
        minutes = int(parts[0])
        seconds = float(parts[1])
        return minutes * 60 + seconds
    return 0.0


def parse_lrc_time(time_str: str) -> float:
    """解析 LRC 时间格式为秒"""
    match = re.match(r'(\d+):(\d+)\.(\d+)', time_str)
    if match:
        minutes = int(match.group(1))
        seconds = int(match.group(2))
        hundredths = int(match.group(3))
        return minutes * 60 + seconds + hundredths / 100.0
    return 0.0


def get_audio_duration(audio_path: Path) -> float:
    """获取音频文件时长（支持多种格式）"""
    try:
        media_info = MediaInfo.parse(str(audio_path))
        for track in media_info.tracks:
            if track.track_type == 'Audio':
                if track.duration:
                    return float(track.duration) / 1000.0
    except Exception as e:
        logger.warning(f"Failed to get duration with pymediainfo: {e}")

    try:
        if audio_path.suffix.lower() == '.wav':
            with wave.open(str(audio_path), 'rb') as wav_file:
                frames = wav_file.getnframes()
                rate = wav_file.getframerate()
                return frames / float(rate)
    except Exception as e:
        logger.warning(f"Failed to get duration with wave: {e}")

    return 0.0


@router.post("/projects/{project_id}/upload-subtitle")
async def upload_subtitle(project_id: str, file: UploadFile = File(...)):
    """上传字幕文件 (支持 SRT, VTT, LRC, TXT 格式) - AI漫画项目"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.NOVEL_COMIC:
        raise HTTPException(status_code=400, detail="Not a novel comic project")

    proj_dir = Path(settings.data_dir) / "projects" / project_id
    subtitle_dir = proj_dir / "subtitles"
    subtitle_dir.mkdir(exist_ok=True)

    file_ext = Path(file.filename).suffix.lower() if file.filename else '.txt'
    subtitle_filename = f"subtitle_{uuid.uuid4()}{file_ext}"
    subtitle_path = subtitle_dir / subtitle_filename

    content = await file.read()
    with open(subtitle_path, 'wb') as f:
        f.write(content)

    subtitle_segments = []
    text_segments = []

    try:
        content_str = content.decode('utf-8')
    except UnicodeDecodeError:
        try:
            content_str = content.decode('gbk')
        except:
            content_str = content.decode('utf-8', errors='ignore')

    if file_ext == '.srt':
        blocks = re.split(r'\n\s*\n', content_str.strip())
        for i, block in enumerate(blocks):
            lines = block.strip().split('\n')
            if len(lines) >= 3:
                time_line = lines[1]
                text_lines = lines[2:]
                time_match = re.match(r'(\S+)\s*-->\s*(\S+)', time_line)
                if time_match:
                    start_time = parse_srt_time(time_match.group(1))
                    end_time = parse_srt_time(time_match.group(2))
                    text = ' '.join(text_lines).strip()
                    if text:
                        subtitle_segments.append(SubtitleSegment(
                            index=i,
                            text=text,
                            startTime=start_time,
                            endTime=end_time
                        ))
                        text_segments.append(TextSegment(index=i, text=text))

    elif file_ext == '.vtt':
        lines = content_str.split('\n')
        i = 0
        segment_index = 0
        while i < len(lines):
            line = lines[i].strip()
            if '-->' in line:
                time_match = re.match(r'(\S+)\s*-->\s*(\S+)', line)
                if time_match:
                    start_time = parse_vtt_time(time_match.group(1))
                    end_time = parse_vtt_time(time_match.group(2))
                    i += 1
                    text_lines = []
                    while i < len(lines) and lines[i].strip() != '':
                        text_lines.append(lines[i].strip())
                        i += 1
                    text = ' '.join(text_lines).strip()
                    if text:
                        subtitle_segments.append(SubtitleSegment(
                            index=segment_index,
                            text=text,
                            startTime=start_time,
                            endTime=end_time
                        ))
                        text_segments.append(TextSegment(index=segment_index, text=text))
                        segment_index += 1
            i += 1

    elif file_ext == '.lrc':
        lines = content_str.split('\n')
        segment_index = 0
        for line in lines:
            line = line.strip()
            time_match = re.match(r'\[(\d+:\d+\.\d+)\](.*)', line)
            if time_match:
                time_str = time_match.group(1)
                text = time_match.group(2).strip()
                if text:
                    start_time = parse_lrc_time(time_str)
                    subtitle_segments.append(SubtitleSegment(
                        index=segment_index,
                        text=text,
                        startTime=start_time,
                        endTime=start_time + 5.0
                    ))
                    text_segments.append(TextSegment(index=segment_index, text=text))
                    segment_index += 1

    else:
        lines = [line.strip() for line in content_str.split('\n') if line.strip()]
        for i, line in enumerate(lines):
            subtitle_segments.append(SubtitleSegment(
                index=i,
                text=line,
                startTime=i * 5.0,
                endTime=(i + 1) * 5.0
            ))
            text_segments.append(TextSegment(index=i, text=line))

    project.subtitleFilePath = f"subtitles/{subtitle_filename}"
    project.subtitleSegments = subtitle_segments
    project.sourceText = '\n'.join([t.text for t in text_segments])

    storage.save_project(project)
    return {
        "success": True,
        "subtitleSegments": subtitle_segments,
        "textSegments": text_segments
    }


@router.delete("/projects/{project_id}/subtitle")
async def delete_subtitle(project_id: str):
    """删除已上传的字幕 - AI漫画项目"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.NOVEL_COMIC:
        raise HTTPException(status_code=400, detail="Not a novel comic project")

    project.subtitleFilePath = None
    project.subtitleSegments = []
    storage.save_project(project)
    return {"success": True}


@router.post("/projects/{project_id}/upload-audio")
async def upload_audio(project_id: str, file: UploadFile = File(...)):
    """上传音频文件 - AI漫画项目"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.NOVEL_COMIC:
        raise HTTPException(status_code=400, detail="Not a novel comic project")

    proj_dir = Path(settings.data_dir) / "projects" / project_id
    audio_dir = proj_dir / "audio"
    audio_dir.mkdir(exist_ok=True)

    file_ext = Path(file.filename).suffix.lower() if file.filename else '.wav'
    audio_filename = f"uploaded_{uuid.uuid4()}{file_ext}"
    audio_path = audio_dir / audio_filename

    content = await file.read()
    with open(audio_path, 'wb') as f:
        f.write(content)

    duration = get_audio_duration(audio_path)

    if duration <= 0 and project.subtitleSegments:
        last_subtitle = project.subtitleSegments[-1]
        duration = last_subtitle.endTime
        logger.info(f"Using subtitle duration: {duration}s")

    if duration <= 0:
        duration = 30.0
        logger.warning(f"Using default duration: {duration}s")

    audio_clip = AudioClip(
        index=0,
        textSegmentId=str(uuid.uuid4()),
        text=file.filename or "上传的音频",
        audioPath=f"audio/{audio_filename}",
        duration=duration,
        startTime=0.0,
        endTime=duration,
        status=GenerationStatus.COMPLETED
    )

    project.uploadedAudioFiles.append(f"audio/{audio_filename}")

    storage.save_project(project)
    return {
        "success": True,
        "audioClip": audio_clip
    }


@router.post("/projects/{project_id}/upload-audios")
async def upload_audios(project_id: str, files: List[UploadFile] = File(...)):
    """批量上传音频文件 - AI漫画项目"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.NOVEL_COMIC:
        raise HTTPException(status_code=400, detail="Not a novel comic project")

    proj_dir = Path(settings.data_dir) / "projects" / project_id
    audio_dir = proj_dir / "audio"
    audio_dir.mkdir(exist_ok=True)

    uploaded_clips = []

    sorted_files = sorted(files, key=lambda f: f.filename or "")

    for file in sorted_files:
        file_ext = Path(file.filename).suffix.lower() if file.filename else '.wav'
        audio_filename = f"uploaded_{uuid.uuid4()}{file_ext}"
        audio_path = audio_dir / audio_filename

        content = await file.read()
        with open(audio_path, 'wb') as f:
            f.write(content)

        duration = get_audio_duration(audio_path)

        if duration <= 0:
            duration = 5.0
            logger.warning(f"Using default duration for {file.filename}: {duration}s")

        audio_clip = AudioClip(
            index=len(uploaded_clips),
            textSegmentId=str(uuid.uuid4()),
            text=file.filename or "上传的音频",
            audioPath=f"audio/{audio_filename}",
            duration=duration,
            startTime=0.0,
            endTime=duration,
            status=GenerationStatus.COMPLETED
        )

        uploaded_clips.append(audio_clip)
        project.uploadedAudioFiles.append(f"audio/{audio_filename}")

    storage.save_project(project)
    return {
        "success": True,
        "audioClips": uploaded_clips
    }


@router.delete("/projects/{project_id}/audios")
async def delete_uploaded_audios(project_id: str):
    """删除所有上传的音频 - AI漫画项目"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.NOVEL_COMIC:
        raise HTTPException(status_code=400, detail="Not a novel comic project")

    project.uploadedAudioFiles = []
    storage.save_project(project)
    return {"success": True}
