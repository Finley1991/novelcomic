from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from typing import Dict, Any, Optional, Set
import asyncio
from pathlib import Path
from PIL import Image
from io import BytesIO
import uuid

from models.schemas import (
    Project, GenerateImagesRequest, GenerateAudiosRequest,
    GenerationStatus, GenerationStatusResponse
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
            for sb in project.storyboards:
                if sb.id == sb_id:
                    storyboard = sb
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
                char_dicts = [c.model_dump() for c in characters]
                storyboard.imagePrompt = await llm_client.generate_image_prompt(
                    storyboard.sceneDescription,
                    char_dicts,
                    project.stylePrompt
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

            text = storyboard.narration or storyboard.dialogue
            if not text or not text.strip():
                storyboard.audioStatus = GenerationStatus.COMPLETED
                storyboard.audioDuration = 0
                storage.save_project(project)
                return

            storyboard.audioStatus = GenerationStatus.GENERATING
            storage.save_project(project)

            settings_obj = storage.load_global_settings()
            tts_client = TTSClient(settings_obj)

            # 获取角色 TTS 配置
            tts_config = None
            if storyboard.characterIds:
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

    settings_obj = storage.load_global_settings()
    llm_client = LLMClient(settings_obj)
    char_dicts = await llm_client.extract_characters(project.sourceText)

    from models.schemas import Character
    for char_dict in char_dicts:
        char = Character(
            name=char_dict.get("name", ""),
            description=char_dict.get("description", ""),
            characterPrompt=f"{char_dict.get('description', '')}, {char_dict.get('personality', '')}"
        )
        project.characters.append(char)

    storage.save_project(project)
    return {"characters": project.characters}

@router.post("/projects/{project_id}/storyboards/split")
async def split_storyboard(project_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    settings_obj = storage.load_global_settings()
    llm_client = LLMClient(settings_obj)
    char_dicts = [c.model_dump() for c in project.characters]
    sb_dicts = await llm_client.split_storyboard(project.sourceText, char_dicts)

    from models.schemas import Storyboard
    char_map = {c.name: c.id for c in project.characters}

    for sb_dict in sb_dicts:
        char_names = sb_dict.get("characterNames", [])
        char_ids = [char_map[name] for name in char_names if name in char_map]

        storyboard = Storyboard(
            index=sb_dict.get("index", len(project.storyboards)),
            sceneDescription=sb_dict.get("sceneDescription", ""),
            dialogue=sb_dict.get("dialogue", ""),
            narration=sb_dict.get("narration", ""),
            characterIds=char_ids
        )
        project.storyboards.append(storyboard)

    project.generationProgress.imagesTotal = len(project.storyboards)
    project.generationProgress.audioTotal = len(project.storyboards)
    storage.save_project(project)
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
