# 场景提取与图片提示词增强实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现场景提取功能和增强的图片提示词生成，包括场景数据模型、API端点、LLM集成、前端UI

**Architecture:** 扩展现有数据模型添加Scene，新增场景管理API，更新LLM客户端支持场景提取和增强提示词生成，更新前端UI

**Tech Stack:** FastAPI, Pydantic, React, TypeScript, Ollama/OpenAI

---

## 任务分解

### Task 1: 更新后端数据模型

**Files:**
- Modify: `backend/models/schemas.py`

**Goal:** 添加 Scene 模型，更新 Project、Storyboard、PromptType 等

- [ ] **Step 1: 添加 Scene 模型**

在 `schemas.py` 的适当位置（比如在 Character 之后）添加：

```python
class Scene(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)
```

- [ ] **Step 2: 添加 SCENE_EXTRACTION 到 PromptType**

在 PromptType 枚举中添加：
```python
class PromptType(str, Enum):
    CHARACTER_EXTRACTION = "character_extraction"
    STORYBOARD_SPLIT = "storyboard_split"
    IMAGE_PROMPT = "image_prompt"
    SCENE_EXTRACTION = "scene_extraction"  # 新增
```

- [ ] **Step 3: 更新 Project 模型添加 scenes 字段**

在 Project 模型中添加：
```python
class Project(BaseModel):
    # ... 现有字段 ...
    scenes: List[Scene] = Field(default_factory=list)
```

- [ ] **Step 4: 更新 Storyboard 模型添加 sceneId 字段**

在 Storyboard 模型中添加：
```python
class Storyboard(BaseModel):
    # ... 现有字段 ...
    sceneId: Optional[str] = None
```

- [ ] **Step 5: 更新 UpdateStoryboardRequest 添加 sceneId 字段**

在 UpdateStoryboardRequest 中添加：
```python
class UpdateStoryboardRequest(BaseModel):
    # ... 现有字段 ...
    sceneId: Optional[str] = None
```

- [ ] **Step 6: 验证文件语法**

确保没有语法错误。

