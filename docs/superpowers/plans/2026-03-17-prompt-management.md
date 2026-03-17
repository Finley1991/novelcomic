# Prompt 管理功能实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 NovelComic 应用添加完整的 Prompt 模板管理功能，支持自定义角色提取、分镜拆分、图像生成的提示词，提供预设模板和友好的 UI 编辑体验。

**Architecture:** 新增 PromptTemplate 数据模型和 PromptTemplateManager 管理类，新增 API 路由，更新 LLM 客户端支持模板加载和变量替换，新增前端 PromptManager 页面，更新 Settings 和 ProjectEditor 页面。

**Tech Stack:** FastAPI + Pydantic (后端), React + TypeScript + Tailwind CSS (前端)

---

## 文件清单

**新增文件：**
- `backend/core/prompt_templates.py` - Prompt 模板管理核心类
- `backend/api/prompts.py` - Prompt API 路由
- `frontend/src/pages/PromptManager.tsx` - Prompt 模板管理页面

**修改文件：**
- `backend/models/schemas.py` - 添加 PromptType, PromptVariable, PromptTemplate，更新 GlobalSettings, Project
- `backend/core/storage.py` - 添加模板存储支持
- `backend/api/generation.py` - 更新以传递项目/全局设置
- `backend/core/ollama.py` - 集成模板系统
- `backend/core/openai_client.py` - 集成模板系统
- `backend/main.py` - 注册 prompts 路由
- `frontend/src/services/api.ts` - 添加类型定义和 API 方法
- `frontend/src/pages/Settings.tsx` - 添加 Prompt 模板标签页
- `frontend/src/pages/ProjectEditor.tsx` - 添加项目级 Prompt 模板选择

---

## Task 1: 后端数据模型

**Files:**
- Modify: `backend/models/schemas.py`

- [ ] **Step 1: 添加 PromptType 枚举**

在文件顶部的 Enum 定义区域添加：

```python
class PromptType(str, Enum):
    CHARACTER_EXTRACTION = "character_extraction"
    STORYBOARD_SPLIT = "storyboard_split"
    IMAGE_PROMPT = "image_prompt"
```

- [ ] **Step 2: 添加 PromptVariable 模型**

在 MotionConfig 之后添加：

```python
class PromptVariable(BaseModel):
    name: str
    description: str
    example: str
```

- [ ] **Step 3: 添加 PromptTemplate 模型**

在 PromptVariable 之后添加：

```python
class PromptTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    type: PromptType
    systemPrompt: str = ""
    userPrompt: str = ""
    isPreset: bool = False
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)
```

- [ ] **Step 4: 更新 GlobalSettings 模型**

找到 GlobalSettings 类，在 comfyui 字段之前添加：

```python
    defaultPromptTemplates: Dict[PromptType, str] = Field(default_factory=dict)
```

- [ ] **Step 5: 更新 Project 模型**

找到 Project 类，在 negativePrompt 字段之后添加：

```python
    useCustomPrompts: bool = False
    projectPromptTemplates: Dict[PromptType, str] = Field(default_factory=dict)
```

- [ ] **Step 6: 验证修改**

阅读完整文件，确保没有语法错误，新增内容与现有风格一致

---

## Task 2: 后端 PromptTemplateManager 核心类

**Files:**
- Create: `backend/core/prompt_templates.py`

- [ ] **Step 1: 创建文件框架**

```python
import json
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from pathlib import Path
import logging

from config import settings
from models.schemas import (
    PromptTemplate, PromptType, PromptVariable
)

logger = logging.getLogger(__name__)
```

- [ ] **Step 2: 添加预设模板定义**

