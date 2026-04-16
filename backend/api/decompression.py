from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from typing import List, Dict, Optional
import uuid
import logging
from pathlib import Path
import random
import math
import wave
from io import BytesIO
import re
from pymediainfo import MediaInfo

from config import settings
from models.schemas import (
    Project, SplitTextRequest, SelectVideosRequest,
    GenerateDecompressionImagesRequest, ExportDecompressionJianyingRequest,
    UpdateDecompressionDataRequest,
    ProjectType, MotionType, MotionConfig, GenerationStatus,
    SubtitleSegment, TextSegment, AudioClip
)
from core.storage import storage
from core.decompression_utils import VideoScanner, StylePromptScanner
from core.capcut_mate import is_capcut_mate_available, get_capcut_mate_path

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/decompression", tags=["decompression"])

# 全局取消标志字典：project_id -> cancelled (bool)
image_generation_cancel_flags: Dict[str, bool] = {}


def get_video_scanner() -> VideoScanner:
    cache_path = Path(settings.data_dir) / "decompression_video_cache.json"
    return VideoScanner(cache_path)


def get_style_scanner() -> StylePromptScanner:
    global_settings = storage.load_global_settings()
    if global_settings.stylePromptsPath:
        style_dir = Path(global_settings.stylePromptsPath)
    elif settings.style_prompts_path:
        style_dir = Path(settings.style_prompts_path)
    else:
        style_dir = Path(settings.data_dir) / "style_prompts"
    return StylePromptScanner(style_dir)


@router.get("/videos", response_model=List[Dict])
async def list_videos():
    """获取解压视频列表"""
    global_settings = storage.load_global_settings()
    video_dir = Path(global_settings.decompressionVideoPath) if global_settings.decompressionVideoPath else Path(settings.decompression_video_path)
    scanner = get_video_scanner()
    return scanner.scan_videos(video_dir)


@router.post("/videos/scan", response_model=List[Dict])
async def scan_videos():
    """重新扫描视频目录"""
    global_settings = storage.load_global_settings()
    video_dir = Path(global_settings.decompressionVideoPath) if global_settings.decompressionVideoPath else Path(settings.decompression_video_path)
    scanner = get_video_scanner()
    return scanner.scan_videos(video_dir, force_rescan=True)


@router.get("/styles", response_model=List[str])
async def list_styles():
    """获取风格列表"""
    scanner = get_style_scanner()
    return scanner.scan_styles()


@router.get("/styles/{style_name}/prompts", response_model=List[str])
async def get_style_prompts(style_name: str):
    """获取某风格的提示词列表"""
    scanner = get_style_scanner()
    return scanner.get_prompts_for_style(style_name)


@router.post("/styles/scan", response_model=List[str])
async def scan_styles():
    """重新扫描风格提示词目录"""
    scanner = get_style_scanner()
    return scanner.scan_styles()


@router.put("/projects/{project_id}/data", response_model=Project)
async def update_decompression_data(project_id: str, request: UpdateDecompressionDataRequest):
    """更新解压视频项目数据"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")
    if not project.decompressionData:
        from models.schemas import DecompressionProjectData
        project.decompressionData = DecompressionProjectData()

    if request.selectedStyle is not None:
        project.decompressionData.selectedStyle = request.selectedStyle

    storage.save_project(project)
    return project


@router.post("/projects/{project_id}/split-text")
async def split_text(project_id: str, request: SplitTextRequest):
    """按行拆分文本"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")

    if not project.decompressionData:
        from models.schemas import DecompressionProjectData
        project.decompressionData = DecompressionProjectData()

    lines = [line.strip() for line in project.decompressionData.sourceText.split('\n') if line.strip()]

    from models.schemas import TextSegment
    segments = []
    for i, line in enumerate(lines):
        segments.append(TextSegment(index=i, text=line))

    project.decompressionData.textSegments = segments
    storage.save_project(project)
    return {"success": True, "segments": segments}