- [ ] **Step 7: Commit**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add backend/models/schemas.py
git commit -m "feat: add Scene data model and update schemas"
```

---

### Task 2: 更新 prompt_templates.py 添加场景提取预设

**Files:**
- Modify: `backend/core/prompt_templates.py`

**Goal:** 添加 SCENE_EXTRACTION 预设模版和变量定义

- [ ] **Step 1: 在 _get_preset_templates() 中添加场景提取预设**

在角色提取、分镜拆分、图像生成预设之后，添加：

```python
# ========== 场景提取预设 ==========
PromptTemplate(
    id="preset_scene_extraction_1",
    name="通用版",
    description="通用的场景提取模板",
    type=PromptType.SCENE_EXTRACTION,
    systemPrompt="你是一个专业的小说场景提取助手。从小说文本中提取所有主要场景。",
    userPrompt="""从以下小说文本中提取所有主要场景。对每个场景提供：
1. name: 场景名称（简洁描述性名称，如"森林中的小屋"）
2. description: 场景详细视觉描述（用于AI绘画的详细描述）

仅返回JSON数组，格式如下：
[
  {
    "name": "场景名称",
    "description": "详细的视觉描述"
  }
]

小说文本：
{chunk}
""",
    isPreset=True,
    createdAt=now,
    updatedAt=now
),
PromptTemplate(
    id="preset_scene_extraction_2",
    name="动漫风格",
    description="注重动漫化视觉特征的场景提取",
    type=PromptType.SCENE_EXTRACTION,
    systemPrompt="你是一个专业的动漫场景设计助手。从小说文本中提取场景，注重动漫化的视觉特征。",
    userPrompt="""从以下小说文本中提取所有主要场景，以动漫风格进行描述。对每个场景提供：
1. name: 场景名称（简洁描述性名称，如"森林中的小屋"）
2. description: 场景详细视觉描述（包含动漫风格的色彩、光影、构图等）

仅返回JSON数组，格式如下：
[
  {
    "name": "场景名称",
    "description": "动漫风格的详细视觉描述"
  }
]

小说文本：
{chunk}
""",
    isPreset=True,
    createdAt=now,
    updatedAt=now
),
PromptTemplate(
    id="preset_scene_extraction_3",
    name="写实风格",
    description="注重真实场景描写的场景提取",
    type=PromptType.SCENE_EXTRACTION,
    systemPrompt="你是一个专业的电影场景设计助手。从小说文本中提取场景，注重真实的场景描写。",
    userPrompt="""从以下小说文本中提取所有主要场景，以写实风格进行描述。对每个场景提供：
1. name: 场景名称（简洁描述性名称，如"森林中的小屋"）
2. description: 场景详细视觉描述（包含真实的光影、材质、建筑细节等）

仅返回JSON数组，格式如下：
[
  {
    "name": "场景名称",
    "description": "写实风格的详细视觉描述"
  }
]

小说文本：
{chunk}
""",
    isPreset=True,
    createdAt=now,
    updatedAt=now
),
PromptTemplate(
    id="preset_scene_extraction_4",
    name="古风/武侠",
    description="适合古风/武侠小说的场景提取",
    type=PromptType.SCENE_EXTRACTION,
    systemPrompt="你是一个专业的古风小说场景设计助手。从小说文本中提取武侠/古风场景。",
    userPrompt="""从以下小说文本中提取所有主要场景，以古风/武侠风格进行描述。对每个场景提供：
1. name: 场景名称（简洁描述性名称，如"山间凉亭"）
2. description: 场景详细视觉描述（包含古风建筑、山水、园林、武器等元素）

仅返回JSON数组，格式如下：
[
  {
    "name": "场景名称",
    "description": "古风风格的详细视觉描述"
  }
]

小说文本：
{chunk}
""",
    isPreset=True,
    createdAt=now,
    updatedAt=now
),
```

- [ ] **Step 2: 在 _get_variables_for_type() 中添加 SCENE_EXTRACTION 支持**

在函数中添加：
```python
elif prompt_type == PromptType.SCENE_EXTRACTION:
    return [
        PromptVariable(
            name="chunk",
            description="当前处理的小说文本片段",
            example="第一章 初遇..."
        )
    ]
```

- [ ] **Step 3: 验证文件语法**

确保没有语法错误。

- [ ] **Step 4: Commit**

```bash
git add backend/core/prompt_templates.py
git commit -m "feat: add SCENE_EXTRACTION preset templates"
```

---

### Task 3: 创建场景管理 API

**Files:**
- Create: `backend/api/scenes.py`

**Goal:** 创建场景管理的 API 端点

- [ ] **Step 1: 创建 scenes.py 文件**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/api/scenes.py
git commit -m "feat: add scenes API endpoints"
```

---

### Task 4: 在 main.py 中注册 scenes 路由

**Files:**
- Modify: `backend/main.py`

**Goal:** 注册 scenes 路由

- [ ] **Step 1: 查看现有的 main.py 并添加路由**

先读取 main.py 确认结构，然后添加：

```python
from api import scenes  # 新增

app.include_router(scenes.router)  # 在其他路由注册之后添加
```

- [ ] **Step 2: Commit**

```bash
git add backend/main.py
git commit -m "feat: register scenes router"
```

---

### Task 5: 更新 LLM 客户端添加场景提取方法

**Files:**
- Modify: `backend/core/llm.py`
- Modify: `backend/core/ollama.py`
- Modify: `backend/core/openai_client.py`

**Goal:** 添加 extract_scenes 方法到所有 LLM 客户端

- [ ] **Step 1: 更新 llm.py 添加接口方法**

在 LLMClient 类中添加：

