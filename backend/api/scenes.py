from fastapi import APIRouter, HTTPException
from typing import List
import uuid
import logging

from models.schemas import Scene, Project
from core.storage import storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["scenes"])


@router.post("/projects/{project_id}/scenes/extract")
async def extract_scenes(project_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.sourceText or not project.sourceText.strip():
        raise HTTPException(status_code=400, detail="No source text available")

    from core.llm import LLMClient

    settings_obj = storage.load_global_settings()
    llm_client = LLMClient(settings_obj)

    try:
        scene_dicts = await llm_client.extract_scenes(
            project.sourceText,
            project=project,
            global_settings=settings_obj
        )

        if scene_dicts:
            for scene_dict in scene_dicts:
                scene = Scene(
                    id=str(uuid.uuid4()),
                    name=scene_dict.get("name", ""),
                    description=scene_dict.get("description", "")
                )
                project.scenes.append(scene)

        storage.save_project(project)
        return {"scenes": project.scenes, "scenesExtracted": len(scene_dicts)}
    except Exception as e:
        logger.error(f"Failed to extract scenes: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract scenes: {str(e)}")


@router.get("/projects/{project_id}/scenes", response_model=List[Scene])
async def list_scenes(project_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.scenes


@router.put("/projects/{project_id}/scenes/{scene_id}", response_model=Scene)
async def update_scene(project_id: str, scene_id: str, data: dict):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for i, scene in enumerate(project.scenes):
        if scene.id == scene_id:
            if "name" in data:
                project.scenes[i].name = data["name"]
            if "description" in data:
                project.scenes[i].description = data["description"]
            project.scenes[i].updatedAt = __import__("datetime").datetime.now()
            storage.save_project(project)
            return project.scenes[i]

    raise HTTPException(status_code=404, detail="Scene not found")


@router.delete("/projects/{project_id}/scenes/{scene_id}")
async def delete_scene(project_id: str, scene_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.scenes = [s for s in project.scenes if s.id != scene_id]

    # 清除分镜中对该场景的引用
    for sb in project.storyboards:
        if sb.sceneId == scene_id:
            sb.sceneId = None

    storage.save_project(project)
    return {"success": True}