```python
# 预设模板定义
def _get_preset_templates() -> List[PromptTemplate]:
    now = datetime.now()
    return [
        # ========== 角色提取预设 ==========
        PromptTemplate(
            id="preset_character_extraction_1",
            name="通用版",
            description="通用的角色提取模板，适合大多数小说",
            type=PromptType.CHARACTER_EXTRACTION,
            systemPrompt="你是一个专业的小说角色提取助手。从小说文本中提取所有主要角色。",
            userPrompt="""从以下小说文本中提取所有主要角色。对每个角色提供：
1. name: 姓名
2. description: 外貌描述
3. personality: 性格特点

仅返回JSON数组，格式如下：
[
  {{
    "name": "角色名",
    "description": "外貌描述",
    "personality": "性格特点"
  }}
]

小说文本：
{chunk}
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_character_extraction_2",
            name="动漫风格",
            description="注重动漫化视觉特征的角色提取",
            type=PromptType.CHARACTER_EXTRACTION,
            systemPrompt="你是一个专业的动漫角色设计助手。从小说文本中提取角色，注重动漫化的视觉特征。",
            userPrompt="""从以下小说文本中提取所有主要角色，以动漫风格进行描述。对每个角色提供：
1. name: 姓名
2. description: 外貌描述（包括发色、瞳色、发型、服装风格等动漫特征）
3. personality: 性格特点

仅返回JSON数组，格式如下：
[
  {{
    "name": "角色名",
    "description": "外貌描述，包含动漫特征",
    "personality": "性格特点"
  }}
]

小说文本：
{chunk}
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_character_extraction_3",
            name="写实风格",
            description="注重真实人物描写的角色提取",
            type=PromptType.CHARACTER_EXTRACTION,
            systemPrompt="你是一个专业的角色分析助手。从小说文本中提取角色，注重真实的人物描写。",
            userPrompt="""从以下小说文本中提取所有主要角色，以写实风格进行描述。对每个角色提供：
1. name: 姓名
2. description: 外貌描述（包括真实的年龄特征、气质、身材等）
3. personality: 性格特点

仅返回JSON数组，格式如下：
[
  {{
    "name": "角色名",
    "description": "真实的外貌描述",
    "personality": "性格特点"
  }}
]

小说文本：
{chunk}
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_character_extraction_4",
            name="古风/武侠",
            description="适合古风/武侠小说的角色提取",
            type=PromptType.CHARACTER_EXTRACTION,
            systemPrompt="你是一个专业的古风小说角色设计助手。从小说文本中提取武侠/古风角色。",
            userPrompt="""从以下小说文本中提取所有主要角色，以古风/武侠风格进行描述。对每个角色提供：
1. name: 姓名
2. description: 外貌描述（包括古风服饰、发型、武器、门派特征等）
3. personality: 性格特点

仅返回JSON数组，格式如下：
[
  {{
    "name": "角色名",
    "description": "古风外貌描述",
    "personality": "性格特点"
  }}
]

小说文本：
{chunk}
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),

        # ========== 分镜拆分预设 ==========
        PromptTemplate(
            id="preset_storyboard_split_1",
            name="通用版",
            description="通用的分镜拆分模板",
            type=PromptType.STORYBOARD_SPLIT,
            systemPrompt="你是一个专业的漫剧分镜师。将小说拆分为多个分镜。",
            userPrompt="""{characters}

将以下小说文本拆分为多个分镜。每个分镜应该有3-5秒的画面时长。

对每个分镜提供：
1. index: 序号（从{current_index}开始）
2. sceneDescription: 画面描述（详细的视觉描述，用于AI绘画）
3. dialogue: 角色台词（如果有）
4. narration: 旁白（如果有）
5. characterNames: 出现的角色名数组

仅返回JSON数组，格式如下：
[
  {{
    "index": 0,
    "sceneDescription": "画面描述...",
    "dialogue": "台词",
    "narration": "旁白",
    "characterNames": ["角色1", "角色2"]
  }}
]

小说文本：
{chunk}
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_storyboard_split_2",
            name="动漫风格",
            description="注重动漫视觉效果的分镜拆分",
            type=PromptType.STORYBOARD_SPLIT,
            systemPrompt="你是一个专业的动漫分镜师。将小说拆分为适合动漫表现的分镜。",
            userPrompt="""{characters}

将以下小说文本拆分为多个动漫分镜。每个分镜应该有3-5秒的画面时长。
注重：
- 画面的视觉冲击力
- 角色表情特写
- 动漫典型构图（低角度、大特写、动态模糊等）
- 动态感和表现力

对每个分镜提供：
1. index: 序号（从{current_index}开始）
2. sceneDescription: 画面描述（详细的动漫风格视觉描述）
3. dialogue: 角色台词（如果有）
4. narration: 旁白（如果有）
5. characterNames: 出现的角色名数组

仅返回JSON数组，格式如下：
[
  {{
    "index": 0,
    "sceneDescription": "画面描述...",
    "dialogue": "台词",
    "narration": "旁白",
    "characterNames": ["角色1", "角色2"]
  }}
]

小说文本：
{chunk}
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_storyboard_split_3",
            name="写实风格",
            description="注重电影感的分镜拆分",
            type=PromptType.STORYBOARD_SPLIT,
            systemPrompt="你是一个专业的电影分镜师。将小说拆分为适合电影表现的分镜。",
            userPrompt="""{characters}

将以下小说文本拆分为多个电影分镜。每个分镜应该有3-5秒的画面时长。
注重：
- 真实场景描写
- 光影效果（cinematic lighting）
- 摄影构图（三分法、景深等）
- 真实的镜头语言

对每个分镜提供：
1. index: 序号（从{current_index}开始）
2. sceneDescription: 画面描述（详细的电影风格视觉描述）
3. dialogue: 角色台词（如果有）
4. narration: 旁白（如果有）
5. characterNames: 出现的角色名数组

仅返回JSON数组，格式如下：
[
  {{
    "index": 0,
    "sceneDescription": "画面描述...",
    "dialogue": "台词",
    "narration": "旁白",
    "characterNames": ["角色1", "角色2"]
  }}
]

小说文本：
{chunk}
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_storyboard_split_4",
            name="古风/武侠",
            description="适合古风/武侠的分镜拆分",
            type=PromptType.STORYBOARD_SPLIT,
            systemPrompt="你是一个专业的武侠剧分镜师。将小说拆分为适合武侠/古风表现的分镜。",
            userPrompt="""{characters}

将以下小说文本拆分为多个武侠/古风分镜。每个分镜应该有3-5秒的画面时长。
注重：
- 古风场景（古建筑、山水、园林等）
- 武侠动作描写
- 古风构图和意境
- 武器和招式的视觉表现

对每个分镜提供：
1. index: 序号（从{current_index}开始）
2. sceneDescription: 画面描述（详细的古风/武侠风格视觉描述）
3. dialogue: 角色台词（如果有）
4. narration: 旁白（如果有）
5. characterNames: 出现的角色名数组

仅返回JSON数组，格式如下：
[
  {{
    "index": 0,
    "sceneDescription": "画面描述...",
    "dialogue": "台词",
    "narration": "旁白",
    "characterNames": ["角色1", "角色2"]
  }}
]

小说文本：
{chunk}
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),

        # ========== 图像生成预设 ==========
        PromptTemplate(
            id="preset_image_prompt_1",
            name="通用版",
            description="通用的图像生成提示词模板",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="你是一个专业的AI绘画提示词工程师。将画面描述转换为Stable Diffusion提示词。",
            userPrompt="""{characters}
风格提示词：{style_prompt}

将以下画面描述转换为详细的Stable Diffusion英文提示词。要求：
- 详细的视觉描述
- 包含光影、氛围、构图等元素
- 使用英文

画面描述：
{scene_description}

仅返回提示词内容，不要其他说明。
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_image_prompt_2",
            name="动漫风格",
            description="动漫风格的图像生成",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="你是一个专业的动漫AI绘画提示词工程师。将画面描述转换为动漫风格的Stable Diffusion提示词。",
            userPrompt="""{characters}
风格提示词：{style_prompt}

将以下画面描述转换为详细的Stable Diffusion英文提示词。要求：
- 动漫风格 (anime style, cel shading)
- 鲜艳的色彩 (vibrant colors)
- 详细的视觉描述
- 包含光影、氛围、构图等元素
- 使用英文

画面描述：
{scene_description}

仅返回提示词内容，不要其他说明。请在开头自动添加 "anime style, cel shading, vibrant colors, "。
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_image_prompt_3",
            name="写实风格",
            description="写实风格的图像生成",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="你是一个专业的写实摄影提示词工程师。将画面描述转换为写实风格的Stable Diffusion提示词。",
            userPrompt="""{characters}
风格提示词：{style_prompt}

将以下画面描述转换为详细的Stable Diffusion英文提示词。要求：
- 写实风格 (photorealistic)
- 电影光感 (cinematic lighting)
- 锐焦 (sharp focus)
- 详细的视觉描述
- 包含光影、氛围、构图等元素
- 使用英文

画面描述：
{scene_description}

仅返回提示词内容，不要其他说明。请在开头自动添加 "photorealistic, cinematic lighting, sharp focus, ultra detailed, "。
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_image_prompt_4",
            name="古风/武侠",
            description="古风/武侠风格的图像生成",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="你是一个专业的古风绘画提示词工程师。将画面描述转换为古风/武侠风格的Stable Diffusion提示词。",
            userPrompt="""{characters}
风格提示词：{style_prompt}

将以下画面描述转换为详细的Stable Diffusion英文提示词。要求：
- 中国传统艺术风格 (traditional Chinese art)
- 武侠风格 (wuxia)
- 水墨效果 (ink painting)
- 详细的视觉描述
- 包含古风建筑、服饰、山水等元素
- 使用英文

画面描述：
{scene_description}

仅返回提示词内容，不要其他说明。请在开头自动添加 "traditional Chinese art, wuxia style, ink painting, "。
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
    ]
```

