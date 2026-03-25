# 场景提取与图片提示词增强设计文档

> **日期:** 2026-03-25
> **版本:** 1.0
> **作者:** Claude

## 概述

本设计文档描述了两个新功能：
1. **场景提取功能** - 基于大模型自动从小说文本中提取场景信息
2. **图片提示词生成增强** - 结合分镜、角色、场景和上下文生成更优质的图片提示词

## 目标

- 从小说中自动提取场景（名称 + 描述）
- 每个分镜自动关联场景和角色
- 图片提示词生成时使用前后分镜上下文，提高连贯性
- 提供场景管理界面，支持编辑场景描述

## 数据模型

### Scene 模型

```python
class Scene(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str                    # 场景名称，如"森林中的小屋"
    description: str = ""        # 场景详细视觉描述
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)
```

### Project 模型更新

```python
class Project(BaseModel):
    # ... 现有字段 ...
    scenes: List[Scene] = Field(default_factory=list)  # 新增
```

### Storyboard 模型更新

```python
class Storyboard(BaseModel):
    # ... 现有字段 ...
    sceneId: Optional[str] = None  # 新增，关联场景
    # characterIds 已存在
```

### PromptType 枚举更新

```python
class PromptType(str, Enum):
    CHARACTER_EXTRACTION = "character_extraction"
    STORYBOARD_SPLIT = "storyboard_split"
    IMAGE_PROMPT = "image_prompt"
    SCENE_EXTRACTION = "scene_extraction"  # 新增
```

### UpdateStoryboardRequest 更新

```python
class UpdateStoryboardRequest(BaseModel):
    # ... 现有字段 ...
    sceneId: Optional[str] = None  # 新增
```

## 场景提取功能

### 工作流

```
输入小说文本
    ↓
点击「提取场景」按钮
    ↓
使用 LLM + SCENE_EXTRACTION 模版提取场景
    ↓
解析 JSON 响应
    ↓
保存到 project.scenes
```

### 场景提取 Prompt 模版

新增 4 个预设模版：

1. **通用版** - 适合大多数小说
2. **动漫风格** - 注重动漫化的场景描述
3. **写实风格** - 注重真实场景描写
4. **古风/武侠** - 适合古风/武侠小说

### 提取 JSON 格式

```json
[
  {
    "name": "场景名称",
    "description": "详细的场景视觉描述"
  }
]
```

## 分镜自动关联

### 关联逻辑

在按行拆分剧本后，自动为每个分镜：

1. **关联场景**
   - 通过文本相似度匹配，找到最相关的场景
   - 简单实现：关键词匹配 + 相似度计算
   - 将 sceneId 设置为匹配的场景 ID

2. **关联角色**
   - 通过文本匹配，找到分镜中提到的角色
   - 将 characterIds 设置为匹配的角色 ID 列表

### 手动修改

用户可以：
- 在分镜卡片上点击修改关联的场景
- 在分镜卡片上修改关联的角色

## 图片提示词生成增强

### 上下文范围

对于第 N 个分镜，使用以下分镜作为上下文：

- **前5个分镜**: sb[N-5], sb[N-4], sb[N-3], sb[N-2], sb[N-1]（如果存在）
- **当前分镜**: sb[N]
- **后5个分镜**: sb[N+1], sb[N+2], sb[N+3], sb[N+4], sb[N+5]（如果存在）

最多 11 个分镜。

### 边界处理

- **第一个分镜**：只使用后面 5 个分镜
- **最后一个分镜**：只使用前面 5 个分镜
- **中间分镜**：使用前后各 5 个分镜

### 上下文信息

每个分镜的完整信息：
- sceneDescription（画面描述）
- dialogue（台词）
- narration（旁白）
- characterIds（关联角色）
- sceneId（关联场景）

### 提示词内容

生成图片提示词时，输入包括：
1. 当前分镜的 sceneDescription
2. 关联角色的描述
3. 关联场景的描述
4. 前后分镜的上下文摘要

## API 端点设计

### 场景管理 API（新增 api/scenes.py）

```python
# 提取场景
POST /api/projects/{project_id}/scenes/extract
Response: { scenes: Scene[], scenesExtracted: int }

# 列出场景
GET /api/projects/{project_id}/scenes
Response: List[Scene]

# 更新场景
PUT /api/projects/{project_id}/scenes/{scene_id}
Request: { name?: str, description?: str }
Response: Scene

# 删除场景
DELETE /api/projects/{project_id}/scenes/{scene_id}
Response: { success: bool }
```

### 分镜拆分 API 更新

在 `POST /api/projects/{project_id}/storyboards/split` 后：
- 自动关联场景
- 自动关联角色

### 生成提示词 API 更新

在 `POST /api/projects/{project_id}/storyboards/generate-prompts` 中：
- 使用增强的上下文生成图片提示词

