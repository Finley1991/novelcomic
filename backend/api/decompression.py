from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Dict, Optional
import uuid
import logging
from pathlib import Path
import random
import math
import wave
from io import BytesIO

from config import settings
from models.schemas import (
    Project, SplitTextRequest, SelectVideosRequest,
    GenerateDecompressionImagesRequest, ExportDecompressionJianyingRequest,
    UpdateDecompressionDataRequest,
    ProjectType, MotionType, MotionConfig, GenerationStatus
)
from core.storage import storage
from core.decompression_utils import VideoScanner, StylePromptScanner

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/decompression", tags=["decompression"])


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
    if target_duration <= 0:
        raise HTTPException(status_code=400, detail="No audio duration found")

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

    target_duration = project.decompressionData.totalAudioDuration
    image_count = math.ceil(target_duration / 15) if target_duration > 0 else 0
    if image_count <= 0:
        raise HTTPException(status_code=400, detail="Invalid image count")

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

            with open(image_path, 'wb') as f:
                f.write(img_data)

            clip.imagePath = f"decompression_images/{clip.id}.png"
            clip.status = GenerationStatus.COMPLETED

        except Exception as e:
            logger.error(f"Failed to generate image for clip {clip.id}: {e}")
            clip.status = GenerationStatus.FAILED

        storage.save_project(project)


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
    CAPCUT_MATE_PATH = Path("/Users/wyf-mac/Documents/code/claudecode/capcut-mate/src")
    if not CAPCUT_MATE_PATH.exists():
        raise HTTPException(status_code=500, detail=f"capcut-mate library not found at: {CAPCUT_MATE_PATH}")

    try:
        exporter = DecompressionJianyingExporter(template_dir, draft_base_path)
        result = exporter.export_project(project, proj_dir)
        return result
    except Exception as e:
        logger.error(f"Export failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