@router.post("/projects/{project_id}/generate-audio")
async def generate_audio(project_id: str, background_tasks: BackgroundTasks):
    """生成配音"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")
    if not project.decompressionData or not project.decompressionData.textSegments:
        raise HTTPException(status_code=400, detail="No text segments found")

    background_tasks.add_task(_generate_audio_task, project_id)
    return {"success": True, "message": "Audio generation started"}


async def _generate_audio_task(project_id: str):
    """后台生成配音任务"""
    project = storage.load_project(project_id)
    if not project or not project.decompressionData:
        return

    from core.tts import TTSClient
    global_settings = storage.load_global_settings()
    tts_client = TTSClient(global_settings)
    proj_dir = Path(settings.data_dir) / "projects" / project_id
    audio_dir = proj_dir / "audio"
    audio_dir.mkdir(exist_ok=True)

    from models.schemas import AudioClip
    audio_clips = []
    current_time = 0.0

    for i, segment in enumerate(project.decompressionData.textSegments):
        clip = AudioClip(
            index=i,
            textSegmentId=segment.id,
            text=segment.text,
            status=GenerationStatus.GENERATING
        )

        try:
            audio_path = audio_dir / f"{clip.id}.wav"
            audio_data, duration = await tts_client.synthesize(
                text=segment.text,
                voice=global_settings.tts.voice,
                rate=global_settings.tts.rate,
                pitch=global_settings.tts.pitch
            )

            with open(audio_path, 'wb') as f:
                f.write(audio_data)

            clip.audioPath = f"audio/{clip.id}.wav"
            clip.duration = duration
            clip.startTime = current_time
            clip.endTime = current_time + duration
            clip.status = GenerationStatus.COMPLETED
            current_time += duration

        except Exception as e:
            logger.error(f"Failed to generate audio for segment {segment.id}: {e}")
            clip.status = GenerationStatus.FAILED

        audio_clips.append(clip)

    project.decompressionData.audioClips = audio_clips
    project.decompressionData.totalAudioDuration = current_time
    storage.save_project(project)


@router.post("/projects/{project_id}/select-videos")
async def select_videos(project_id: str, request: SelectVideosRequest):
    """自动选择视频素材"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")
    if not project.decompressionData:
        raise HTTPException(status_code=400, detail="Project data not initialized")

    target_duration = project.decompressionData.totalAudioDuration

    # 如果音频时长为0，尝试从其他来源获取
    if target_duration <= 0:
        # 1. 尝试从字幕获取时长
        if project.decompressionData.subtitleSegments:
            last_subtitle = project.decompressionData.subtitleSegments[-1]
            target_duration = last_subtitle.endTime
            logger.info(f"Using subtitle duration for video selection: {target_duration}s")

        # 2. 如果还是没有，使用默认时长
        if target_duration <= 0:
            target_duration = 60.0  # 默认60秒
            logger.warning(f"Using default duration for video selection: {target_duration}s")

    # 最终确保有一个合理的时长
    if target_duration <= 0:
        raise HTTPException(status_code=400, detail="Cannot determine target duration. Please upload audio or subtitle with timing information.")

    global_settings = storage.load_global_settings()
    video_dir = Path(global_settings.decompressionVideoPath) if global_settings.decompressionVideoPath else Path(settings.decompression_video_path)
    scanner = get_video_scanner()
    selected_videos = scanner.select_videos_for_duration(video_dir, target_duration)

    from models.schemas import VideoClip
    video_clips = []
    current_time = 0.0
    for video_data in selected_videos:
        clip = VideoClip(
            filePath=video_data["filePath"],
            fileName=video_data["fileName"],
            duration=video_data["duration"],
            startTime=current_time,
            endTime=current_time + video_data["duration"]
        )
        video_clips.append(clip)
        current_time += video_data["duration"]

    project.decompressionData.videoClips = video_clips
    storage.save_project(project)
    return {"success": True, "videos": video_clips}