- [ ] **Step 3: 添加变量定义**

```python
def _get_variables_for_type(prompt_type: PromptType) -> List[PromptVariable]:
    if prompt_type == PromptType.CHARACTER_EXTRACTION:
        return [
            PromptVariable(
                name="chunk",
                description="当前处理的小说文本片段",
                example="第一章 初遇..."
            )
        ]
    elif prompt_type == PromptType.STORYBOARD_SPLIT:
        return [
            PromptVariable(
                name="chunk",
                description="当前处理的小说文本片段",
                example="第一章 初遇..."
            ),
            PromptVariable(
                name="characters",
                description="角色列表信息",
                example="角色：\n- 张三：..."
            ),
            PromptVariable(
                name="current_index",
                description="当前分镜起始序号",
                example="0"
            )
        ]
    elif prompt_type == PromptType.IMAGE_PROMPT:
        return [
            PromptVariable(
                name="scene_description",
                description="分镜画面描述",
                example="森林中的小屋..."
            ),
            PromptVariable(
                name="characters",
                description="角色提示词列表",
                example="角色提示词：\n- 张三：..."
            ),
            PromptVariable(
                name="style_prompt",
                description="风格提示词",
                example="anime style..."
            )
        ]
    return []
```

- [ ] **Step 4: 创建 PromptTemplateManager 类**

