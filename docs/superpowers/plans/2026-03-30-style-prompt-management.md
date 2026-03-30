# 风格提示词管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现风格提示词独立管理功能，包括列表式编辑、大模型仿写、测试生图等

**Architecture:** 新建独立的 StylePromptManager，基于 txt 文件存储，集成到现有提示词管理页面

**Tech Stack:** FastAPI, React + TypeScript, Ollama/OpenAI, ComfyUI

---

## 文件结构概览

| 文件 | 操作 | 用途 |
|------|------|------|
| `backend/models/schemas.py` | 修改 | 添加风格提示词数据模型 |
| `backend/core/style_prompt_manager.py` | 新建 | 风格提示词管理器 |
| `backend/api/style_prompts.py` | 新建 | 风格提示词 API |
| `backend/main.py` | 修改 | 注册 style_prompts 路由 |
| `frontend/src/services/api.ts` | 修改 | 添加风格提示词 API 类型和方法 |
| `frontend/src/pages/PromptManager.tsx` | 修改 | 添加风格提示词标签页 |

---

## Task 1: 后端数据模型

**Files:**
- Modify: `backend/models/schemas.py`

**先读取现有文件了解结构：**

- [ ] **Step 1: Read existing schemas.py**

Read: `backend/models/schemas.py`

- [ ] **Step 2: Add style prompt models to schemas.py**

在文件末尾添加以下内容：

```python
class StylePromptList(BaseModel):
    styleName: str
    fileName: str
    prompts: List[str]


class CreateStyleRequest(BaseModel):
    styleName: str = Field(..., min_length=1, max_length=100)


class RenameStyleRequest(BaseModel):
    newStyleName: str = Field(..., min_length=1, max_length=100)


class AddPromptRequest(BaseModel):
    prompt: str = Field(..., min_length=1)


class UpdatePromptRequest(BaseModel):
    prompt: str = Field(..., min_length=1)


class BatchAppendPromptsRequest(BaseModel):
    prompts: List[str]


class ParaphraseRequest(BaseModel):
    originalPrompt: str = Field(..., min_length=1)
    count: int = Field(..., ge=1, le=20)
    requirement: str = ""


class ParaphraseResponse(BaseModel):
    generatedPrompts: List[str]


class TestImageRequest(BaseModel):
    prompt: str = Field(..., min_length=1)


class TestImageResponse(BaseModel):
    filename: str
```

- [ ] **Step 3: Verify imports**

确保文件顶部有这些 import：
```python
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
```

- [ ] **Step 4: Commit**

```bash
git add backend/models/schemas.py
git commit -m "feat: add style prompt data models"
```

---

## Task 2: 创建 StylePromptManager 核心类

**Files:**
- Create: `backend/core/style_prompt_manager.py`

- [ ] **Step 1: Create style_prompt_manager.py with basic structure**