@router.post("/projects/{project_id}/generate-images")
async def generate_images(project_id: str, request: GenerateDecompressionImagesRequest, background_tasks: BackgroundTasks):
    """生成图片"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")
    if not project.decompressionData:
        raise HTTPException(status_code=400, detail="Project data not initialized")
    if not project.decompressionData.selectedStyle:
        raise HTTPException(status_code=400, detail="No style selected")

    # 检查是否已有正在生成的图片，如果有则重置为 failed
    if project.decompressionData.imageClips:
        reset_count = 0
        for clip in project.decompressionData.imageClips:
            if clip.status == GenerationStatus.GENERATING:
                clip.status = GenerationStatus.FAILED
                reset_count += 1
        if reset_count > 0:
            logger.warning(f"Reset {reset_count} stuck generating images to failed state")
            storage.save_project(project)

    # 重置取消标志
    image_generation_cancel_flags[project_id] = False
    if project.decompressionData:
        project.decompressionData.imageGenerationCancelled = False
        storage.save_project(project)

    target_duration = project.decompressionData.totalAudioDuration

    # 如果音频时长为0，尝试从其他来源获取
    if target_duration <= 0:
        # 1. 尝试从字幕获取时长
        if project.decompressionData.subtitleSegments:
            last_subtitle = project.decompressionData.subtitleSegments[-1]
            target_duration = last_subtitle.endTime
            logger.info(f"Using subtitle duration for image generation: {target_duration}s")

        # 2. 如果还是没有，使用默认时长
        if target_duration <= 0:
            target_duration = 60.0  # 默认60秒
            logger.warning(f"Using default duration for image generation: {target_duration}s")

    image_count = math.ceil(target_duration / 15) if target_duration > 0 else 0
    if image_count <= 0:
        image_count = 4  # 至少生成4张图片
        logger.warning(f"Using default image count: {image_count}")

    scanner = get_style_scanner()
    prompts = scanner.select_random_prompts(project.decompressionData.selectedStyle, image_count)

    motion_types = list(MotionType)

    from models.schemas import ImageClip
    image_clips = []
    current_time = 0.0
    for i, prompt_text in enumerate(prompts):
        motion_type = random.choice(motion_types)
        motion = MotionConfig(type=motion_type)
        if motion_type in (MotionType.ZOOM_IN, MotionType.ZOOM_OUT):
            motion.startScale = 1.0 if motion_type == MotionType.ZOOM_OUT else 0.9
            motion.endScale = 1.1 if motion_type == MotionType.ZOOM_IN else 1.0

        clip = ImageClip(
            index=i,
            prompt=prompt_text,
            duration=15.0,
            startTime=current_time,
            endTime=current_time + 15.0,
            motion=motion,
            status=GenerationStatus.PENDING
        )
        image_clips.append(clip)
        current_time += 15.0

    project.decompressionData.imageClips = image_clips
    storage.save_project(project)

    if len(image_clips) > 0:
        background_tasks.add_task(_generate_images_task, project_id, request.forceRegenerate)

    return {"success": True, "images": image_clips}


@router.post("/projects/{project_id}/cancel-image-generation")
async def cancel_image_generation(project_id: str):
    """取消图片生成"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")
    if not project.decompressionData:
        raise HTTPException(status_code=400, detail="Project data not initialized")

    # 设置取消标志
    image_generation_cancel_flags[project_id] = True
    project.decompressionData.imageGenerationCancelled = True

    # 将正在生成的图片状态改为已取消
    cancelled_count = 0
    for clip in project.decompressionData.imageClips:
        if clip.status == GenerationStatus.GENERATING:
            clip.status = GenerationStatus.CANCELLED
            cancelled_count += 1

    storage.save_project(project)

    logger.info(f"Image generation cancelled for project {project_id}, {cancelled_count} clips marked as cancelled")

    return {
        "success": True,
        "message": "Image generation cancelled",
        "cancelledCount": cancelled_count
    }


