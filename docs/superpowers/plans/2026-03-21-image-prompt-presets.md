# 图片生成提示词预设管理 - 实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为小说推文 AI 漫剧生成工具新增图片生成提示词预设管理功能，包括提示词片段库、可组合模板和变量支持。

**Architecture:** 参考现有 PromptTemplateManager 实现模式，新增 ImagePromptManager 管理片段和模板，提供独立的管理页面，并在项目编辑器中集成模板选择功能。

**Tech Stack:** FastAPI, Pydantic, React 18, TypeScript, Tailwind CSS

---

## 文件清单

### 新增文件

**后端:**
- `backend/api/image_prompts.py` - API 端点
- `backend/core/image_prompt_manager.py` - 提示词管理器

**前端:**
- `frontend/src/pages/ImagePromptManager.tsx` - 提示词管理页面

### 修改文件

**后端:**
- `backend/models/schemas.py` - 添加新数据模型
- `backend/main.py` - 注册新路由

**前端:**
- `frontend/src/services/api.ts` - 添加新类型和 API 方法
- `frontend/src/pages/ProjectEditor.tsx` - 集成模板选择
- `frontend/src/App.tsx` - 添加新路由

---

## Task 1: 后端数据模型

**Files:**
- Modify: `backend/models/schemas.py`

- [ ] **Step 1: 添加 PromptSnippetCategory 枚举**

在 `PromptType` 枚举之后添加：

```python
class PromptSnippetCategory(str, Enum):
    STYLE = "style"
    QUALITY = "quality"
    LIGHTING = "lighting"
    COMPOSITION = "composition"
    CUSTOM = "custom"
```

- [ ] **Step 2: 添加 PromptSnippet 模型**

在 `PromptTemplate` 类之后添加：

```python
class PromptSnippet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    category: PromptSnippetCategory
    content: str
    isPreset: bool = False
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)
```

- [ ] **Step 3: 添加 ImagePromptTemplate 模型**

在 `PromptSnippet` 类之后添加：

```python
class ImagePromptTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    template: str
    snippetIds: List[str] = Field(default_factory=list)
    isPreset: bool = False
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)
```

- [ ] **Step 4: 添加请求/响应 Schema**

在文件末尾添加：

```python
class CreatePromptSnippetRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    category: PromptSnippetCategory
    content: str

class UpdatePromptSnippetRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    category: Optional[PromptSnippetCategory] = None
    content: Optional[str] = None

class CreateImagePromptTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    template: str
    snippetIds: List[str] = Field(default_factory=list)

class UpdateImagePromptTemplateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    template: Optional[str] = None
    snippetIds: Optional[List[str]] = None

class DuplicateRequest(BaseModel):
    newName: str = Field(..., min_length=1, max_length=100)

class RenderImagePromptRequest(BaseModel):
    scene: Optional[str] = None
    characterPrompts: Optional[str] = None
    stylePrompt: Optional[str] = None
    custom: Optional[str] = None
    additionalSnippets: Optional[List[str]] = None

class RenderImagePromptResponse(BaseModel):
    renderedPrompt: str
```

- [ ] **Step 5: 提交**

```bash
git add backend/models/schemas.py
git commit -m "feat: add image prompt data models"
```

---

## Task 2: 后端 ImagePromptManager

**Files:**
- Create: `backend/core/image_prompt_manager.py`

- [ ] **Step 1: 创建预设数据函数**

```python
import json
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from pathlib import Path
import logging
import uuid

from config import settings
from models.schemas import (
    PromptSnippet, PromptSnippetCategory, ImagePromptTemplate
)

logger = logging.getLogger(__name__)


def _get_preset_snippets() -> List[PromptSnippet]:
    now = datetime.now()
    return [
        PromptSnippet(
            id="preset_style_anime",
            name="动漫风格",
            description="适合动漫风格的提示词",
            category=PromptSnippetCategory.STYLE,
            content="anime style, cel shading, vibrant colors",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_style_photorealistic",
            name="写实风格",
            description="写实风格提示词",
            category=PromptSnippetCategory.STYLE,
            content="photorealistic, sharp focus, ultra detailed",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_style_wuxia",
            name="古风武侠",
            description="古风武侠风格提示词",
            category=PromptSnippetCategory.STYLE,
            content="traditional Chinese art, wuxia style, ink painting",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_quality_masterpiece",
            name="高质量",
            description="高质量提示词",
            category=PromptSnippetCategory.QUALITY,
            content="masterpiece, best quality",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_quality_8k",
            name="8K超高清",
            description="8K分辨率提示词",
            category=PromptSnippetCategory.QUALITY,
            content="8k, ultra detailed, high resolution",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_lighting_cinematic",
            name="电影光感",
            description="电影光感提示词",
            category=PromptSnippetCategory.LIGHTING,
            content="cinematic lighting, dramatic shadows",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_lighting_natural",
            name="自然光",
            description="自然光提示词",
            category=PromptSnippetCategory.LIGHTING,
            content="natural lighting, soft shadows",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_composition_closeup",
            name="特写",
            description="特写构图提示词",
            category=PromptSnippetCategory.COMPOSITION,
            content="close-up, portrait, detailed face",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_composition_wide",
            name="广角",
            description="广角构图提示词",
            category=PromptSnippetCategory.COMPOSITION,
            content="wide angle, full body, environment",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
    ]


def _get_preset_templates() -> List[ImagePromptTemplate]:
    now = datetime.now()
    return [
        ImagePromptTemplate(
            id="preset_template_anime_quality",
            name="动漫高质量",
            description="动漫风格高质量提示词",
            template="{quality}, {lighting}, {scene}, {style}",
            snippetIds=[
                "preset_quality_masterpiece",
                "preset_lighting_cinematic",
                "preset_style_anime"
            ],
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        ImagePromptTemplate(
            id="preset_template_photorealistic",
            name="写实电影感",
            description="写实风格电影光感提示词",
            template="{quality}, {lighting}, {scene}, {style}",
            snippetIds=[
                "preset_quality_masterpiece",
                "preset_lighting_cinematic",
                "preset_style_photorealistic"
            ],
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        ImagePromptTemplate(
            id="preset_template_wuxia",
            name="古风武侠",
            description="古风武侠风格提示词",
            template="{quality}, {scene}, {style}",
            snippetIds=[
                "preset_quality_masterpiece",
                "preset_style_wuxia"
            ],
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
    ]
```