```python
async def extract_scenes(
    self,
    novel_text: str,
    project: Optional[Any] = None,
    global_settings: Optional[Any] = None
) -> List[Dict[str, Any]]:
    return await self._client.extract_scenes(novel_text, project, global_settings)

async def generate_image_prompt_enhanced(
    self,
    storyboard: Any,
    project: Any,
    surrounding_storyboards: List[Any],
    global_settings: Optional[Any] = None
) -> str:
    if hasattr(self._client, 'generate_image_prompt_enhanced'):
        return await self._client.generate_image_prompt_enhanced(
            storyboard,
            project,
            surrounding_storyboards,
            global_settings
        )
    # 降级到普通版本
    from models.schemas import Character
    char_map = {c.id: c for c in project.characters}
    characters = [char_map[cid] for cid in storyboard.characterIds if cid in char_map]
    char_dicts = [c.model_dump() for c in characters]
    return await self.generate_image_prompt(
        storyboard.sceneDescription,
        char_dicts,
        project.stylePrompt,
        project,
        global_settings
    )
```

- [ ] **Step 2: 更新 ollama.py 实现 extract_scenes**

在 OllamaClient 类中添加：

```python
async def extract_scenes(
    self,
    novel_text: str,
    project: Optional[Any] = None,
    global_settings: Optional[Any] = None
) -> List[Dict[str, Any]]:
    chunks = self._chunk_text(novel_text)
    all_scenes = []
    seen_names = set()

    from models.schemas import PromptType
    template = prompt_template_manager.get_resolved_template(
        PromptType.SCENE_EXTRACTION,
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
            logger.info(f"Raw scene extraction response: {response[:500]}...")

            # 移除可能的 markdown 代码块标记
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.startswith("```"):
                response = response[3:]
            if response.endswith("```"):
                response = response[:-3]
            response = response.strip()

            json_start = response.find("[")
            json_end = response.rfind("]") + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                scenes = json.loads(json_str)
                for scene in scenes:
                    name = scene.get("name", "")
                    if name and name not in seen_names:
                        seen_names.add(name)
                        all_scenes.append(scene)
        except Exception as e:
            logger.error(f"Failed to extract scenes from chunk: {e}")

    return all_scenes
```

同时需要在顶部添加 `import json`（如果还没有）。

- [ ] **Step 3: 更新 ollama.py 实现 generate_image_prompt_enhanced**

在 OllamaClient 类中添加：

```python
async def generate_image_prompt_enhanced(
    self,
    storyboard: Any,
    project: Any,
    surrounding_storyboards: List[Any],
    global_settings: Optional[Any] = None
) -> str:
    from models.schemas import PromptType

    template = prompt_template_manager.get_resolved_template(
        PromptType.IMAGE_PROMPT,
        project,
        global_settings
    )

    # 构建角色信息
    char_map = {c.id: c for c in project.characters}
    characters = [char_map[cid] for cid in storyboard.characterIds if cid in char_map]
    char_info = ""
    if characters:
        char_info = "角色提示词：\n" + "\n".join([f"- {c.name}: {c.characterPrompt}" for c in characters])

    # 构建场景信息
    scene_info = ""
    if storyboard.sceneId:
        scene = next((s for s in project.scenes if s.id == storyboard.sceneId), None)
        if scene:
            scene_info = f"场景描述：{scene.description}"

    # 构建上下文分镜信息
    context_info = ""
    if surrounding_storyboards:
        context_info = "上下文分镜：\n"
        for i, sb in enumerate(surrounding_storyboards):
            pos = "当前" if sb.id == storyboard.id else f"{'前' if i < surrounding_storyboards.index([s for s in surrounding_storyboards if s.id == storyboard.id][0]) else '后'}"
            context_info += f"- [{pos}] {sb.sceneDescription[:100]}...\n"

    # 构建完整的 style_prompt
    style_prompt = project.stylePrompt
    if scene_info:
        style_prompt = f"{style_prompt}, {scene_info}" if style_prompt else scene_info

    system_prompt, user_prompt = prompt_template_manager.render_template(
        template,
        scene_description=storyboard.sceneDescription,
        characters=char_info,
        style_prompt=style_prompt
    )

    # 添加上下文到 user_prompt
    if context_info:
        user_prompt = f"{context_info}\n\n{user_prompt}"

    try:
        return await self.generate(user_prompt, system_prompt)
    except Exception as e:
        logger.error(f"Failed to generate enhanced image prompt: {e}")
        return storyboard.sceneDescription
