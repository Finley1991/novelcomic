from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import logging

from models.schemas import (
    ComfyUIWorkflow,
    ComfyUINodeInfo,
    ComfyUINodeMappings,
    CreateComfyUIWorkflowRequest,
    UpdateComfyUIWorkflowRequest,
    SetActiveWorkflowRequest,
    GlobalSettings
)
from core.storage import storage

logger = logging.getLogger(__name__)
router = APIRouter()


def _parse_workflow_nodes(workflow_json: Dict[str, Any]) -> List[ComfyUINodeInfo]:
    nodes = []
    for node_id, node_data in workflow_json.items():
        class_type = node_data.get("class_type", "")
        inputs = node_data.get("inputs", {})

        title = None
        if "_meta" in node_data and "title" in node_data["_meta"]:
            title = node_data["_meta"]["title"]
        elif "title" in node_data:
            title = node_data["title"]

        fields = []
        for key, value in inputs.items():
            if not isinstance(value, list):
                fields.append(key)

        nodes.append(ComfyUINodeInfo(
            id=node_id,
            classType=class_type,
            title=title,
            fields=fields
        ))

    return nodes


@router.get("/workflows", response_model=List[ComfyUIWorkflow])
async def list_workflows():
    return storage.list_comfyui_workflows()


@router.post("/workflows", response_model=ComfyUIWorkflow)
async def create_workflow(request: CreateComfyUIWorkflowRequest):
    workflow = ComfyUIWorkflow(
        name=request.name,
        workflowJson=request.workflowJson
    )
    storage.save_comfyui_workflow(workflow)
    return workflow


@router.get("/workflows/{workflow_id}", response_model=ComfyUIWorkflow)
async def get_workflow(workflow_id: str):
    workflow = storage.get_comfyui_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@router.put("/workflows/{workflow_id}", response_model=ComfyUIWorkflow)
async def update_workflow(workflow_id: str, request: UpdateComfyUIWorkflowRequest):
    workflow = storage.get_comfyui_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if request.name is not None:
        workflow.name = request.name
    if request.nodeMappings is not None:
        workflow.nodeMappings = request.nodeMappings
    if request.defaultParams is not None:
        workflow.defaultParams = request.defaultParams

    storage.save_comfyui_workflow(workflow)
    return workflow


@router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str):
    success = storage.delete_comfyui_workflow(workflow_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workflow not found")

    settings = storage.load_global_settings()
    if settings.comfyui.activeWorkflowId == workflow_id:
        settings.comfyui.activeWorkflowId = None
        storage.save_global_settings(settings)

    return {"success": True}


@router.post("/workflows/{workflow_id}/parse")
async def parse_workflow(workflow_id: str):
    workflow = storage.get_comfyui_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    nodes = _parse_workflow_nodes(workflow.workflowJson)
    return {"nodes": nodes}


@router.put("/active-workflow", response_model=GlobalSettings)
async def set_active_workflow(request: SetActiveWorkflowRequest):
    if request.workflowId:
        workflow = storage.get_comfyui_workflow(request.workflowId)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

    settings = storage.load_global_settings()
    settings.comfyui.activeWorkflowId = request.workflowId
    storage.save_global_settings(settings)
    return settings