- [ ] **Step 2: 创建 ImagePromptManager 类**

继续添加：

```python
class ImagePromptManager:
    def __init__(self):
        self._storage_file = settings.data_dir / "image_prompts.json"
        self._preset_snippets = {s.id: s for s in _get_preset_snippets()}
        self._preset_templates = {t.id: t for t in _get_preset_templates()}
        self._user_snippets, self._user_templates = self._load_user_data()

    def _load_user_data(self) -> Tuple[Dict[str, PromptSnippet], Dict[str, ImagePromptTemplate]]:
        if not self._storage_file.exists():
            return {}, {}
        try:
            data = json.loads(self._storage_file.read_text())
            snippets = {}
            for s_data in data.get("snippets", []):
                if not s_data.get("isPreset", False):
                    s_data["category"] = PromptSnippetCategory(s_data["category"])
                    snippets[s_data["id"]] = PromptSnippet(**s_data)
            templates = {}
            for t_data in data.get("templates", []):
                if not t_data.get("isPreset", False):
                    templates[t_data["id"]] = ImagePromptTemplate(**t_data)
            return snippets, templates
        except Exception as e:
            logger.error(f"Failed to load user image prompts: {e}")
            return {}, {}

    def _save_user_data(self):
        data = {
            "snippets": [s.model_dump() for s in self._user_snippets.values()],
            "templates": [t.model_dump() for t in self._user_templates.values()]
        }
        self._storage_file.parent.mkdir(parents=True, exist_ok=True)
        self._storage_file.write_text(json.dumps(data, ensure_ascii=False, indent=2))

    # ===== Snippet Methods =====
    def load_all_snippets(self, category: Optional[PromptSnippetCategory] = None) -> List[PromptSnippet]:
        all_snippets = list(self._preset_snippets.values()) + list(self._user_snippets.values())
        if category:
            all_snippets = [s for s in all_snippets if s.category == category]
        return sorted(all_snippets, key=lambda s: (not s.isPreset, s.name))

    def get_snippet(self, snippet_id: str) -> Optional[PromptSnippet]:
        if snippet_id in self._preset_snippets:
            return self._preset_snippets[snippet_id]
        return self._user_snippets.get(snippet_id)

    def create_snippet(self, name: str, description: str, category: PromptSnippetCategory, content: str) -> PromptSnippet:
        snippet = PromptSnippet(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            category=category,
            content=content,
            isPreset=False
        )
        self._user_snippets[snippet.id] = snippet
        self._save_user_data()
        return snippet

    def update_snippet(self, snippet_id: str, **kwargs) -> Optional[PromptSnippet]:
        snippet = self.get_snippet(snippet_id)
        if not snippet or snippet.isPreset:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(snippet, key):
                setattr(snippet, key, value)
        snippet.updatedAt = datetime.now()
        self._user_snippets[snippet.id] = snippet
        self._save_user_data()
        return snippet

    def delete_snippet(self, snippet_id: str) -> bool:
        if snippet_id in self._preset_snippets or snippet_id not in self._user_snippets:
            return False
        del self._user_snippets[snippet_id]
        self._save_user_data()
        return True

    def duplicate_snippet(self, snippet_id: str, new_name: str) -> Optional[PromptSnippet]:
        original = self.get_snippet(snippet_id)
        if not original:
            return None
        snippet = PromptSnippet(
            id=str(uuid.uuid4()),
            name=new_name,
            description=original.description,
            category=original.category,
            content=original.content,
            isPreset=False
        )
        self._user_snippets[snippet.id] = snippet
        self._save_user_data()
        return snippet

    # ===== Template Methods =====
    def load_all_templates(self) -> List[ImagePromptTemplate]:
        all_templates = list(self._preset_templates.values()) + list(self._user_templates.values())
        return sorted(all_templates, key=lambda t: (not t.isPreset, t.name))

    def get_template(self, template_id: str) -> Optional[ImagePromptTemplate]:
        if template_id in self._preset_templates:
            return self._preset_templates[template_id]
        return self._user_templates.get(template_id)

    def create_template(self, name: str, description: str, template: str, snippet_ids: List[str]) -> ImagePromptTemplate:
        tpl = ImagePromptTemplate(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            template=template,
            snippetIds=snippet_ids,
            isPreset=False
        )
        self._user_templates[tpl.id] = tpl
        self._save_user_data()
        return tpl

    def update_template(self, template_id: str, **kwargs) -> Optional[ImagePromptTemplate]:
        tpl = self.get_template(template_id)
        if not tpl or tpl.isPreset:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(tpl, key):
                setattr(tpl, key, value)
        tpl.updatedAt = datetime.now()
        self._user_templates[tpl.id] = tpl
        self._save_user_data()
        return tpl

    def delete_template(self, template_id: str) -> bool:
        if template_id in self._preset_templates or template_id not in self._user_templates:
            return False
        del self._user_templates[template_id]
        self._save_user_data()
        return True

    def duplicate_template(self, template_id: str, new_name: str) -> Optional[ImagePromptTemplate]:
        original = self.get_template(template_id)
        if not original:
            return None
        tpl = ImagePromptTemplate(
            id=str(uuid.uuid4()),
            name=new_name,
            description=original.description,
            template=original.template,
            snippetIds=original.snippetIds.copy(),
            isPreset=False
        )
        self._user_templates[tpl.id] = tpl
        self._save_user_data()
        return tpl

    # ===== Render Method =====
    def render_template(self, template_id: str, **kwargs) -> Optional[str]:
        tpl = self.get_template(template_id)
        if not tpl:
            return None

        # 1. 收集片段内容，按分类分组
        snippets_by_category = {}
        for sid in tpl.snippetIds:
            snippet = self.get_snippet(sid)
            if snippet:
                cat = snippet.category.value
                if cat not in snippets_by_category:
                    snippets_by_category[cat] = []
                snippets_by_category[cat].append(snippet.content)

        # 同分类多个片段用逗号连接
        category_content = {}
        for cat, contents in snippets_by_category.items():
            category_content[cat] = ", ".join(contents)

        # 2. 准备变量映射
        variables = {
            "quality": category_content.get("quality", ""),
            "lighting": category_content.get("lighting", ""),
            "composition": category_content.get("composition", ""),
            "style": category_content.get("style", ""),
            "scene": kwargs.get("scene", ""),
            "characters": kwargs.get("characterPrompts", ""),
            "style_prompt": kwargs.get("stylePrompt", ""),
            "custom": kwargs.get("custom", ""),
        }

        # 3. 替换变量
        result = tpl.template
        for var_name, var_value in variables.items():
            result = result.replace(f"{{{var_name}}}", var_value)

        # 4. 添加额外片段
        additional_snippets = kwargs.get("additionalSnippets", [])
        for sid in additional_snippets:
            snippet = self.get_snippet(sid)
            if snippet:
                if result:
                    result += ", "
                result += snippet.content

        # 5. 清理多余的逗号和空格
        parts = [p.strip() for p in result.split(",") if p.strip()]
        result = ", ".join(parts)

        return result


image_prompt_manager = ImagePromptManager()
```