```python
class PromptTemplateManager:
    def __init__(self):
        self._storage_file = settings.data_dir / "prompt_templates.json"
        self._presets = {t.id: t for t in _get_preset_templates()}
        self._user_templates = self._load_user_templates()

    def _load_user_templates(self) -> Dict[str, PromptTemplate]:
        if not self._storage_file.exists():
            return {}
        try:
            data = json.loads(self._storage_file.read_text())
            templates = {}
            for t_data in data:
                if not t_data.get("isPreset", False):
                    t_data["type"] = PromptType(t_data["type"])
                    templates[t_data["id"]] = PromptTemplate(**t_data)
            return templates
        except Exception as e:
            logger.error(f"Failed to load user templates: {e}")
            return {}

    def _save_user_templates(self):
        data = [t.model_dump() for t in self._user_templates.values()]
        self._storage_file.parent.mkdir(parents=True, exist_ok=True)
        self._storage_file.write_text(json.dumps(data, ensure_ascii=False, indent=2))

    def load_all_templates(self, prompt_type: Optional[PromptType] = None) -> List[PromptTemplate]:
        all_templates = list(self._presets.values()) + list(self._user_templates.values())
        if prompt_type:
            all_templates = [t for t in all_templates if t.type == prompt_type]
        return sorted(all_templates, key=lambda t: (not t.isPreset, t.name))

    def get_template(self, template_id: str) -> Optional[PromptTemplate]:
        if template_id in self._presets:
            return self._presets[template_id]
        return self._user_templates.get(template_id)

    def get_preset_by_id(self, preset_id: str) -> Optional[PromptTemplate]:
        return self._presets.get(preset_id)

    def save_template(self, template: PromptTemplate) -> PromptTemplate:
        if template.isPreset:
            raise ValueError("Cannot modify preset templates")
        template.updatedAt = datetime.now()
        self._user_templates[template.id] = template
        self._save_user_templates()
        return template

    def get_template_usages(self, template_id: str) -> List[str]:
        usages = []
        try:
            from core.storage import storage
            global_settings = storage.load_global_settings()
            for prompt_type, tid in global_settings.defaultPromptTemplates.items():
                if tid == template_id:
                    usages.append(f"全局设置: {prompt_type.value}")

            for project in storage.list_projects():
                if project.useCustomPrompts:
                    for prompt_type, tid in project.projectPromptTemplates.items():
                        if tid == template_id:
                            usages.append(f"项目 [{project.name}]: {prompt_type.value}")
        except Exception as e:
            logger.error(f"Failed to check template usages: {e}")
        return usages

    def delete_template(self, template_id: str, cascade: bool = False) -> Tuple[bool, List[str]]:
        if template_id in self._presets:
            raise ValueError("Cannot delete preset templates")
        if template_id not in self._user_templates:
            return False, []

        usages = self.get_template_usages(template_id)
        if usages and not cascade:
            return False, usages

        if cascade and usages:
            try:
                from core.storage import storage
                global_settings = storage.load_global_settings()
                for prompt_type, tid in list(global_settings.defaultPromptTemplates.items()):
                    if tid == template_id:
                        del global_settings.defaultPromptTemplates[prompt_type]
                storage.save_global_settings(global_settings)

                for project in storage.list_projects():
                    if project.useCustomPrompts:
                        updated = False
                        for prompt_type, tid in list(project.projectPromptTemplates.items()):
                            if tid == template_id:
                                del project.projectPromptTemplates[prompt_type]
                                updated = True
                        if updated:
                            storage.save_project(project)
            except Exception as e:
                logger.error(f"Failed to cascade template deletion: {e}")

        del self._user_templates[template_id]
        self._save_user_templates()
        return True, usages

    def duplicate_template(self, template_id: str, new_name: str) -> PromptTemplate:
        template = self.get_template(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")

        import uuid
        new_template = PromptTemplate(
            id=str(uuid.uuid4()),
            name=new_name,
            description=template.description,
            type=template.type,
            systemPrompt=template.systemPrompt,
            userPrompt=template.userPrompt,
            isPreset=False,
            createdAt=datetime.now(),
            updatedAt=datetime.now()
        )
        return self.save_template(new_template)

    def get_variables(self, prompt_type: PromptType) -> List[PromptVariable]:
        return _get_variables_for_type(prompt_type)

    def render_template(self, template: PromptTemplate, **kwargs) -> Tuple[str, str]:
        from string import Template

        class CustomTemplate(Template):
            delimiter = '{'
            idpattern = r'[a-zA-Z_][a-zA-Z0-9_]*'

        def escape_braces(s: str) -> str:
            return s.replace('{{', '\x00').replace('}}', '\x01').replace('{', '{{').replace('}', '}}').replace('\x00', '{').replace('\x01', '}')

        system_prompt = escape_braces(template.systemPrompt)
        user_prompt = escape_braces(template.userPrompt)

        try:
            rendered_system = CustomTemplate(system_prompt).safe_substitute(**kwargs) if system_prompt else ""
            rendered_user = CustomTemplate(user_prompt).safe_substitute(**kwargs) if user_prompt else ""
            return rendered_system, rendered_user
        except Exception as e:
            logger.error(f"Failed to render template: {e}")
            return template.systemPrompt, template.userPrompt

    def get_resolved_template(
        self,
        prompt_type: PromptType,
        project: Optional[Any] = None,
        global_settings: Optional[Any] = None
    ) -> PromptTemplate:
        template_id = None

        if project and project.useCustomPrompts:
            template_id = project.projectPromptTemplates.get(prompt_type)

        if not template_id and global_settings:
            template_id = global_settings.defaultPromptTemplates.get(prompt_type)

        if template_id:
            template = self.get_template(template_id)
            if template:
                return template

        default_id = f"preset_{prompt_type.value}_1"
        return self._presets[default_id]


prompt_template_manager = PromptTemplateManager()
```

---

## Task 3: 更新 storage.py 支持模板存储

**Files:**
- Modify: `backend/core/storage.py`

- [ ] **Step 1: 导入新模型**

在文件顶部的导入区域添加：

```python
from models.schemas import PromptTemplate, PromptType
```

- [ ] **Step 2: 验证与现有代码兼容**

阅读 storage.py，确保它可以正常加载更新后的 GlobalSettings 和 Project 模型（新增的 defaultPromptTemplates 和 projectPromptTemplates 字段）

---

## Task 4: 后端 API 路由

**Files:**
- Create: `backend/api/prompts.py`

- [ ] **Step 1: 创建 API 路由文件框架**

```python
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
```

---

## Task 5: 注册 API 路由

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: 导入 prompts 路由**

在其他路由导入附近添加：

```python
from api import prompts
```

- [ ] **Step 2: 注册路由**

在 `app.include_router()` 调用区域添加：

```python
app.include_router(prompts.router)
```

---

## Task 6: 更新 ollama.py 集成模板系统

**Files:**
- Modify: `backend/core/ollama.py`

- [ ] **Step 1: 导入模板管理器**

在导入区域添加：

```python
from core.prompt_templates import prompt_template_manager
from models.schemas import PromptType
```

- [ ] **Step 2: 修改 extract_characters 方法**

找到 `extract_characters` 方法，替换 prompt 生成逻辑：