```python
import json
import logging
from pathlib import Path
from typing import List, Optional, Tuple
from datetime import datetime
import uuid
import re

from config import settings
from models.schemas import StylePromptList

logger = logging.getLogger(__name__)


def _chinese_to_pinyin(text: str) -> str:
    """简单的中文转拼音/英文映射"""
    # 预定义常见风格名称映射
    mapping = {
        "动漫风格": "anime_style",
        "写实风格": "photorealistic",
        "古风武侠": "wuxia_style",
        "通用风格": "general_style",
        "电影风格": "cinematic_style",
        "水彩风格": "watercolor_style",
        "油画风格": "oil_painting_style",
        "像素风格": "pixel_style",
        "3D渲染": "3d_render",
    }
    if text in mapping:
        return mapping[text]
    #  fallback: 移除非字母数字，空格转下划线，转小写
    simplified = re.sub(r'[^\w\s]', '', text)
    simplified = re.sub(r'\s+', '_', simplified)
    return simplified.lower() or "style"


class StylePromptManager:
    def __init__(self):
        self.style_dir = Path(settings.style_prompts_path)
        self.tmp_dir = Path(settings.data_dir) / "tmp"
        self._mapping_file = self.style_dir / "_mapping.json"
        self._ensure_dirs()
        self._style_mapping = self._load_mapping()

    def _ensure_dirs(self):
        self.style_dir.mkdir(parents=True, exist_ok=True)
        self.tmp_dir.mkdir(parents=True, exist_ok=True)

    def _load_mapping(self) -> Dict[str, str]:
        """加载风格名称到文件名的映射"""
        if self._mapping_file.exists():
            try:
                return json.loads(self._mapping_file.read_text(encoding='utf-8'))
            except Exception as e:
                logger.error(f"Failed to load style mapping: {e}")
        return {}

    def _save_mapping(self):
        """保存映射"""
        self._mapping_file.write_text(
            json.dumps(self._style_mapping, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )

    def _get_file_path(self, style_name: str) -> Optional[Path]:
        """获取风格文件路径"""
        if style_name not in self._style_mapping:
            return None
        return self.style_dir / self._style_mapping[style_name]

    def _read_prompts(self, file_path: Path) -> List[str]:
        """读取提示词文件，返回非空行列表"""
        if not file_path.exists():
            return []
        try:
            lines = file_path.read_text(encoding='utf-8').splitlines()
            return [line.strip() for line in lines if line.strip()]
        except Exception as e:
            logger.error(f"Failed to read prompts from {file_path}: {e}")
            return []

    def _write_prompts(self, file_path: Path, prompts: List[str]):
        """写入提示词文件"""
        file_path.write_text('\n'.join(prompts) + '\n', encoding='utf-8')

    # ===== 风格管理 =====
    def list_styles(self) -> List[StylePromptList]:
        """列出所有风格"""
        result = []
        for style_name, file_name in self._style_mapping.items():
            file_path = self.style_dir / file_name
            prompts = self._read_prompts(file_path)
            result.append(StylePromptList(
                styleName=style_name,
                fileName=file_name,
                prompts=prompts
            ))
        # 按风格名称排序
        result.sort(key=lambda x: x.styleName)
        return result

    def create_style(self, style_name: str) -> StylePromptList:
        """创建新风格"""
        if style_name in self._style_mapping:
            raise ValueError(f"Style '{style_name}' already exists")

        file_name = _chinese_to_pinyin(style_name)
        # 确保文件名唯一
        base_name = file_name
        counter = 1
        while (self.style_dir / f"{file_name}.txt").exists():
            file_name = f"{base_name}_{counter}"
            counter += 1
        file_name += ".txt"

        # 创建空文件
        file_path = self.style_dir / file_name
        file_path.touch()

        # 更新映射
        self._style_mapping[style_name] = file_name
        self._save_mapping()

        return StylePromptList(
            styleName=style_name,
            fileName=file_name,
            prompts=[]
        )

    def rename_style(self, old_name: str, new_name: str) -> StylePromptList:
        """重命名风格"""
        if old_name not in self._style_mapping:
            raise ValueError(f"Style '{old_name}' not found")
        if new_name in self._style_mapping and new_name != old_name:
            raise ValueError(f"Style '{new_name}' already exists")

        file_name = self._style_mapping.pop(old_name)
        self._style_mapping[new_name] = file_name
        self._save_mapping()

        prompts = self._read_prompts(self.style_dir / file_name)
        return StylePromptList(
            styleName=new_name,
            fileName=file_name,
            prompts=prompts
        )

    def delete_style(self, style_name: str) -> bool:
        """删除风格"""
        if style_name not in self._style_mapping:
            return False

        file_name = self._style_mapping[style_name]
        file_path = self.style_dir / file_name

        # 删除文件
        if file_path.exists():
            file_path.unlink()

        # 更新映射
        del self._style_mapping[style_name]
        self._save_mapping()

        return True

    # ===== 提示词管理 =====
    def get_prompts(self, style_name: str) -> List[str]:
        """获取风格下的所有提示词"""
        file_path = self._get_file_path(style_name)
        if not file_path:
            raise ValueError(f"Style '{style_name}' not found")
        return self._read_prompts(file_path)

    def add_prompt(self, style_name: str, prompt: str) -> List[str]:
        """添加新提示词"""
        file_path = self._get_file_path(style_name)
        if not file_path:
            raise ValueError(f"Style '{style_name}' not found")

        prompts = self._read_prompts(file_path)
        prompts.append(prompt.strip())
        self._write_prompts(file_path, prompts)
        return prompts

    def update_prompt(self, style_name: str, index: int, new_prompt: str) -> List[str]:
        """修改提示词（按索引）"""
        file_path = self._get_file_path(style_name)
        if not file_path:
            raise ValueError(f"Style '{style_name}' not found")

        prompts = self._read_prompts(file_path)
        if index < 0 or index >= len(prompts):
            raise ValueError(f"Index {index} out of range")

        prompts[index] = new_prompt.strip()
        self._write_prompts(file_path, prompts)
        return prompts

    def delete_prompt(self, style_name: str, index: int) -> List[str]:
        """删除提示词（按索引）"""
        file_path = self._get_file_path(style_name)
        if not file_path:
            raise ValueError(f"Style '{style_name}' not found")

        prompts = self._read_prompts(file_path)
        if index < 0 or index >= len(prompts):
            raise ValueError(f"Index {index} out of range")

        prompts.pop(index)
        self._write_prompts(file_path, prompts)
        return prompts

    def batch_append_prompts(self, style_name: str, prompts: List[str]) -> List[str]:
        """批量追加提示词"""
        file_path = self._get_file_path(style_name)
        if not file_path:
            raise ValueError(f"Style '{style_name}' not found")

        existing = self._read_prompts(file_path)
        existing.extend([p.strip() for p in prompts if p.strip()])
        self._write_prompts(file_path, existing)
        return existing


style_prompt_manager = StylePromptManager()
```