- [ ] **Step 3: 提交**

```bash
git add backend/core/image_prompt_manager.py
git commit -m "feat: add ImagePromptManager with presets"
```

---

## Task 3: 后端 API 端点

**Files:**
- Create: `backend/api/image_prompts.py`

- [ ] **Step 1: 创建 API 路由文件**

```python
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


@router.post("/snippets", response_model=PromptSnippet)
async def create_snippet(request: CreatePromptSnippetRequest):
    return image_prompt_manager.create_snippet(
        request.name, request.description, request.category, request.content
    )


@router.get("/snippets/{snippet_id}", response_model=PromptSnippet)
async def get_snippet(snippet_id: str):
    snippet = image_prompt_manager.get_snippet(snippet_id)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return snippet


@router.put("/snippets/{snippet_id}", response_model=PromptSnippet)
async def update_snippet(snippet_id: str, request: UpdatePromptSnippetRequest):
    snippet = image_prompt_manager.update_snippet(
        snippet_id,
        name=request.name,
        description=request.description,
        category=request.category,
        content=request.content
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


@router.post("/templates", response_model=ImagePromptTemplate)
async def create_template(request: CreateImagePromptTemplateRequest):
    return image_prompt_manager.create_template(
        request.name, request.description, request.template, request.snippetIds
    )


@router.get("/templates/{template_id}", response_model=ImagePromptTemplate)
async def get_template(template_id: str):
    tpl = image_prompt_manager.get_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


@router.put("/templates/{template_id}", response_model=ImagePromptTemplate)
async def update_template(template_id: str, request: UpdateImagePromptTemplateRequest):
    tpl = image_prompt_manager.update_template(
        template_id,
        name=request.name,
        description=request.description,
        template=request.template,
        snippetIds=request.snippetIds
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found or cannot modify preset")
    return tpl


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    success = image_prompt_manager.delete_template(template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found or cannot delete preset")
    return {"success": True}


@router.post("/templates/{template_id}/duplicate", response_model=ImagePromptTemplate)
async def duplicate_template(template_id: str, request: DuplicateRequest):
    tpl = image_prompt_manager.duplicate_template(template_id, request.newName)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


@router.post("/templates/{template_id}/render", response_model=RenderImagePromptResponse)
async def render_template(template_id: str, request: RenderImagePromptRequest):
    rendered = image_prompt_manager.render_template(
        template_id,
        scene=request.scene,
        characterPrompts=request.characterPrompts,
        stylePrompt=request.stylePrompt,
        custom=request.custom,
        additionalSnippets=request.additionalSnippets
    )
    if rendered is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return RenderImagePromptResponse(renderedPrompt=rendered)
```