```python
    async def extract_characters(
        self,
        novel_text: str,
        project: Optional[Any] = None,
        global_settings: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        chunks = self._chunk_text(novel_text)
        all_characters = []
        seen_names = set()

        template = prompt_template_manager.get_resolved_template(
            PromptType.CHARACTER_EXTRACTION,
            project,
            global_settings
        )

        for chunk in chunks:
            system_prompt, user_prompt = prompt_template_manager.render_template(
                template,
                chunk=chunk
            )

            try:
                response = await self.generate(user_prompt, system_prompt)
                json_start = response.find("[")
                json_end = response.rfind("]") + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response[json_start:json_end]
                    chars = json.loads(json_str)
                    for char in chars:
                        name = char.get("name", "")
                        if name and name not in seen_names:
                            seen_names.add(name)
                            all_characters.append(char)
            except Exception as e:
                logger.error(f"Failed to extract characters from chunk: {e}")

        return all_characters
```

- [ ] **Step 3: 修改 split_storyboard 方法**

找到 `split_storyboard` 方法，替换 prompt 生成逻辑：

```python
    async def split_storyboard(
        self,
        novel_text: str,
        characters: List[Dict[str, Any]] = None,
        project: Optional[Any] = None,
        global_settings: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        chunks = self._chunk_text(novel_text)
        all_storyboards = []
        current_index = 0

        template = prompt_template_manager.get_resolved_template(
            PromptType.STORYBOARD_SPLIT,
            project,
            global_settings
        )

        for chunk_idx, chunk in enumerate(chunks):
            char_info = ""
            if characters:
                char_info = "角色列表：\n" + "\n".join([f"- {c.get('name', '')}: {c.get('description', '')}" for c in characters])

            system_prompt, user_prompt = prompt_template_manager.render_template(
                template,
                chunk=chunk,
                characters=char_info,
                current_index=str(current_index)
            )

            try:
                response = await self.generate(user_prompt, system_prompt)
                json_start = response.find("[")
                json_end = response.rfind("]") + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response[json_start:json_end]
                    sbs = json.loads(json_str)
                    for sb in sbs:
                        sb["index"] = current_index
                        all_storyboards.append(sb)
                        current_index += 1
            except Exception as e:
                logger.error(f"Failed to split storyboard from chunk: {e}")

        return all_storyboards
```

- [ ] **Step 4: 修改 generate_image_prompt 方法**

找到 `generate_image_prompt` 方法，替换 prompt 生成逻辑：

```python
    async def generate_image_prompt(
        self,
        scene_description: str,
        characters: List[Dict[str, Any]] = None,
        style_prompt: str = "",
        project: Optional[Any] = None,
        global_settings: Optional[Any] = None
    ) -> str:
        template = prompt_template_manager.get_resolved_template(
            PromptType.IMAGE_PROMPT,
            project,
            global_settings
        )

        char_info = ""
        if characters:
            char_info = "角色提示词：\n" + "\n".join([f"- {c.get('name', '')}: {c.get('characterPrompt', '')}" for c in characters])

        system_prompt, user_prompt = prompt_template_manager.render_template(
            template,
            scene_description=scene_description,
            characters=char_info,
            style_prompt=style_prompt
        )

        try:
            return await self.generate(user_prompt, system_prompt)
        except Exception as e:
            logger.error(f"Failed to generate image prompt: {e}")
            return scene_description
```

---

## Task 7: 更新 openai_client.py 集成模板系统

**Files:**
- Modify: `backend/core/openai_client.py`

- [ ] **Step 1: 导入模板管理器**

在导入区域添加：

```python
from core.prompt_templates import prompt_template_manager
from models.schemas import PromptType
```

- [ ] **Step 2: 修改 extract_characters 方法**

找到 `extract_characters` 方法，使用与 ollama.py 相同的方式更新（参考 Task 6 Step 2）

- [ ] **Step 3: 修改 split_storyboard 方法**

找到 `split_storyboard` 方法，使用与 ollama.py 相同的方式更新（参考 Task 6 Step 3）

- [ ] **Step 4: 修改 generate_image_prompt 方法**

找到 `generate_image_prompt` 方法，使用与 ollama.py 相同的方式更新（参考 Task 6 Step 4）

---

## Task 8: 更新 generation.py 传递项目/全局设置

**Files:**
- Modify: `backend/api/generation.py`

- [ ] **Step 1: 修改 extract_characters 端点**

找到 `extract_characters` 端点，更新 LLM 调用：

```python
    settings_obj = storage.load_global_settings()
    llm_client = LLMClient(settings_obj)
    char_dicts = await llm_client.extract_characters(
        project.sourceText,
        project=project,
        global_settings=settings_obj
    )
```

- [ ] **Step 2: 修改 split_storyboard 端点**

找到 `split_storyboard` 端点，更新 LLM 调用：

```python
    settings_obj = storage.load_global_settings()
    llm_client = LLMClient(settings_obj)
    char_dicts = [c.model_dump() for c in project.characters]
    sb_dicts = await llm_client.split_storyboard(
        project.sourceText,
        char_dicts,
        project=project,
        global_settings=settings_obj
    )
```

- [ ] **Step 3: 修改 generate_single_image 中的图像 prompt 生成**

找到 `generate_single_image` 函数中调用 `generate_image_prompt` 的地方，更新调用：

```python
    if not storyboard.imagePrompt:
        settings_obj = storage.load_global_settings()
        llm_client = LLMClient(settings_obj)
        char_dicts = [c.model_dump() for c in characters]
        storyboard.imagePrompt = await llm_client.generate_image_prompt(
            storyboard.sceneDescription,
            char_dicts,
            project.stylePrompt,
            project=project,
            global_settings=settings_obj
        )
```

---

## Task 9: 更新 LLMClient 统一接口

**Files:**
- Modify: `backend/core/llm.py`

- [ ] **Step 1: 更新方法签名**

更新三个方法的签名，添加可选的 project 和 global_settings 参数：

