from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from models.schemas import (
    PromptSnippet, PromptSnippetCategory, ImagePromptTemplate,
    CreatePromptSnippetRequest, UpdatePromptSnippetRequest,
    CreateImagePromptTemplateRequest, UpdateImagePromptTemplateRequest,
    DuplicateRequest, RenderImagePromptRequest, RenderImagePromptResponse
)
from core.image_prompt_manager import image_prompt_manager

router = APIRouter(prefix="/api/image-prompts", tags=["image-prompts"])


# ===== Snippet Endpoints =====

@router.get("/snippets", response_model=List[PromptSnippet])
async def list_snippets(category: Optional[PromptSnippetCategory] = Query(None)):
    return image_prompt_manager.load_all_snippets(category)


@router.get("/snippets/{snippet_id}", response_model=PromptSnippet)
async def get_snippet(snippet_id: str):
    snippet = image_prompt_manager.get_snippet(snippet_id)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return snippet


@router.post("/snippets", response_model=PromptSnippet)
async def create_snippet(request: CreatePromptSnippetRequest):
    return image_prompt_manager.create_snippet(
        name=request.name,
        description=request.description,
        category=request.category,
        content=request.content
    )


@router.put("/snippets/{snippet_id}", response_model=PromptSnippet)
async def update_snippet(snippet_id: str, request: UpdatePromptSnippetRequest):
    snippet = image_prompt_manager.update_snippet(
        snippet_id,
        **request.model_dump(exclude_unset=True)
    )
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found or cannot modify preset")
    return snippet


@router.delete("/snippets/{snippet_id}")
async def delete_snippet(snippet_id: str):
    success = image_prompt_manager.delete_snippet(snippet_id)
    if not success:
        raise HTTPException(status_code=404, detail="Snippet not found or cannot delete preset")
    return {"success": True}


@router.post("/snippets/{snippet_id}/duplicate", response_model=PromptSnippet)
async def duplicate_snippet(snippet_id: str, request: DuplicateRequest):
    snippet = image_prompt_manager.duplicate_snippet(snippet_id, request.newName)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return snippet


# ===== Template Endpoints =====

@router.get("/templates", response_model=List[ImagePromptTemplate])
async def list_templates():
    return image_prompt_manager.load_all_templates()


@router.get("/templates/{template_id}", response_model=ImagePromptTemplate)
async def get_template(template_id: str):
    template = image_prompt_manager.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("/templates", response_model=ImagePromptTemplate)
async def create_template(request: CreateImagePromptTemplateRequest):
    return image_prompt_manager.create_template(
        name=request.name,
        description=request.description,
        template=request.template,
        snippet_ids=request.snippetIds
    )


@router.put("/templates/{template_id}", response_model=ImagePromptTemplate)
async def update_template(template_id: str, request: UpdateImagePromptTemplateRequest):
    template = image_prompt_manager.update_template(
        template_id,
        **request.model_dump(exclude_unset=True)
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found or cannot modify preset")
    return template


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    success = image_prompt_manager.delete_template(template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found or cannot delete preset")
    return {"success": True}


@router.post("/templates/{template_id}/duplicate", response_model=ImagePromptTemplate)
async def duplicate_template(template_id: str, request: DuplicateRequest):
    template = image_prompt_manager.duplicate_template(template_id, request.newName)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("/templates/{template_id}/render", response_model=RenderImagePromptResponse)
async def render_template(template_id: str, request: RenderImagePromptRequest):
    rendered = image_prompt_manager.render_template(
        template_id,
        **request.model_dump(exclude_unset=True)
    )
    if rendered is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return RenderImagePromptResponse(renderedPrompt=rendered)