async def _generate_images_task(project_id: str, force_regenerate: bool):
    """后台生成图片任务"""
    project = storage.load_project(project_id)
    if not project or not project.decompressionData:
        return

    from core.comfyui import ComfyUIClient
    comfyui_client = ComfyUIClient()
    proj_dir = Path(settings.data_dir) / "projects" / project_id
    image_dir = proj_dir / "decompression_images"
    image_dir.mkdir(exist_ok=True)

    for clip in project.decompressionData.imageClips:
        # 检查是否被取消
        if image_generation_cancel_flags.get(project_id, False):
            logger.info(f"Image generation cancelled for project {project_id}")
            clip.status = GenerationStatus.CANCELLED
            storage.save_project(project)
            break

        if clip.status == GenerationStatus.COMPLETED and not force_regenerate:
            continue

        clip.status = GenerationStatus.GENERATING
        storage.save_project(project)

        try:
            image_path = image_dir / f"{clip.id}.png"
            seed = random.randint(0, 2**32 - 1)

            img_data = await comfyui_client.generate_image(
                prompt=clip.prompt,
                negative_prompt="",
                seed=seed
            )

            if not img_data:
                raise Exception("No image data returned from ComfyUI")

            with open(image_path, 'wb') as f:
                f.write(img_data)

            clip.imagePath = f"decompression_images/{clip.id}.png"
            clip.status = GenerationStatus.COMPLETED

        except Exception as e:
            logger.error(f"Failed to generate image for clip {clip.id}: {e}", exc_info=True)
            clip.status = GenerationStatus.FAILED

        storage.save_project(project)

    # 清理取消标志
    if project_id in image_generation_cancel_flags:
        del image_generation_cancel_flags[project_id]