```python
    async def extract_characters(
        self,
        novel_text: str,
        project: Optional[Any] = None,
        global_settings: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        return await self._client.extract_characters(novel_text, project, global_settings)

    async def split_storyboard(
        self,
        novel_text: str,
        characters: List[Dict[str, Any]] = None,
        project: Optional[Any] = None,
        global_settings: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        return await self._client.split_storyboard(novel_text, characters, project, global_settings)

    async def generate_image_prompt(
        self,
        scene_description: str,
        characters: List[Dict[str, Any]] = None,
        style_prompt: str = "",
        project: Optional[Any] = None,
        global_settings: Optional[Any] = None
    ) -> str:
        if hasattr(self._client, 'generate_image_prompt'):
            return await self._client.generate_image_prompt(
                scene_description,
                characters,
                style_prompt,
                project,
                global_settings
            )
        return scene_description
```

---

## Task 10: 前端类型定义和 API 方法

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: 添加 PromptType 和相关类型**

在文件顶部类型定义区域添加：

```typescript
export type PromptType = 'character_extraction' | 'storyboard_split' | 'image_prompt';

export interface PromptVariable {
  name: string;
  description: string;
  example: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  type: PromptType;
  systemPrompt: string;
  userPrompt: string;
  isPreset: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: 更新 GlobalSettings 类型**

找到 GlobalSettings 接口，添加：

```typescript
  defaultPromptTemplates: Record<PromptType, string>;
```

- [ ] **Step 3: 更新 Project 类型**

找到 Project 接口，添加：

```typescript
  useCustomPrompts: boolean;
  projectPromptTemplates: Record<PromptType, string>;
```

- [ ] **Step 4: 添加 promptApi**

在文件末尾的 API 对象区域添加：

```typescript
export const promptApi = {
  listTemplates: (type?: PromptType) => axios.get<PromptTemplate[]>(
    `/api/prompts/templates${type ? `?type=${type}` : ''}`
  ),
  getTemplate: (id: string) => axios.get<PromptTemplate>(`/api/prompts/templates/${id}`),
  createTemplate: (data: Partial<PromptTemplate>) => axios.post<PromptTemplate>('/api/prompts/templates', data),
  updateTemplate: (id: string, data: Partial<PromptTemplate>) => axios.put<PromptTemplate>(`/api/prompts/templates/${id}`, data),
  deleteTemplate: (id: string, cascade?: boolean) => axios.delete(
    `/api/prompts/templates/${id}${cascade ? '?cascade=true' : ''}`
  ),
  duplicateTemplate: (id: string, newName: string) => axios.post<PromptTemplate>(
    `/api/prompts/templates/${id}/duplicate`,
    { newName }
  ),
  getVariables: (type: PromptType) => axios.get<PromptVariable[]>(`/api/prompts/variables?type=${type}`),
};
```

---

## Task 11: 前端 PromptManager 页面

**Files:**
- Create: `frontend/src/pages/PromptManager.tsx`

- [ ] **Step 1: 创建页面框架**

```typescript
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  promptApi,
  type PromptTemplate,
  type PromptType,
  type PromptVariable,
} from '../services/api';

