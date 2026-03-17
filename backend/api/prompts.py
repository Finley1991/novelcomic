from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel, Field

from models.schemas import PromptTemplate, PromptType, PromptVariable
from core.prompt_templates import prompt_template_manager

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


class CreateTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    type: PromptType
    systemPrompt: str = ""
    userPrompt: str = ""


class UpdateTemplateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    systemPrompt: Optional[str] = None
    userPrompt: Optional[str] = None


class DuplicateTemplateRequest(BaseModel):
    newName: str = Field(..., min_length=1, max_length=100)


@router.get("/templates", response_model=List[PromptTemplate])
async def list_templates(type: Optional[PromptType] = Query(None)):
    return prompt_template_manager.load_all_templates(type)


@router.get("/templates/{template_id}", response_model=PromptTemplate)
async def get_template(template_id: str):
    template = prompt_template_manager.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("/templates", response_model=PromptTemplate)
async def create_template(request: CreateTemplateRequest):
    import uuid
    from datetime import datetime
    from models.schemas import PromptTemplate

    template = PromptTemplate(
        id=str(uuid.uuid4()),
        name=request.name,
        description=request.description,
        type=request.type,
        systemPrompt=request.systemPrompt,
        userPrompt=request.userPrompt,
        isPreset=False
    )
    return prompt_template_manager.save_template(template)


@router.put("/templates/{template_id}", response_model=PromptTemplate)
async def update_template(template_id: str, request: UpdateTemplateRequest):
    template = prompt_template_manager.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.isPreset:
        raise HTTPException(status_code=400, detail="Cannot modify preset templates")

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)

    return prompt_template_manager.save_template(template)


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str, cascade: bool = Query(False)):
    try:
        success, usages = prompt_template_manager.delete_template(template_id, cascade)
        if not success and usages:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Template is in use",
                    "usages": usages
                }
            )
        return {"success": success, "usages": usages}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/templates/{template_id}/duplicate", response_model=PromptTemplate)
async def duplicate_template(template_id: str, request: DuplicateTemplateRequest):
    try:
        return prompt_template_manager.duplicate_template(template_id, request.newName)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/variables", response_model=List[PromptVariable])
async def get_variables(type: PromptType = Query(...)):
    return prompt_template_manager.get_variables(type)