## LLM 客户端新增方法

### LLMClient 接口

```python
class LLMClient:
    # ... 现有方法 ...

    async def extract_scenes(
        self,
        novel_text: str,
        project: Optional[Project] = None,
        global_settings: Optional[GlobalSettings] = None
    ) -> List[Dict[str, Any]]:
        """提取场景列表"""

    async def generate_image_prompt_enhanced(
        self,
        storyboard: Storyboard,
        project: Project,
        surrounding_storyboards: List[Storyboard],
        global_settings: Optional[GlobalSettings] = None
    ) -> str:
        """使用增强上下文生成图片提示词"""
```

### OllamaClient 实现

```python
class OllamaClient:
    # ... 现有方法 ...

    async def extract_scenes(...):
        """使用 SCENE_EXTRACTION 模版提取场景"""
        chunks = self._chunk_text(novel_text)
        for chunk in chunks:
            template = prompt_template_manager.get_resolved_template(
                PromptType.SCENE_EXTRACTION, project, global_settings
            )
            system_prompt, user_prompt = prompt_template_manager.render_template(
                template, chunk=chunk
            )
            response = await self.generate(user_prompt, system_prompt)
            # 解析 JSON...

    async def generate_image_prompt_enhanced(...):
        """构建增强的上下文，生成图片提示词"""
        template = prompt_template_manager.get_resolved_template(
            PromptType.IMAGE_PROMPT, project, global_settings
        )
        # 构建上下文信息...
        # 渲染模版...
```

## 前端 UI 设计

### 场景列表区域

在 ProjectEditor 中，角色管理旁边新增场景管理区域：

```
[角色管理] [场景管理] [剧本拆分] ...
                      ↓
        ┌─────────────────────┐
        │ 场景列表            │
        ├─────────────────────┤
        │ [提取场景] 按钮      │
        ├─────────────────────┤
        │ 场景卡片 1           │
        │ • 森林中的小屋       │
        │ • 描述: ...         │
        │ [编辑]              │
        ├─────────────────────┤
        │ 场景卡片 2           │
        │ ...                 │
        └─────────────────────┘
```

### 分镜卡片增强

每个分镜卡片显示：
- 场景标签（关联的场景名称）
- 角色标签（关联的角色名称）
- 点击场景标签可修改关联的场景

### API 类型更新（frontend/src/services/api.ts）

```typescript
export interface Scene {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Storyboard {
  // ... 现有字段 ...
  sceneId?: string;  // 新增
}

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

## 文件清单

### 新增文件

- `backend/api/scenes.py` - 场景管理 API 端点

### 修改文件

**后端:**
- `backend/models/schemas.py`
  - 新增 `Scene` 模型
  - 新增 `PromptType.SCENE_EXTRACTION`
  - `Project` 新增 `scenes` 字段
  - `Storyboard` 新增 `sceneId` 字段
  - `UpdateStoryboardRequest` 新增 `sceneId` 字段

- `backend/core/prompt_templates.py`
  - 新增 4 个 SCENE_EXTRACTION 预设模版
  - 新增 `_get_variables_for_type` 对 SCENE_EXTRACTION 的支持

- `backend/core/llm.py`
  - 新增 `extract_scenes` 方法
  - 新增 `generate_image_prompt_enhanced` 方法

- `backend/core/ollama.py`
  - 实现 `extract_scenes` 方法
  - 实现 `generate_image_prompt_enhanced` 方法

- `backend/core/openai_client.py`
  - 实现 `extract_scenes` 方法
  - 实现 `generate_image_prompt_enhanced` 方法

- `backend/api/generation.py`
  - 分镜拆分后自动关联场景和角色
  - 生成提示词时使用增强上下文

- `backend/api/projects.py`
  - （如果需要分镜更新 sceneId）

- `backend/main.py`
  - 注册 `scenes` 路由

**前端:**
- `frontend/src/services/api.ts`
  - 新增 `Scene` 接口
  - `Storyboard` 新增 `sceneId` 字段
  - 新增 `sceneApi` 方法

- `frontend/src/pages/ProjectEditor.tsx`
  - 新增场景列表 UI
  - 分镜卡片显示场景和角色标签
  - 支持修改分镜关联的场景

## 风险与注意事项

1. **场景-分镜匹配**：初期使用简单的文本匹配，后期可以优化为更智能的匹配算法
2. **上下文长度**：前后 5 个分镜的上下文可能会很长，需要控制 token 用量
3. **向后兼容**：已有的项目没有 scenes 字段和 sceneId 字段，需要正确处理默认值

## 测试计划

1. 场景提取功能测试
2. 分镜自动关联场景/角色测试
3. 图片提示词增强生成测试
4. 场景管理 UI 测试
5. 分镜场景修改测试
