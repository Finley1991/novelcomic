import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from typing import List

from models.schemas import (
    StylePromptList,
    CreateStyleRequest,
    RenameStyleRequest,
    AddPromptRequest,
    UpdatePromptRequest,
    BatchAppendPromptsRequest,
    ParaphraseRequest,
    ParaphraseResponse,
    TestImageRequest,
    TestImageResponse,
)
from core.style_prompt_manager import style_prompt_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/style-prompts", tags=["style-prompts"])


# ===== 风格管理 =====

@router.get("/styles", response_model=List[StylePromptList])
async def list_styles():
    return style_prompt_manager.list_styles()


@router.post("/styles", response_model=StylePromptList)
async def create_style(request: CreateStyleRequest):
    try:
        return style_prompt_manager.create_style(request.styleName)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/styles/{style_name:path}", response_model=StylePromptList)
async def rename_style(style_name: str, request: RenameStyleRequest):
    try:
        return style_prompt_manager.rename_style(style_name, request.newStyleName)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/styles/{style_name:path}")
async def delete_style(style_name: str):
    success = style_prompt_manager.delete_style(style_name)
    if not success:
        raise HTTPException(status_code=404, detail="Style not found")
    return {"success": True}


# ===== 提示词管理 =====

@router.get("/styles/{style_name:path}/prompts", response_model=List[str])
async def get_prompts(style_name: str):
    try:
        return style_prompt_manager.get_prompts(style_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/styles/{style_name:path}/prompts", response_model=List[str])
async def add_prompt(style_name: str, request: AddPromptRequest):
    try:
        return style_prompt_manager.add_prompt(style_name, request.prompt)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/styles/{style_name:path}/prompts/{index:int}", response_model=List[str])
async def update_prompt(style_name: str, index: int, request: UpdatePromptRequest):
    try:
        return style_prompt_manager.update_prompt(style_name, index, request.prompt)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/styles/{style_name:path}/prompts/{index:int}", response_model=List[str])
async def delete_prompt(style_name: str, index: int):
    try:
        return style_prompt_manager.delete_prompt(style_name, index)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/styles/{style_name:path}/prompts/batch", response_model=List[str])
async def batch_append_prompts(style_name: str, request: BatchAppendPromptsRequest):
    try:
        return style_prompt_manager.batch_append_prompts(style_name, request.prompts)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ===== 仿写功能 =====

@router.post("/paraphrase", response_model=ParaphraseResponse)
async def paraphrase_prompt(request: ParaphraseRequest):
    try:
        generated = await style_prompt_manager.paraphrase_prompt(
            request.originalPrompt,
            request.count,
            request.requirement
        )
        return ParaphraseResponse(generatedPrompts=generated)
    except Exception as e:
        logger.error(f"Paraphrase failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Paraphrase failed: {str(e)}")


# ===== 测试生图 =====

@router.post("/test-image", response_model=TestImageResponse)
async def test_image(request: TestImageRequest):
    try:
        filename = await style_prompt_manager.test_generate_image(request.prompt)
        return TestImageResponse(filename=filename)
    except Exception as e:
        logger.error(f"Test image generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")


@router.get("/test-image/{filename}")
async def get_test_image(filename: str):
    from pathlib import Path
    from config import settings

    file_path = Path(settings.data_dir) / "tmp" / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    return FileResponse(file_path, media_type="image/png")