```

- [ ] **Step 4: 更新 openai_client.py 实现 extract_scenes 和 generate_image_prompt_enhanced**

参考 ollama.py 的实现，在 OpenAIClient 中添加相同的方法。

- [ ] **Step 5: Commit**

```bash
git add backend/core/llm.py backend/core/ollama.py backend/core/openai_client.py
git commit -m "feat: add extract_scenes and enhanced image prompt generation to LLM clients"
```

---

### Task 6: 更新分镜拆分 API 添加自动关联逻辑

**Files:**
- Modify: `backend/api/generation.py`

**Goal:** 分镜拆分后自动关联场景和角色

- [ ] **Step 1: 添加自动关联辅助函数**

在 generation.py 中添加辅助函数：

```python
def _simple_text_match(text: str, candidates: List[Any], name_field: str = "name", desc_field: str = "description") -> Optional[str]:
    """简单的文本匹配，找到最相关的候选"""
    if not text or not candidates:
        return None

    text_lower = text.lower()
    best_match = None
    best_score = 0

    for candidate in candidates:
        score = 0
        name = getattr(candidate, name_field, "").lower()
        desc = getattr(candidate, desc_field, "").lower()

        # 名称完全匹配
        if name and name in text_lower:
            score += 10
        # 描述关键词匹配
        for word in name.split():
            if word and word in text_lower:
                score += 2
        for word in desc.split()[:20]:  # 只看前20个词
            if word and len(word) > 2 and word in text_lower:
                score += 1

        if score > best_score:
            best_score = score
            best_match = candidate

    return best_match.id if best_match and best_score > 0 else None


def _auto_associate_storyboards(project: Project):
    """自动为分镜关联场景和角色"""
    for sb in project.storyboards:
        # 关联场景
        if not sb.sceneId and project.scenes:
            sb.sceneId = _simple_text_match(
                sb.sceneDescription,
                project.scenes,
                "name",
                "description"
            )

        # 关联角色（如果还没有）
        if not sb.characterIds and project.characters:
            matched_char_ids = []
            for char in project.characters:
                # 检查角色名是否在分镜描述中
                if char.name.lower() in sb.sceneDescription.lower():
                    matched_char_ids.append(char.id)
            sb.characterIds = matched_char_ids
```

- [ ] **Step 2: 在 split_storyboard 函数中调用自动关联**

在 split_storyboard 函数末尾，`storage.save_project(project)` 之前添加：

```python
# 自动关联场景和角色
_auto_associate_storyboards(project)

storage.save_project(project)
```

- [ ] **Step 3: 更新 generate_storyboard_prompts 使用增强版**

在 generate_storyboard_prompts 函数中，替换原来的 generate_image_prompt 调用：

```python
# 获取前后分镜
sb_index = project.storyboards.index(sb)
start_idx = max(0, sb_index - 5)
end_idx = min(len(project.storyboards), sb_index + 6)  # +6 因为 end_idx 不包含
surrounding_sbs = project.storyboards[start_idx:end_idx]

sb.imagePrompt = await llm_client.generate_image_prompt_enhanced(
    sb,
    project,
    surrounding_sbs,
    global_settings=settings_obj
)
```

- [ ] **Step 4: 更新 generate_single_image 也使用增强版**

同样在 generate_single_image 中更新调用。

- [ ] **Step 5: Commit**

```bash
git add backend/api/generation.py
git commit -m "feat: auto associate scenes/characters and use enhanced image prompt"
```

---

### Task 7: 更新 projects.py 的 update_storyboard 支持 sceneId

**Files:**
- Modify: `backend/api/projects.py`

**Goal:** 支持更新分镜的 sceneId

- [ ] **Step 1: 在 update_storyboard 中添加 sceneId 处理**

在 update_storyboard 函数中，与 ttsConfig 类似的位置添加：

```python
if hasattr(request, 'sceneId') and request.sceneId is not None:
    project.storyboards[i].sceneId = request.sceneId