- [ ] **Step 2: 注册路由到 main.py**

修改 `backend/main.py`，在其他路由注册后添加：

```python
from api import image_prompts

app.include_router(image_prompts.router)
```

- [ ] **Step 3: 提交**

```bash
git add backend/api/image_prompts.py backend/main.py
git commit -m "feat: add image prompts API endpoints"
```

---

## Task 4: 前端类型和 API 方法

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: 添加类型定义**

在文件末尾添加：

```typescript
// ===== Image Prompt Types =====
export type PromptSnippetCategory =
  | 'style'
  | 'quality'
  | 'lighting'
  | 'composition'
  | 'custom';

export interface PromptSnippet {
  id: string;
  name: string;
  description: string;
  category: PromptSnippetCategory;
  content: string;
  isPreset: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ImagePromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  snippetIds: string[];
  isPreset: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RenderImagePromptRequest {
  scene?: string;
  characterPrompts?: string;
  stylePrompt?: string;
  custom?: string;
  additionalSnippets?: string[];
}

export interface RenderImagePromptResponse {
  renderedPrompt: string;
}
```

- [ ] **Step 2: 添加 API 方法**

在 `export default api;` 之前添加：

```typescript
export const imagePromptApi = {
  listSnippets: (category?: PromptSnippetCategory) =>
    api.get<PromptSnippet[]>('/image-prompts/snippets', {
      params: category ? { category } : {}
    }),
  createSnippet: (data: { name: string; description?: string; category: PromptSnippetCategory; content: string }) =>
    api.post<PromptSnippet>('/image-prompts/snippets', data),
  getSnippet: (id: string) => api.get<PromptSnippet>(`/image-prompts/snippets/${id}`),
  updateSnippet: (id: string, data: Partial<{ name: string; description?: string; category?: PromptSnippetCategory; content: string }>) =>
    api.put<PromptSnippet>(`/image-prompts/snippets/${id}`, data),
  deleteSnippet: (id: string) => api.delete(`/image-prompts/snippets/${id}`),
  duplicateSnippet: (id: string, newName: string) =>
    api.post<PromptSnippet>(`/image-prompts/snippets/${id}/duplicate`, { newName }),

  listTemplates: () => api.get<ImagePromptTemplate[]>('/image-prompts/templates'),
  createTemplate: (data: { name: string; description?: string; template: string; snippetIds: string[] }) =>
    api.post<ImagePromptTemplate>('/image-prompts/templates', data),
  getTemplate: (id: string) => api.get<ImagePromptTemplate>(`/image-prompts/templates/${id}`),
  updateTemplate: (id: string, data: Partial<{ name: string; description?: string; template?: string; snippetIds?: string[] }>) =>
    api.put<ImagePromptTemplate>(`/image-prompts/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/image-prompts/templates/${id}`),
  duplicateTemplate: (id: string, newName: string) =>
    api.post<ImagePromptTemplate>(`/image-prompts/templates/${id}/duplicate`, { newName }),
  renderTemplate: (id: string, data: RenderImagePromptRequest) =>
    api.post<RenderImagePromptResponse>(`/image-prompts/templates/${id}/render`, data),
};
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add image prompt types and API methods"
```

---

## Task 5: 前端 ImagePromptManager 页面

**Files:**
- Create: `frontend/src/pages/ImagePromptManager.tsx`

- [ ] **Step 1: 创建页面组件**

```tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  imagePromptApi,
  type PromptSnippet,
  type PromptSnippetCategory,
  type ImagePromptTemplate,
} from '../services/api';

const categoryLabels: Record<PromptSnippetCategory, string> = {
  style: '风格',
  quality: '质量',
  lighting: '光照',
  composition: '构图',
  custom: '自定义',
};

const ImagePromptManager: React.FC = () => {
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState<'snippets' | 'templates'>('snippets');

  // ===== Snippet State =====
  const [snippets, setSnippets] = useState<PromptSnippet[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<PromptSnippetCategory | 'all'>('all');
  const [selectedSnippet, setSelectedSnippet] = useState<PromptSnippet | null>(null);
  const [editingSnippet, setEditingSnippet] = useState(false);
  const [snippetForm, setSnippetForm] = useState<Partial<PromptSnippet>>({});

  // ===== Template State =====
  const [templates, setTemplates] = useState<ImagePromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ImagePromptTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState<Partial<ImagePromptTemplate>>({});
  const [previewPrompt, setPreviewPrompt] = useState('');

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSnippets();
    loadTemplates();
  }, []);

  // ===== Snippet Methods =====
  const loadSnippets = async () => {
    try {
      const response = await imagePromptApi.listSnippets();
      setSnippets(response.data);
    } catch (error) {
      console.error('Failed to load snippets:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await imagePromptApi.listTemplates();
      setTemplates(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setLoading(false);
    }
  };

  const filteredSnippets = selectedCategory === 'all'
    ? snippets
    : snippets.filter(s => s.category === selectedCategory);

  const presetSnippets = filteredSnippets.filter(s => s.isPreset);
  const userSnippets = filteredSnippets.filter(s => !s.isPreset);

  const presetTemplates = templates.filter(t => t.isPreset);
  const userTemplates = templates.filter(t => !t.isPreset);

  // ===== Snippet Handlers =====
  const handleSelectSnippet = (snippet: PromptSnippet) => {
    setSelectedSnippet(snippet);
    setEditingSnippet(false);
    setSnippetForm({});
  };

  const startEditSnippet = () => {
    if (selectedSnippet) {
      setSnippetForm({ ...selectedSnippet });
      setEditingSnippet(true);
    }
  };

  const saveSnippet = async () => {
    if (!selectedSnippet || !snippetForm.name) return;
    try {
      if (selectedSnippet.isPreset) {
        const newName = `${snippetForm.name} (副本)`;
        const response = await imagePromptApi.duplicateSnippet(selectedSnippet.id, newName);
        setSelectedSnippet(response.data);
      } else {
        const response = await imagePromptApi.updateSnippet(selectedSnippet.id, snippetForm);
        setSelectedSnippet(response.data);
      }
      await loadSnippets();
      setEditingSnippet(false);
      setSnippetForm({});
    } catch (error) {
      console.error('Failed to save snippet:', error);
    }
  };

  const deleteSnippet = async () => {
    if (!selectedSnippet || selectedSnippet.isPreset) return;
    if (!confirm(`确定要删除片段 "${selectedSnippet.name}" 吗？`)) return;
    try {
      await imagePromptApi.deleteSnippet(selectedSnippet.id);
      setSelectedSnippet(null);
      await loadSnippets();
    } catch (error) {
      console.error('Failed to delete snippet:', error);
    }
  };

  const duplicateSnippet = async () => {
    if (!selectedSnippet) return;
    const newName = prompt('请输入新片段名称:', `${selectedSnippet.name} (副本)`);
    if (!newName) return;
    try {
      const response = await imagePromptApi.duplicateSnippet(selectedSnippet.id, newName);
      setSelectedSnippet(response.data);
      await loadSnippets();
    } catch (error) {
      console.error('Failed to duplicate snippet:', error);
    }
  };

  const createSnippet = async () => {
    const name = prompt('请输入新片段名称:');
    if (!name) return;
    try {
      const response = await imagePromptApi.createSnippet({
        name,
        category: 'custom',
        content: '',
      });
      setSelectedSnippet(response.data);
      setEditingSnippet(true);
      setSnippetForm({ ...response.data });
      await loadSnippets();
    } catch (error) {
      console.error('Failed to create snippet:', error);
    }
  };

  // ===== Template Handlers =====
  const handleSelectTemplate = (template: ImagePromptTemplate) => {
    setSelectedTemplate(template);
    setEditingTemplate(false);
    setTemplateForm({});
    updatePreview(template);
  };

  const updatePreview = async (template: ImagePromptTemplate) => {
    try {
      const response = await imagePromptApi.renderTemplate(template.id, {
        scene: '[画面描述示例]',
      });
      setPreviewPrompt(response.data.renderedPrompt);
    } catch {
      setPreviewPrompt('');
    }
  };

  const startEditTemplate = () => {
    if (selectedTemplate) {
      setTemplateForm({ ...selectedTemplate });
      setEditingTemplate(true);
    }
  };

  const saveTemplate = async () => {
    if (!selectedTemplate || !templateForm.name) return;
    try {
      if (selectedTemplate.isPreset) {
        const newName = `${templateForm.name} (副本)`;
        const response = await imagePromptApi.duplicateTemplate(selectedTemplate.id, newName);
        setSelectedTemplate(response.data);
      } else {
        const response = await imagePromptApi.updateTemplate(selectedTemplate.id, templateForm);
        setSelectedTemplate(response.data);
      }
      await loadTemplates();
      setEditingTemplate(false);
      setTemplateForm({});
      if (selectedTemplate) {
        updatePreview(selectedTemplate);
      }
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const deleteTemplate = async () => {
    if (!selectedTemplate || selectedTemplate.isPreset) return;
    if (!confirm(`确定要删除模板 "${selectedTemplate.name}" 吗？`)) return;
    try {
      await imagePromptApi.deleteTemplate(selectedTemplate.id);
      setSelectedTemplate(null);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const duplicateTemplate = async () => {
    if (!selectedTemplate) return;
    const newName = prompt('请输入新模板名称:', `${selectedTemplate.name} (副本)`);
    if (!newName) return;
    try {
      const response = await imagePromptApi.duplicateTemplate(selectedTemplate.id, newName);
      setSelectedTemplate(response.data);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  };

  const createTemplate = async () => {
    const name = prompt('请输入新模板名称:');
    if (!name) return;
    try {
      const response = await imagePromptApi.createTemplate({
        name,
        template: '{scene}',
        snippetIds: [],
      });
      setSelectedTemplate(response.data);
      setEditingTemplate(true);
      setTemplateForm({ ...response.data });
      await loadTemplates();
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  };

  const insertVariable = (name: string) => {
    const currentValue = templateForm.template || '';
    setTemplateForm({ ...templateForm, template: currentValue + `{${name}}` });
  };

  const toggleSnippetInTemplate = (snippetId: string) => {
    const currentIds = templateForm.snippetIds || [];
    const newIds = currentIds.includes(snippetId)
      ? currentIds.filter(id => id !== snippetId)
      : [...currentIds, snippetId];
    setTemplateForm({ ...templateForm, snippetIds: newIds });
  };

  const displaySnippet = editingSnippet ? snippetForm : selectedSnippet;
  const displayTemplate = editingTemplate ? templateForm : selectedTemplate;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-blue-500 hover:text-blue-600"
            >
              ← 返回
            </button>
            <h2 className="text-2xl font-bold">图片生成提示词管理</h2>
          </div>
        </div>

        {/* 标签页 */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b">
            <button
              onClick={() => {
                setCurrentTab('snippets');
                setSelectedSnippet(null);
                setSelectedTemplate(null);
              }}
              className={`px-6 py-4 font-medium ${
                currentTab === 'snippets'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              提示词片段
            </button>
            <button
              onClick={() => {
                setCurrentTab('templates');
                setSelectedSnippet(null);
                setSelectedTemplate(null);
              }}
              className={`px-6 py-4 font-medium ${
                currentTab === 'templates'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              提示词模板
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-6">
            加载中...
          </div>
        ) : currentTab === 'snippets' ? (
          <div className="flex gap-6">
            {/* 左侧：片段列表 */}
            <div className="w-64 flex-shrink-0">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-4 text-gray-700">分类</h3>
                <div className="space-y-1 mb-4">
                  {(['all' as const, ...Object.keys(categoryLabels) as PromptSnippetCategory[]]).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        selectedCategory === cat
                          ? 'bg-blue-50 text-blue-600'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {cat === 'all' ? '全部' : categoryLabels[cat]}
                    </button>
                  ))}
                </div>

                <h3 className="font-semibold mb-2 text-gray-700">片段列表</h3>
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">预设</h4>
                  <div className="space-y-1">
                    {presetSnippets.map((snippet) => (
                      <button
                        key={snippet.id}
                        onClick={() => handleSelectSnippet(snippet)}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${
                          selectedSnippet?.id === snippet.id
                            ? 'bg-blue-50 text-blue-600'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        ☑ {snippet.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">我的片段</h4>
                  <div className="space-y-1">
                    {userSnippets.map((snippet) => (
                      <button
                        key={snippet.id}
                        onClick={() => handleSelectSnippet(snippet)}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${
                          selectedSnippet?.id === snippet.id
                            ? 'bg-blue-50 text-blue-600'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {snippet.name}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={createSnippet}
                  className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 text-sm"
                >
                  + 新建片段
                </button>
              </div>
            </div>

            {/* 右侧：片段编辑器 */}
            <div className="flex-1">
              {!displaySnippet ? (
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-gray-500">请选择一个片段</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      名称
                    </label>
                    {editingSnippet ? (
                      <input
                        type="text"
                        value={snippetForm.name || ''}
                        onChange={(e) => setSnippetForm({ ...snippetForm, name: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                        maxLength={100}
                      />
                    ) : (
                      <div className="text-lg font-medium">{displaySnippet.name}</div>
                    )}
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      分类
                    </label>
                    {editingSnippet ? (
                      <select
                        value={snippetForm.category || 'custom'}
                        onChange={(e) => setSnippetForm({ ...snippetForm, category: e.target.value as PromptSnippetCategory })}
                        className="w-full border rounded px-3 py-2"
                      >
                        {(Object.keys(categoryLabels) as PromptSnippetCategory[]).map((cat) => (
                          <option key={cat} value={cat}>{categoryLabels[cat]}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-gray-600">{categoryLabels[displaySnippet.category]}</div>
                    )}
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      描述
                    </label>
                    {editingSnippet ? (
                      <input
                        type="text"
                        value={snippetForm.description || ''}
                        onChange={(e) => setSnippetForm({ ...snippetForm, description: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                      />
                    ) : (
                      <div className="text-gray-600">{displaySnippet.description || '无描述'}</div>
                    )}
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      内容
                    </label>
                    {editingSnippet ? (
                      <textarea
                        value={snippetForm.content || ''}
                        onChange={(e) => setSnippetForm({ ...snippetForm, content: e.target.value })}
                        className="w-full border rounded px-3 py-2 h-32 font-mono text-sm"
                      />
                    ) : (
                      <div className="bg-gray-50 rounded p-3 font-mono text-sm whitespace-pre-wrap">
                        {displaySnippet.content}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {editingSnippet ? (
                      <>
                        <button
                          onClick={saveSnippet}
                          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => {
                            setEditingSnippet(false);
                            setSnippetForm({});
                          }}
                          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        {!selectedSnippet?.isPreset && (
                          <button
                            onClick={startEditSnippet}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                          >
                            编辑
                          </button>
                        )}
                        <button
                          onClick={duplicateSnippet}
                          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                        >
                          复制
                        </button>
                        {!selectedSnippet?.isPreset && (
                          <button
                            onClick={deleteSnippet}
                            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                          >
                            删除
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* 左侧：模板列表 */}
            <div className="w-64 flex-shrink-0">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-4 text-gray-700">模板列表</h3>
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">预设</h4>
                  <div className="space-y-1">
                    {presetTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${
                          selectedTemplate?.id === template.id
                            ? 'bg-blue-50 text-blue-600'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        ☑ {template.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">我的模板</h4>
                  <div className="space-y-1">
                    {userTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${
                          selectedTemplate?.id === template.id
                            ? 'bg-blue-50 text-blue-600'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {template.name}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={createTemplate}
                  className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 text-sm"
                >
                  + 新建模板
                </button>
              </div>
            </div>

            {/* 右侧：模板编辑器 */}
            <div className="flex-1">
              {!displayTemplate ? (
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-gray-500">请选择一个模板</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      名称
                    </label>
                    {editingTemplate ? (
                      <input
                        type="text"
                        value={templateForm.name || ''}
                        onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                        maxLength={100}
                      />
                    ) : (
                      <div className="text-lg font-medium">{displayTemplate.name}</div>
                    )}
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      描述
                    </label>
                    {editingTemplate ? (
                      <input
                        type="text"
                        value={templateForm.description || ''}
                        onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                      />
                    ) : (
                      <div className="text-gray-600">{displayTemplate.description || '无描述'}</div>
                    )}
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      模板字符串
                    </label>
                    {editingTemplate ? (
                      <textarea
                        value={templateForm.template || ''}
                        onChange={(e) => setTemplateForm({ ...templateForm, template: e.target.value })}
                        className="w-full border rounded px-3 py-2 h-32 font-mono text-sm"
                      />
                    ) : (
                      <div className="bg-gray-50 rounded p-3 font-mono text-sm whitespace-pre-wrap">
                        {displayTemplate.template}
                      </div>
                    )}
                  </div>
                  {editingTemplate && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        可用变量
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {['quality', 'lighting', 'composition', 'style', 'scene', 'characters', 'style_prompt', 'custom'].map((v) => (
                          <button
                            key={v}
                            onClick={() => insertVariable(v)}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono"
                          >
                            {'{'}{v}{'}'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      默认片段选择
                    </label>
                    <div className="bg-gray-50 rounded p-3 max-h-48 overflow-y-auto">
                      {snippets.map((snippet) => (
                        <label key={snippet.id} className="flex items-center gap-2 py-1">
                          {editingTemplate ? (
                            <input
                              type="checkbox"
                              checked={(templateForm.snippetIds || []).includes(snippet.id)}
                              onChange={() => toggleSnippetInTemplate(snippet.id)}
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={displayTemplate.snippetIds.includes(snippet.id)}
                              disabled
                            />
                          )}
                          <span className="text-sm">
                            {snippet.name} ({categoryLabels[snippet.category]})
                            {snippet.isPreset && ' ☑'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      预览
                    </label>
                    <div className="bg-gray-50 rounded p-3 font-mono text-sm whitespace-pre-wrap">
                      {previewPrompt || '(选择模板后预览)'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {editingTemplate ? (
                      <>
                        <button
                          onClick={saveTemplate}
                          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => {
                            setEditingTemplate(false);
                            setTemplateForm({});
                          }}
                          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        {!selectedTemplate?.isPreset && (
                          <button
                            onClick={startEditTemplate}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                          >
                            编辑
                          </button>
                        )}
                        <button
                          onClick={duplicateTemplate}
                          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                        >
                          复制
                        </button>
                        {!selectedTemplate?.isPreset && (
                          <button
                            onClick={deleteTemplate}
                            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                          >
                            删除
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImagePromptManager;
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/pages/ImagePromptManager.tsx
git commit -m "feat: add ImagePromptManager page"
```

---

## Task 6: 前端路由和项目编辑器集成

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/ProjectEditor.tsx`

- [ ] **Step 1: 添加路由到 App.tsx**

在 `App.tsx` 中导入并添加路由：

```tsx
import ImagePromptManager from './pages/ImagePromptManager';

// 在 Routes 中添加：
<Route path="/image-prompts" element={<ImagePromptManager />} />
```

- [ ] **Step 2: 在 ProjectEditor 中添加模板选择**

在 ProjectEditor 中，找到分镜的 imagePrompt 编辑区域，添加"使用模板"下拉按钮。

首先导入需要的类型和 API：

```tsx
import { imagePromptApi, type ImagePromptTemplate } from '../services/api';
```

然后在组件中添加状态：

```tsx
const [imageTemplates, setImageTemplates] = useState<ImagePromptTemplate[]>([]);
```

在 useEffect 中加载模板：

```tsx
useEffect(() => {
  loadImageTemplates();
}, []);

const loadImageTemplates = async () => {
  try {
    const response = await imagePromptApi.listTemplates();
    setImageTemplates(response.data);
  } catch (error) {
    console.error('Failed to load image templates:', error);
  }
};
```

添加使用模板的函数：

```tsx
const applyImageTemplate = async (template: ImagePromptTemplate, storyboard: Storyboard) => {
  try {
    // 收集角色提示词
    const charMap = { c.id: c for c in project.characters };
    const characterPrompts = storyboard.characterIds
      .map(cid => charMap[cid]?.characterPrompt)
      .filter(Boolean)
      .join(', ');

    const response = await imagePromptApi.renderTemplate(template.id, {
      scene: storyboard.sceneDescription,
      characterPrompts: characterPrompts || undefined,
      stylePrompt: project.stylePrompt || undefined,
    });

    await storyboardApi.update(project.id, storyboard.id, {
      imagePrompt: response.data.renderedPrompt
    });
    refreshProject();
  } catch (error) {
    console.error('Failed to apply template:', error);
  }
};
```

在分镜的 imagePrompt 编辑区域，在输入框下方添加：

```tsx
<div className="mt-2 flex gap-2">
  <select
    className="flex-1 border rounded px-2 py-1 text-sm"
    defaultValue=""
    onChange={(e) => {
      const template = imageTemplates.find(t => t.id === e.target.value);
      if (template) {
        applyImageTemplate(template, storyboard);
        e.target.value = '';
      }
    }}
  >
    <option value="">-- 使用模板 --</option>
    {imageTemplates.map((template) => (
      <option key={template.id} value={template.id}>
        {template.name} {template.isPreset ? '(预设)' : ''}
      </option>
    ))}
  </select>
  <button
    onClick={() => generateSinglePrompt(storyboard.id)}
    className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600"
  >
    重新生成
  </button>
</div>
```

同时在页面顶部导航添加"提示词管理"入口：

```tsx
<div className="flex items-center gap-4">
  <button
    onClick={() => navigate('/')}
    className="text-blue-500 hover:text-blue-600"
  >
    ← 返回
  </button>
  <h1 className="text-2xl font-bold">{project.name}</h1>
  <a
    href="/image-prompts"
    target="_blank"
    rel="noopener noreferrer"
    className="text-blue-500 hover:text-blue-600 text-sm ml-auto"
  >
    提示词管理 →
  </a>
</div>
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/App.tsx frontend/src/pages/ProjectEditor.tsx
git commit -m "feat: integrate image prompt templates in ProjectEditor"
```

---

## Task 7: 测试和提交

- [ ] **Step 1: 启动后端测试**

```bash
cd backend
source venv/bin/activate
python main.py
```

检查：
- 服务器启动成功
- 访问 http://localhost:8000/docs 查看新端点

- [ ] **Step 2: 启动前端测试**

```bash
cd frontend
npm run dev
```

检查：
- 前端启动成功
- 访问 /image-prompts 页面正常显示
- 可以创建/编辑/删除片段和模板
- 在项目编辑器中可以使用模板

- [ ] **Step 3: 最终提交**

```bash
git status
# 确认所有改动都已提交
```

---

## 总结

这个计划涵盖了：
1. 后端数据模型
2. ImagePromptManager 管理器（含预设数据）
3. API 端点
4. 前端类型和 API 方法
5. ImagePromptManager 管理页面
6. 路由和项目编辑器集成
7. 测试验证

每个任务都是独立可测试的，按顺序执行即可。