- [ ] **Step 2: Commit**

```bash
git add backend/core/style_prompt_manager.py
git commit -m "feat: add StylePromptManager core class"
```

---

## Task 3: 添加仿写和测试生图功能

**Files:**
- Modify: `backend/core/style_prompt_manager.py`

- [ ] **Step 1: Add paraphrase and test image methods to StylePromptManager**

在文件末尾的 `style_prompt_manager = StylePromptManager()` 之前添加：

```python
    # ===== 仿写功能 =====
    async def paraphrase_prompt(
        self,
        original: str,
        count: int,
        requirement: str
    ) -> List[str]:
        """大模型仿写提示词"""
        from core.ollama import ollama_client
        from core.openai_client import openai_client
        from config import settings

        system_prompt = """你是一个专业的 AI 绘画提示词工程师。
请根据以下原始提示词，生成 {count} 个类似但不同的提示词。

原始提示词：
{original_prompt}

额外要求：
{requirement}

请只返回提示词列表，每行一个，不要任何解释。"""

        user_prompt = system_prompt.format(
            count=count,
            original_prompt=original,
            requirement=requirement or "无额外要求，只要类似但有变化"
        )

        # 尝试使用 Ollama，失败则用 OpenAI
        try:
            result = await ollama_client.generate(
                system_prompt="",
                user_prompt=user_prompt,
                model=settings.ollama_model
            )
        except Exception as e:
            logger.warning(f"Ollama failed, trying OpenAI: {e}")
            result = await openai_client.generate(
                system_prompt="",
                user_prompt=user_prompt
            )

        # 解析结果，按行分割，过滤空行
        lines = [line.strip() for line in result.splitlines() if line.strip()]
        # 只返回前 count 个
        return lines[:count]

    # ===== 测试生图功能 =====
    async def test_generate_image(self, prompt: str) -> str:
        """测试提示词生图，返回文件名"""
        from core.comfyui import ComfyUIClient

        # 使用简单的通用场景 + 风格提示词
        full_prompt = f"1girl, simple background, {prompt}"

        # 生成图片
        comfyui = ComfyUIClient()
        image_data = await comfyui.generate_image(
            prompt=full_prompt,
            width=512,
            height=512,
            seed=int(datetime.now().timestamp()) % 1000000
        )

        # 保存到 tmp 目录
        filename = f"test_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}.png"
        file_path = self.tmp_dir / filename
        file_path.write_bytes(image_data)

        return filename
```

- [ ] **Step 2: Commit**

```bash
git add backend/core/style_prompt_manager.py
git commit -m "feat: add paraphrase and test image functionality"
```

---

## Task 4: 创建风格提示词 API

**Files:**
- Create: `backend/api/style_prompts.py`

- [ ] **Step 1: Read image_prompts.py for reference**

Read: `backend/api/image_prompts.py`

- [ ] **Step 2: Create style_prompts.py**

```python
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


# Add logger import
import logging
logger = logging.getLogger(__name__)
```

- [ ] **Step 3: Commit**

```bash
git add backend/api/style_prompts.py
git commit -m "feat: add style prompts API endpoints"
```

---

## Task 5: 注册路由

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Read main.py**

Read: `backend/main.py`

- [ ] **Step 2: Add style_prompts router**

在 import 部分添加：
```python
from api import style_prompts
```

在 `app.include_router()` 部分添加：
```python
app.include_router(style_prompts.router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: register style prompts router"
```

---

## Task 6: 前端 API 类型和方法

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Read existing api.ts**

Read: `frontend/src/services/api.ts`

- [ ] **Step 2: Add style prompt types**

