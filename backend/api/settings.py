from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from models.schemas import GlobalSettings
from core.storage import storage
from core.llm import LLMClient

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/settings", response_model=GlobalSettings)
async def get_settings():
    return storage.load_global_settings()


@router.put("/settings", response_model=GlobalSettings)
async def update_settings(settings_obj: GlobalSettings):
    storage.save_global_settings(settings_obj)
    return settings_obj


@router.post("/settings/llm/test")
async def test_llm():
    settings_obj = storage.load_global_settings()
    llm_client = LLMClient(settings_obj)
    result = await llm_client.test_connection()
    return result