const PromptManager: React.FC = () => {
  const navigate = useNavigate();
  const [currentType, setCurrentType] = useState<PromptType>('character_extraction');
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [variables, setVariables] = useState<PromptVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<PromptTemplate>>({});
  const [showPreview, setShowPreview] = useState(false);

  const typeLabels: Record<PromptType, string> = {
    character_extraction: '角色提取',
    storyboard_split: '分镜拆分',
    image_prompt: '图像生成',
  };

  useEffect(() => {
    loadTemplates();
    loadVariables();
  }, [currentType]);

  const loadTemplates = async () => {
    try {
      const response = await promptApi.listTemplates(currentType);
      setTemplates(response.data);
      if (response.data.length > 0 && !selectedTemplate) {
        setSelectedTemplate(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVariables = async () => {
    try {
      const response = await promptApi.getVariables(currentType);
      setVariables(response.data);
    } catch (error) {
      console.error('Failed to load variables:', error);
    }
  };

  const handleSelectTemplate = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setEditing(false);
    setEditForm({});
  };

  const startEdit = () => {
    if (selectedTemplate) {
      setEditForm({ ...selectedTemplate });
      setEditing(true);
    }
  };

  const saveEdit = async () => {
    if (!selectedTemplate || !editForm.name) return;
    try {
      if (selectedTemplate.isPreset) {
        const newName = `${editForm.name} (副本)`;
        const response = await promptApi.duplicateTemplate(selectedTemplate.id, newName);
        setSelectedTemplate(response.data);
      } else {
        const response = await promptApi.updateTemplate(selectedTemplate.id, editForm);
        setSelectedTemplate(response.data);
      }
      await loadTemplates();
      setEditing(false);
      setEditForm({});
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    if (!confirm(`确定要删除模板 "${selectedTemplate.name}" 吗？`)) return;
    try {
      await promptApi.deleteTemplate(selectedTemplate.id);
      setSelectedTemplate(null);
      await loadTemplates();
    } catch (error: any) {
      if (error.response?.status === 400) {
        const usages = error.response?.data?.detail?.usages;
        if (usages) {
          const message = `此模板正在被使用：\n${usages.join('\n')}\n\n是否级联更新为默认模板？`;
          if (confirm(message)) {
            try {
              await promptApi.deleteTemplate(selectedTemplate.id, true);
              setSelectedTemplate(null);
              await loadTemplates();
            } catch (e) {
              console.error('Failed to cascade delete:', e);
            }
          }
        }
      }
    }
  };

  const handleDuplicate = async () => {
    if (!selectedTemplate) return;
    const newName = prompt('请输入新模板名称:', `${selectedTemplate.name} (副本)`);
    if (!newName) return;
    try {
      const response = await promptApi.duplicateTemplate(selectedTemplate.id, newName);
      setSelectedTemplate(response.data);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  };

  const insertVariable = (name: string, textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const newValue = before + `{${name}}` + after;
    setEditForm({ ...editForm, [textarea.name]: newValue });
  };

  const presets = templates.filter(t => t.isPreset);
  const userTemplates = templates.filter(t => !t.isPreset);

  const displayTemplate = editing ? editForm : selectedTemplate;

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
            <h2 className="text-2xl font-bold">Prompt 模板管理器</h2>
          </div>
        </div>

        {/* 类型标签页 */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b">
            {(Object.keys(typeLabels) as PromptType[]).map((type) => (
              <button
                key={type}
                onClick={() => setCurrentType(type)}
                className={`px-6 py-4 font-medium ${
                  currentType === type
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {typeLabels[type]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-6">
          {/* 模板列表 */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-4 text-gray-700">模板列表</h3>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">预设</h4>
                <div className="space-y-1">
                  {presets.map((template) => (
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
                onClick={async () => {
                  const name = prompt('请输入新模板名称:');
                  if (!name) return;
                  try {
                    const response = await promptApi.createTemplate({
                      name,
                      type: currentType,
                    });
                    setSelectedTemplate(response.data);
                    await loadTemplates();
                  } catch (error) {
                    console.error('Failed to create template:', error);
                  }
                }}
                className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 text-sm"
              >
                + 新建模板
              </button>
            </div>
          </div>

          {/* 编辑器 */}
          <div className="flex-1">
            {loading ? (
              <div className="bg-white rounded-lg shadow p-6">
                加载中...
              </div>
            ) : !displayTemplate ? (
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-500">请选择一个模板</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    名称
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
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
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    />
                  ) : (
                    <div className="text-gray-600">{displayTemplate.description || '无描述'}</div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    System Prompt
                  </label>
                  {editing ? (
                    <textarea
                      name="systemPrompt"
                      value={editForm.systemPrompt || ''}
                      onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })}
                      className="w-full border rounded px-3 py-2 h-32 font-mono text-sm"
                      ref={(el) => (window as any).systemPromptRef = el}
                    />
                  ) : (
                    <div className="bg-gray-50 rounded p-3 font-mono text-sm whitespace-pre-wrap">
                      {displayTemplate.systemPrompt || '空'}
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User Prompt
                  </label>
                  {editing ? (
                    <textarea
                      name="userPrompt"
                      value={editForm.userPrompt || ''}
                      onChange={(e) => setEditForm({ ...editForm, userPrompt: e.target.value })}
                      className="w-full border rounded px-3 py-2 h-48 font-mono text-sm"
                      ref={(el) => (window as any).userPromptRef = el}
                    />
                  ) : (
                    <div className="bg-gray-50 rounded p-3 font-mono text-sm whitespace-pre-wrap">
                      {displayTemplate.userPrompt || '空'}
                    </div>
                  )}
                </div>

                {editing && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      可用变量
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {variables.map((v) => (
                        <div key={v.name} className="flex gap-1">
                          <button
                            onClick={() => {
                              insertVariable(v.name, (window as any).systemPromptRef);
                            }}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono"
                            title={`${v.description} (插入到 System Prompt)`}
                          >
                            {`{${v.name}}`} → S
                          </button>
                          <button
                            onClick={() => {
                              insertVariable(v.name, (window as any).userPromptRef);
                            }}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono"
                            title={`${v.description} (插入到 User Prompt)`}
                          >
                            {`{${v.name}}`} → U
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <button
                        onClick={saveEdit}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setEditForm({});
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
                          onClick={startEdit}
                          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                          编辑
                        </button>
                      )}
                      <button
                        onClick={handleDuplicate}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                      >
                        复制
                      </button>
                      {!selectedTemplate?.isPreset && (
                        <button
                          onClick={handleDelete}
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
      </div>
    </div>
  );
};

export default PromptManager;
```

---

## Task 12: 前端路由更新

**Files:**
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: 导入 PromptManager**

在导入区域添加：

```typescript
import PromptManager from './pages/PromptManager';
```

- [ ] **Step 2: 添加路由**

在路由配置区域添加：

```typescript
<Route path="/prompts" element={<PromptManager />} />
```

---

## Task 13: 更新 Settings 页面

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: 添加 Prompt 模板标签页**

在标签页配置中添加新标签：

```typescript
{ name: 'Prompt 模板', key: 'prompts' }
```

- [ ] **Step 2: 实现 Prompt 模板标签页内容**

在标签页内容渲染区域添加：

```typescript
{currentTab === 'prompts' && (
  <div>
    <h3 className="text-lg font-semibold mb-4">默认 Prompt 模板</h3>
    <div className="space-y-4">
      {(['character_extraction', 'storyboard_split', 'image_prompt'] as const).map((type) => (
        <div key={type}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {typeLabels[type]}
          </label>
          <select
            value={settings.defaultPromptTemplates?.[type] || ''}
            onChange={(e) => {
              const newTemplates = { ...settings.defaultPromptTemplates };
              if (e.target.value) {
                newTemplates[type] = e.target.value;
              } else {
                delete newTemplates[type];
              }
              setSettings({ ...settings, defaultPromptTemplates: newTemplates });
            }}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">预设：通用版</option>
            <option value={`preset_${type}_2`}>预设：动漫风格</option>
            <option value={`preset_${type}_3`}>预设：写实风格</option>
            <option value={`preset_${type}_4`}>预设：古风/武侠</option>
            <option disabled>──────────</option>
            {userTemplates
              .filter(t => t.type === type)
              .map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
          </select>
        </div>
      ))}
    </div>
    <div className="mt-6">
      <button
        onClick={() => navigate('/prompts')}
        className="text-blue-500 hover:text-blue-600"
      >
        管理模板 →
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3: 添加必要的状态和导入**

在文件顶部添加：

```typescript
import { promptApi, type PromptTemplate, type PromptType } from '../services/api';
```

在组件内部添加：

```typescript
const [userTemplates, setUserTemplates] = useState<PromptTemplate[]>([]);
const typeLabels: Record<PromptType, string> = {
  character_extraction: '角色提取',
  storyboard_split: '分镜拆分',
  image_prompt: '图像生成',
};
```

添加加载模板的 useEffect：

```typescript
useEffect(() => {
  loadUserTemplates();
}, []);

const loadUserTemplates = async () => {
  try {
    const response = await promptApi.listTemplates();
    setUserTemplates(response.data.filter(t => !t.isPreset));
  } catch (error) {
    console.error('Failed to load templates:', error);
  }
};
```

---

## Task 14: 更新 ProjectEditor 页面

**Files:**
- Modify: `frontend/src/pages/ProjectEditor.tsx`

- [ ] **Step 1: 添加项目级 Prompt 选择 UI**

在角色管理步骤（currentStep === 0）的"自动提取角色"按钮上方添加：

```typescript
<div className="mb-4 p-4 bg-gray-50 rounded-lg">
  <div className="flex items-center gap-2 mb-2">
    <input
      type="checkbox"
      id="useCustomPrompts"
      checked={project.useCustomPrompts}
      onChange={(e) => setProject({ ...project, useCustomPrompts: e.target.checked })}
    />
    <label htmlFor="useCustomPrompts" className="font-medium">
      使用自定义 Prompt
    </label>
  </div>

  {project.useCustomPrompts && (
    <div className="space-y-3 mt-4">
      {(['character_extraction', 'storyboard_split', 'image_prompt'] as const).map((type) => (
        <div key={type}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {typeLabels[type]}
          </label>
          <select
            value={project.projectPromptTemplates?.[type] || ''}
            onChange={(e) => {
              const newTemplates = { ...project.projectPromptTemplates };
              if (e.target.value) {
                newTemplates[type] = e.target.value;
              } else {
                delete newTemplates[type];
              }
              setProject({ ...project, projectPromptTemplates: newTemplates });
            }}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">使用全局默认</option>
            <option value={`preset_${type}_1`}>预设：通用版</option>
            <option value={`preset_${type}_2`}>预设：动漫风格</option>
            <option value={`preset_${type}_3`}>预设：写实风格</option>
            <option value={`preset_${type}_4`}>预设：古风/武侠</option>
            <option disabled>──────────</option>
            {userTemplates
              .filter(t => t.type === type)
              .map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
          </select>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 2: 添加必要的状态和导入**

在文件顶部添加：

```typescript
import { promptApi, type PromptTemplate, type PromptType } from '../services/api';
```

在组件内部添加：

```typescript
const [userTemplates, setUserTemplates] = useState<PromptTemplate[]>([]);
const typeLabels: Record<PromptType, string> = {
  character_extraction: '角色提取',
  storyboard_split: '分镜拆分',
  image_prompt: '图像生成',
};
```

添加加载模板的 useEffect：

```typescript
useEffect(() => {
  loadUserTemplates();
}, []);

const loadUserTemplates = async () => {
  try {
    const response = await promptApi.listTemplates();
    setUserTemplates(response.data.filter(t => !t.isPreset));
  } catch (error) {
    console.error('Failed to load templates:', error);
  }
};
```

---

## Task 15: 测试和验证

- [ ] **Step 1: 启动后端**

```bash
cd backend
python main.py
```

验证：后端正常启动，无错误

- [ ] **Step 2: 启动前端**

```bash
cd frontend
npm run dev
```

验证：前端正常启动，无错误

- [ ] **Step 3: 验证基础功能**

1. 访问 Prompt 模板管理器页面
2. 验证 4 个预设模板都显示正确
3. 创建一个新模板
4. 编辑模板内容
5. 复制模板
6. 删除模板
7. 在 Settings 页面选择默认模板
8. 在项目中使用自定义 Prompt
9. 测试角色提取和分镜拆分

---

## 注意事项

1. **向后兼容：** GlobalSettings 和 Project 新增字段都有默认值，现有数据可以正常加载
2. **预设只读：** 预设模板不能直接编辑或删除，只能复制后修改
3. **删除保护：** 删除模板前检查是否在使用，提供级联更新选项
4. **变量转义：** 使用 `{{` 和 `}}` 输出字面量大括号

---

## 提交建议

```bash
# Task 1-2
git add backend/models/schemas.py backend/core/prompt_templates.py
git commit -m "feat: add prompt template data models and manager"

# Task 3-5
git add backend/core/storage.py backend/api/prompts.py backend/main.py
git commit -m "feat: add prompt template API endpoints"

# Task 6-9
git add backend/core/ollama.py backend/core/openai_client.py backend/core/llm.py backend/api/generation.py
git commit -m "feat: integrate prompt templates with LLM clients"

# Task 10-14
git add frontend/src/services/api.ts frontend/src/pages/PromptManager.tsx frontend/src/main.tsx frontend/src/pages/Settings.tsx frontend/src/pages/ProjectEditor.tsx
git commit -m "feat: add frontend prompt management UI"

# Task 15
# 测试完成后更新文档
```