@router.post("/projects/{project_id}/export-jianying")
async def export_jianying(project_id: str, request: ExportDecompressionJianyingRequest):
    """导出剪映草稿"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")
    if not project.decompressionData:
        raise HTTPException(status_code=400, detail="Project data not initialized")

    data = project.decompressionData

    # 检查必须的数据
    if not data.audioClips or len(data.audioClips) == 0:
        raise HTTPException(status_code=400, detail="No audio clips found. Please generate audio first.")

    from core.decompression_exporter import DecompressionJianyingExporter

    global_settings = storage.load_global_settings()
    proj_dir = Path(settings.data_dir) / "projects" / project_id
    template_dir = Path(__file__).parent.parent / "core" / "assets" / "jianying_template"
    draft_base_path = Path(global_settings.jianying.draftPath) if global_settings.jianying.draftPath else Path(settings.jianying_draft_path)

    # 检查草稿目录是否存在
    if not draft_base_path.exists():
        try:
            draft_base_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created draft directory: {draft_base_path}")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to create draft directory: {str(e)}. Please check your Jianying draft path in settings.")

    # 检查模板目录
    if not template_dir.exists():
        raise HTTPException(status_code=500, detail=f"Template directory not found: {template_dir}")

    # 检查 capcut-mate 库
    if not is_capcut_mate_available():
        capcut_path = get_capcut_mate_path()
        if capcut_path:
            raise HTTPException(status_code=500, detail=f"capcut-mate library not found at: {capcut_path}. Please check capcut_mate_path in settings.")
        else:
            raise HTTPException(status_code=500, detail="capcut_mate_path not configured. Please set it in settings.")

    try:
        exporter = DecompressionJianyingExporter(template_dir, draft_base_path)
        result = exporter.export_project(project, proj_dir)
        return result
    except Exception as e:
        logger.error(f"Export failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


def parse_srt_time(time_str: str) -> float:
    """解析 SRT 时间格式为秒"""
    # 格式: 00:00:00,000
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
    # 格式: 00:00:00.000 或 00:00.000
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
    # 格式: [mm:ss.xx]
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
        # 先尝试用 pymediainfo 获取（支持多种格式）
        media_info = MediaInfo.parse(str(audio_path))
        for track in media_info.tracks:
            if track.track_type == 'Audio':
                if track.duration:
                    return float(track.duration) / 1000.0  # 毫秒转秒
    except Exception as e:
        logger.warning(f"Failed to get duration with pymediainfo: {e}")

    # 如果 pymediainfo 失败，尝试用 wave（仅支持 wav）
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
    """上传字幕文件 (支持 SRT, VTT, LRC, TXT 格式)"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")
    if not project.decompressionData:
        from models.schemas import DecompressionProjectData
        project.decompressionData = DecompressionProjectData()

    proj_dir = Path(settings.data_dir) / "projects" / project_id
    subtitle_dir = proj_dir / "subtitles"
    subtitle_dir.mkdir(exist_ok=True)

    # 保存上传的文件
    file_ext = Path(file.filename).suffix.lower() if file.filename else '.txt'
    subtitle_filename = f"subtitle_{uuid.uuid4()}{file_ext}"
    subtitle_path = subtitle_dir / subtitle_filename

    content = await file.read()
    with open(subtitle_path, 'wb') as f:
        f.write(content)

    # 解析字幕文件
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
        # 解析 SRT 格式
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
        # 解析 VTT 格式
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
        # 解析 LRC 格式
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
                        endTime=start_time + 5.0  # 默认5秒
                    ))
                    text_segments.append(TextSegment(index=segment_index, text=text))
                    segment_index += 1

    else:
        # 纯文本格式 - 按行分割
        lines = [line.strip() for line in content_str.split('\n') if line.strip()]
        for i, line in enumerate(lines):
            subtitle_segments.append(SubtitleSegment(
                index=i,
                text=line,
                startTime=i * 5.0,
                endTime=(i + 1) * 5.0
            ))
            text_segments.append(TextSegment(index=i, text=line))

    # 更新项目数据
    project.decompressionData.subtitleFilePath = f"subtitles/{subtitle_filename}"
    project.decompressionData.subtitleSegments = subtitle_segments
    project.decompressionData.textSegments = text_segments
    # 同时更新 sourceText
    project.decompressionData.sourceText = '\n'.join([t.text for t in text_segments])
    project.sourceText = project.decompressionData.sourceText

    storage.save_project(project)
    return {
        "success": True,
        "subtitleSegments": subtitle_segments,
        "textSegments": text_segments
    }


@router.delete("/projects/{project_id}/subtitle")
async def delete_subtitle(project_id: str):
    """删除已上传的字幕"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")
    if not project.decompressionData:
        return {"success": True}

    project.decompressionData.subtitleFilePath = None
    project.decompressionData.subtitleSegments = []
    storage.save_project(project)
    return {"success": True}


@router.post("/projects/{project_id}/upload-audio")
async def upload_audio(project_id: str, file: UploadFile = File(...)):
    """上传音频文件 (单个文件或多个文件)"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")
    if not project.decompressionData:
        from models.schemas import DecompressionProjectData
        project.decompressionData = DecompressionProjectData()

    proj_dir = Path(settings.data_dir) / "projects" / project_id
    audio_dir = proj_dir / "audio"
    audio_dir.mkdir(exist_ok=True)

    # 保存上传的文件
    file_ext = Path(file.filename).suffix.lower() if file.filename else '.wav'
    audio_filename = f"uploaded_{uuid.uuid4()}{file_ext}"
    audio_path = audio_dir / audio_filename

    content = await file.read()
    with open(audio_path, 'wb') as f:
        f.write(content)

    # 尝试获取音频时长（支持多种格式）
    duration = get_audio_duration(audio_path)

    # 如果无法获取时长，尝试从字幕推断
    if duration <= 0 and project.decompressionData.subtitleSegments:
        # 使用最后一个字幕的结束时间作为总时长
        last_subtitle = project.decompressionData.subtitleSegments[-1]
        duration = last_subtitle.endTime
        logger.info(f"Using subtitle duration: {duration}s")

    # 如果还是没有时长，使用默认值
    if duration <= 0:
        duration = 30.0  # 默认30秒
        logger.warning(f"Using default duration: {duration}s")

    # 创建音频片段
    from models.schemas import AudioClip
    audio_clip = AudioClip(
        index=len(project.decompressionData.audioClips),
        textSegmentId=str(uuid.uuid4()),
        text=file.filename or "上传的音频",
        audioPath=f"audio/{audio_filename}",
        duration=duration,
        startTime=0.0,
        endTime=duration,
        status=GenerationStatus.COMPLETED
    )

    # 计算总时长
    total_duration = duration
    if project.decompressionData.audioClips:
        # 设置开始时间为上一个片段的结束时间
        last_clip = project.decompressionData.audioClips[-1]
        audio_clip.startTime = last_clip.endTime
        audio_clip.endTime = last_clip.endTime + duration
        audio_clip.index = len(project.decompressionData.audioClips)
        total_duration = audio_clip.endTime

    project.decompressionData.audioClips.append(audio_clip)
    project.decompressionData.totalAudioDuration = total_duration
    project.decompressionData.uploadedAudioFiles.append(f"audio/{audio_filename}")

    storage.save_project(project)
    return {
        "success": True,
        "audioClip": audio_clip
    }


