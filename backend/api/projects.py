from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List
from datetime import datetime
import uuid
import logging

from models.schemas import (
    Project, CreateProjectRequest, GlobalSettings,
    Character, Storyboard, UpdateStoryboardRequest,
    ReorderStoryboardsRequest, PromptType, UpdateProjectRequest
)
from core.storage import storage
from core.llm import LLMClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["projects"])

# Settings endpoints
@router.get("/settings", response_model=GlobalSettings)
async def get_settings():
    return storage.load_global_settings()

@router.put("/settings", response_model=GlobalSettings)
async def update_settings(settings: GlobalSettings):
    storage.save_global_settings(settings)
    return settings

# Project endpoints
@router.get("/projects", response_model=List[dict])
async def list_projects():
    return storage.list_projects()

@router.post("/projects", response_model=Project)
async def create_project(request: CreateProjectRequest):
    project = Project(
        id=str(uuid.uuid4()),
        name=request.name,
        sourceText=request.sourceText or ""
    )
    storage.save_project(project)
    return project

@router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # 确保所有必需字段都存在
    from models.schemas import Scene
    if not hasattr(project, 'scenes') or project.scenes is None:
        project.scenes = []
    # 确保每个 storyboard 都有 sceneId
    for sb in project.storyboards:
        if not hasattr(sb, 'sceneId'):
            sb.sceneId = None
        if not hasattr(sb, 'characterIds') or sb.characterIds is None:
            sb.characterIds = []
    return project

@router.put("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, request: UpdateProjectRequest):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if request.name is not None:
        project.name = request.name
    if request.sourceText is not None:
        project.sourceText = request.sourceText
    if request.stylePrompt is not None:
        project.stylePrompt = request.stylePrompt
    if request.negativePrompt is not None:
        project.negativePrompt = request.negativePrompt
    if request.projectPromptTemplates is not None:
        project.projectPromptTemplates = request.projectPromptTemplates
    storage.save_project(project)
    return project

@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    success = storage.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"success": True}

# Character endpoints
@router.post("/projects/{project_id}/characters", response_model=Character)
async def create_character(project_id: str, character: Character):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.characters.append(character)
    storage.save_project(project)
    return character

@router.put("/projects/{project_id}/characters/{char_id}", response_model=Character)
async def update_character(project_id: str, char_id: str, character: Character):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for i, char in enumerate(project.characters):
        if char.id == char_id:
            character.id = char_id
            project.characters[i] = character
            storage.save_project(project)
            return character
    raise HTTPException(status_code=404, detail="Character not found")

@router.delete("/projects/{project_id}/characters/{char_id}")
async def delete_character(project_id: str, char_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.characters = [c for c in project.characters if c.id != char_id]
    storage.save_project(project)
    return {"success": True}

@router.post("/projects/{project_id}/characters/{char_id}/reference")
async def upload_character_reference(project_id: str, char_id: str, file: UploadFile = File(...)):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    proj_dir = storage._get_project_dir(project_id)
    char_dir = proj_dir / "characters"
    char_dir.mkdir(exist_ok=True)

    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{char_id}-{uuid.uuid4().hex[:8]}.{ext}"
    filepath = char_dir / filename

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    for char in project.characters:
        if char.id == char_id:
            char.referenceImages.append(f"characters/{filename}")
            storage.save_project(project)
            return {"success": True, "path": f"characters/{filename}"}

    raise HTTPException(status_code=404, detail="Character not found")

# Storyboard endpoints
@router.get("/projects/{project_id}/storyboards", response_model=List[Storyboard])
async def list_storyboards(project_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.storyboards

@router.post("/projects/{project_id}/storyboards", response_model=Storyboard)
async def create_storyboard(project_id: str, storyboard: Storyboard):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    storyboard.index = len(project.storyboards)
    project.storyboards.append(storyboard)
    storage.save_project(project)
    return storyboard

@router.put("/projects/{project_id}/storyboards/{sb_id}", response_model=Storyboard)
async def update_storyboard(project_id: str, sb_id: str, request: UpdateStoryboardRequest):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for i, sb in enumerate(project.storyboards):
        if sb.id == sb_id:
            if request.index is not None:
                project.storyboards[i].index = request.index
            if request.sceneDescription is not None:
                project.storyboards[i].sceneDescription = request.sceneDescription
            if request.dialogue is not None:
                project.storyboards[i].dialogue = request.dialogue
            if request.narration is not None:
                project.storyboards[i].narration = request.narration
            if request.characterIds is not None:
                project.storyboards[i].characterIds = request.characterIds
            if request.sceneId is not None:
                project.storyboards[i].sceneId = request.sceneId
            if request.imagePrompt is not None:
                project.storyboards[i].imagePrompt = request.imagePrompt
            if request.negativePrompt is not None:
                project.storyboards[i].negativePrompt = request.negativePrompt
            if request.motion is not None:
                project.storyboards[i].motion = request.motion
            if hasattr(request, 'ttsConfig') and request.ttsConfig is not None:
                project.storyboards[i].ttsConfig = request.ttsConfig
            storage.save_project(project)
            return project.storyboards[i]
    raise HTTPException(status_code=404, detail="Storyboard not found")

@router.delete("/projects/{project_id}/storyboards/{sb_id}")
async def delete_storyboard(project_id: str, sb_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.storyboards = [s for s in project.storyboards if s.id != sb_id]
    for i, sb in enumerate(project.storyboards):
        sb.index = i
    storage.save_project(project)
    return {"success": True}

@router.put("/projects/{project_id}/storyboards/reorder")
async def reorder_storyboards(project_id: str, request: ReorderStoryboardsRequest):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    sb_map = {sb.id: sb for sb in project.storyboards}
    new_storyboards = []
    for i, sb_id in enumerate(request.storyboardIds):
        if sb_id in sb_map:
            sb = sb_map[sb_id]
            sb.index = i
            new_storyboards.append(sb)
    project.storyboards = new_storyboards
    storage.save_project(project)
    return {"success": True}

# AI processing endpoints are in generation.py

# LLM test endpoint
@router.post("/settings/llm/test")
async def test_llm_settings():
    settings = storage.load_global_settings()
    llm_client = LLMClient(settings)
    return await llm_client.test_connection()
