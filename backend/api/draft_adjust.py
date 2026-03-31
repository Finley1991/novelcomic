from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import shutil
import logging
import uuid

from models.schemas import (
    LoadDraftRequest, LoadDraftResponse,
    ApplyDraftAdjustmentRequest, ApplyDraftAdjustmentResponse
)
from core.draft_adjuster import DraftAdjuster
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/draft-adjust", tags=["draft-adjust"])


@router.post("/load", response_model=LoadDraftResponse)
async def load_draft(request: LoadDraftRequest):
    """加载草稿信息"""
    try:
        draft_path = Path(request.draftPath)
        if not draft_path.exists():
            raise HTTPException(status_code=404, detail="Draft not found")

        adjuster = DraftAdjuster(draft_path)
        info = adjuster.get_draft_info()

        return LoadDraftResponse(
            success=True,
            draftName=info['draftName'],
            duration=info['duration'],
            trackCount=info['trackCount']
        )
    except Exception as e:
        logger.error(f"Failed to load draft: {e}", exc_info=True)
        return LoadDraftResponse(
            success=False,
            draftName="",
            duration=0,
            trackCount=0,
            error=str(e)
        )


@router.post("/upload-cover")
async def upload_cover(file: UploadFile = File(...)):
    """上传封面图片"""
    upload_dir = settings.data_dir / "tmp" / "draft-adjust"
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename).suffix or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return {"path": str(file_path)}


@router.post("/upload-music")
async def upload_music(file: UploadFile = File(...)):
    """上传配乐"""
    upload_dir = settings.data_dir / "tmp" / "draft-adjust"
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename).suffix or ".mp3"
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return {"path": str(file_path)}


@router.post("/apply", response_model=ApplyDraftAdjustmentResponse)
async def apply_adjustment(request: ApplyDraftAdjustmentRequest):
    """应用草稿调整"""
    try:
        draft_path = Path(request.draftPath)
        if not draft_path.exists():
            raise HTTPException(status_code=404, detail="Draft not found")

        adjuster = DraftAdjuster(draft_path)
        adjuster.apply(request.config)

        return ApplyDraftAdjustmentResponse(
            success=True,
            message="Draft adjusted successfully"
        )
    except Exception as e:
        logger.error(f"Failed to apply draft adjustment: {e}", exc_info=True)
        return ApplyDraftAdjustmentResponse(
            success=False,
            message="",
            error=str(e)
        )