```typescript
export interface StylePromptList {
  styleName: string;
  fileName: string;
  prompts: string[];
}

export interface ParaphraseRequest {
  originalPrompt: string;
  count: number;
  requirement: string;
}

export interface ParaphraseResponse {
  generatedPrompts: string[];
}

export interface TestImageRequest {
  prompt: string;
}

export interface TestImageResponse {
  filename: string;
}
```

- [ ] **Step 3: Add style prompt API methods**

```typescript
export const stylePromptsApi = {
  // Style management
  listStyles: () => axios.get<StylePromptList[]>('/api/style-prompts/styles'),
  createStyle: (styleName: string) => axios.post<StylePromptList>('/api/style-prompts/styles', { styleName }),
  renameStyle: (oldName: string, newName: string) =>
    axios.put<StylePromptList>(`/api/style-prompts/styles/${encodeURIComponent(oldName)}`, { newStyleName: newName }),
  deleteStyle: (styleName: string) => axios.delete(`/api/style-prompts/styles/${encodeURIComponent(styleName)}`),

  // Prompt management
  getPrompts: (styleName: string) => axios.get<string[]>(`/api/style-prompts/styles/${encodeURIComponent(styleName)}/prompts`),
  addPrompt: (styleName: string, prompt: string) =>
    axios.post<string[]>(`/api/style-prompts/styles/${encodeURIComponent(styleName)}/prompts`, { prompt }),
  updatePrompt: (styleName: string, index: number, prompt: string) =>
    axios.put<string[]>(`/api/style-prompts/styles/${encodeURIComponent(styleName)}/prompts/${index}`, { prompt }),
  deletePrompt: (styleName: string, index: number) =>
    axios.delete<string[]>(`/api/style-prompts/styles/${encodeURIComponent(styleName)}/prompts/${index}`),
  batchAppendPrompts: (styleName: string, prompts: string[]) =>
    axios.post<string[]>(`/api/style-prompts/styles/${encodeURIComponent(styleName)}/prompts/batch`, { prompts }),

  // Paraphrase
  paraphrase: (data: ParaphraseRequest) => axios.post<ParaphraseResponse>('/api/style-prompts/paraphrase', data),

  // Test image
  testImage: (prompt: string) => axios.post<TestImageResponse>('/api/style-prompts/test-image', { prompt }),
  getTestImageUrl: (filename: string) => `/api/style-prompts/test-image/${encodeURIComponent(filename)}`,
};
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add style prompts frontend API types and methods"
```

---

## Task 7: 前端 UI - 风格提示词标签页

**Files:**
- Modify: `frontend/src/pages/PromptManager.tsx`

- [ ] **Step 1: Read existing PromptManager.tsx**

Read: `frontend/src/pages/PromptManager.tsx`

- [ ] **Step 2: Add style prompt tab UI**

这是一个较大的修改，主要包括：

1. 添加新的状态管理
2. 添加风格提示词标签页
3. 实现风格列表、提示词列表
4. 实现仿写弹窗、测试生图弹窗

**关键实现要点：**
- 使用现有的 Tab 组件模式
- 添加风格选择侧边栏
- 添加提示词列表（带编辑/删除/测试按钮）
- 添加模态框组件（仿写、测试生图）

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PromptManager.tsx
git commit -m "feat: add style prompts UI tab"
```

---

## Task 8: 测试和验证

**Files:**
- All files

- [ ] **Step 1: Start backend server**

```bash
cd backend
source venv/bin/activate
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Expected: Server starts without errors

- [ ] **Step 2: Test API endpoints manually**

Use curl or browser to test:
- `GET http://localhost:8000/api/style-prompts/styles`
- `POST http://localhost:8000/api/style-prompts/styles` with `{"styleName": "测试风格"}`

- [ ] **Step 3: Test frontend**

```bash
cd frontend
npm run dev
```

Navigate to Prompt Manager page, verify:
- New "风格提示词" tab exists
- Can create/rename/delete styles
- Can add/edit/delete prompts
- Paraphrase and test image buttons work

- [ ] **Step 4: Final commit**

```bash
git status
# Review all changes
git add [any missing files]
git commit -m "feat: complete style prompt management feature"
```

---

## 计划完成检查

对照设计文档检查：

| Spec Requirement | Status |
|------------------|--------|
| StylePromptManager created | ✅ Task 2 |
| CRUD for styles | ✅ Task 2 |
| CRUD for prompts by line | ✅ Task 2 |
| Paraphrase with LLM | ✅ Task 3 |
| Test image with ComfyUI | ✅ Task 3 |
| API endpoints | ✅ Task 4 |
| Frontend UI integration | ✅ Task 7 |

**无遗漏项！**