@router.post("/projects/{project_id}/upload-audios")
async def upload_audios(project_id: str, files: List[UploadFile] = File(...)):
    """批量上传音频文件"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")
    if not project.decompressionData:
        from models.schemas import DecompressionProjectData
        project.decompressionData = DecompressionProjectData()

    proj_dir = Path(settings.data_dir) / "projects" / project_id
    audio_dir = proj_dir / "audio"
    audio_dir.mkdir(exist_ok=True)

    from models.schemas import AudioClip
    uploaded_clips = []
    current_time = project.decompressionData.totalAudioDuration

    # 按文件名排序文件
    sorted_files = sorted(files, key=lambda f: f.filename or "")

    for file in sorted_files:
        file_ext = Path(file.filename).suffix.lower() if file.filename else '.wav'
        audio_filename = f"uploaded_{uuid.uuid4()}{file_ext}"
        audio_path = audio_dir / audio_filename

        content = await file.read()
        with open(audio_path, 'wb') as f:
            f.write(content)

        # 尝试获取音频时长（支持多种格式）
        duration = get_audio_duration(audio_path)

        # 如果无法获取时长，使用默认值
        if duration <= 0:
            duration = 5.0  # 默认5秒
            logger.warning(f"Using default duration for {file.filename}: {duration}s")

        # 创建音频片段
        audio_clip = AudioClip(
            index=len(project.decompressionData.audioClips) + len(uploaded_clips),
            textSegmentId=str(uuid.uuid4()),
            text=file.filename or "上传的音频",
            audioPath=f"audio/{audio_filename}",
            duration=duration,
            startTime=current_time,
            endTime=current_time + duration,
            status=GenerationStatus.COMPLETED
        )

        uploaded_clips.append(audio_clip)
        current_time += duration

    # 更新项目数据
    project.decompressionData.audioClips.extend(uploaded_clips)
    project.decompressionData.totalAudioDuration = current_time
    for clip in uploaded_clips:
        project.decompressionData.uploadedAudioFiles.append(clip.audioPath)

    storage.save_project(project)
    return {
        "success": True,
        "audioClips": uploaded_clips
    }


@router.delete("/projects/{project_id}/audios")
async def delete_uploaded_audios(project_id: str):
    """删除所有上传的音频"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")
    if not project.decompressionData:
        return {"success": True}

    project.decompressionData.audioClips = []
    project.decompressionData.totalAudioDuration = 0.0
    project.decompressionData.uploadedAudioFiles = []
    storage.save_project(project)
    return {"success": True}