```

- [ ] **Step 2: Commit**

```bash
git add backend/api/projects.py
git commit -m "feat: support updating storyboard sceneId"
```

---

### Task 8: 更新前端类型定义

**Files:**
- Modify: `frontend/src/services/api.ts`

**Goal:** 添加 Scene 类型，更新 Storyboard 和 API 方法

- [ ] **Step 1: 添加 Scene 接口**

在适当位置添加：

```typescript
export interface Scene {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: 更新 Storyboard 接口**

在 Storyboard 中添加：

```typescript
export interface Storyboard {
  // ... 现有字段 ...
  sceneId?: string;
}
```

- [ ] **Step 3: 添加 sceneApi**

在文件末尾添加：

```typescript
export const sceneApi = {
  extract: (projectId: string) =>
    api.post(`/projects/${projectId}/scenes/extract`),
  list: (projectId: string) =>
    api.get<Scene[]>(`/projects/${projectId}/scenes`),
  update: (projectId: string, sceneId: string, data: Partial<Scene>) =>
    api.put<Scene>(`/projects/${projectId}/scenes/${sceneId}`, data),
  delete: (projectId: string, sceneId: string) =>
    api.delete(`/projects/${projectId}/scenes/${sceneId}`),
};
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add Scene types and API to frontend"
```

---

### Task 9: 更新前端 ProjectEditor 添加场景管理

**Files:**
- Modify: `frontend/src/pages/ProjectEditor.tsx`

**Goal:** 添加场景列表 UI，更新分镜卡片显示

- [ ] **Step 1: 导入 sceneApi 和 Scene 类型**

在 import 语句中添加：

```typescript
import {
  // ... 现有导入 ...
  sceneApi,
  type Scene,
} from '../services/api';
```

- [ ] **Step 2: 添加状态变量**

在组件顶部添加：

```typescript
const [scenes, setScenes] = useState<Scene[]>([]);
const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
const [editingScene, setEditingScene] = useState<Partial<Scene>>({});
```

- [ ] **Step 3: 在 loadProject 中加载场景**

在 loadProject 函数中，设置 project 后添加：

```typescript
if (response.data.scenes) {
  setScenes(response.data.scenes);
}
```

- [ ] **Step 4: 添加场景处理函数**

添加：

```typescript
const handleExtractScenes = async () => {
  if (!id) return;
  try {
    const response = await sceneApi.extract(id);
    setScenes(response.data.scenes);
    await loadProject();
  } catch (error) {
    console.error('Failed to extract scenes:', error);
  }
};

const handleUpdateScene = async (sceneId: string) => {
  if (!id) return;
  try {
    const response = await sceneApi.update(id, sceneId, editingScene);
    setScenes(prev => prev.map(s => s.id === sceneId ? response.data : s));
    setEditingSceneId(null);
    setEditingScene({});
  } catch (error) {
    console.error('Failed to update scene:', error);
  }
};

const handleDeleteScene = async (sceneId: string) => {
  if (!id || !confirm('确定要删除这个场景吗？')) return;
  try {
    await sceneApi.delete(id, sceneId);
    setScenes(prev => prev.filter(s => s.id !== sceneId));
    await loadProject();
  } catch (error) {
    console.error('Failed to delete scene:', error);
  }
};
```

- [ ] **Step 5: 添加场景列表 UI**

在角色管理区域旁边添加场景管理标签页或区域。参考角色列表的实现方式。

- [ ] **Step 6: 更新分镜卡片显示场景和角色**

在分镜卡片中，显示关联的场景名称和角色名称。

- [ ] **Step 7: 添加分镜场景修改功能**

允许点击场景标签修改关联的场景。

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/ProjectEditor.tsx
git commit -m "feat: add scene management UI to frontend"
```

---

## 总结

完成以上任务后，功能应该完整可用：
1. 场景提取功能
2. 分镜自动关联场景和角色
3. 增强的图片提示词生成（使用上下文）
4. 完整的场景管理 UI
