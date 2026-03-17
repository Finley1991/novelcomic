# Prompt 管理功能设计文档

**日期:** 2026-03-17
**版本:** 1.1

## 概述

为 NovelComic 应用添加灵活的 Prompt 模板管理功能，支持用户自定义角色提取、分镜拆分、图像生成的提示词，同时提供预设模板快速选择。

## 目标

- 支持自定义三种核心 LLM prompt：角色提取、分镜拆分、图像生成
- 提供预设模板，用户可一键选择
- 支持全局默认配置 + 项目级覆盖
- 提供友好的 UI 编辑体验，包含变量插入功能
- 支持模板的保存、复制、删除操作

## 数据模型设计

### PromptType 枚举

```python
class PromptType(str, Enum):
    CHARACTER_EXTRACTION = "character_extraction"
    STORYBOARD_SPLIT = "storyboard_split"
    IMAGE_PROMPT = "image_prompt"
```

### PromptVariable 模型

```python
class PromptVariable(BaseModel):
    name: str           # 变量名，如 "chunk"
    description: str    # 变量说明
    example: str        # 使用示例
```

### PromptTemplate 模型

```python
class PromptTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str                          # 模板名称
    description: str = ""              # 模板描述
    type: PromptType                   # 模板类型
    systemPrompt: str = ""             # System Prompt
    userPrompt: str = ""               # User Prompt
    isPreset: bool = False             # 是否为内置预设
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)
```

**说明：** 可用变量列表不由模板存储，而是根据 `type` 动态从 `PromptTemplateManager.get_variables(type)` 获取。

**预设模板 ID 命名规范：**
- 使用 `preset_` 前缀 + 类型 + 序号，如 `preset_character_extraction_1`
- 预设 ID 在代码中硬编码，保持稳定

### 更新 GlobalSettings

```python
class GlobalSettings(BaseModel):
    # ... 现有字段 ...
    defaultPromptTemplates: Dict[PromptType, str] = Field(default_factory=dict)
    # key: PromptType, value: templateId (空字符串表示使用预设1:通用版)
```

### 更新 Project

```python
class Project(BaseModel):
    # ... 现有字段 ...
    useCustomPrompts: bool = False       # 是否使用自定义 Prompt
    projectPromptTemplates: Dict[PromptType, str] = Field(default_factory=dict)
    # key: PromptType, value: templateId (空字符串表示使用全局默认)
```

**默认值策略与解析优先级：**

GlobalSettings.defaultPromptTemplates:
- 空字符串 → 使用预设 1（通用版）
- 非空字符串 → 使用指定的模板 ID

Project.projectPromptTemplates (仅当 useCustomPrompts=True 时生效):
- 空字符串 → 使用全局默认 (GlobalSettings.defaultPromptTemplates)
- 非空字符串 → 使用指定的模板 ID

**模板解析优先级（从高到低）：**
1. 项目级模板（当 useCustomPrompts=True 且 projectPromptTemplates[type] 非空）
2. 全局默认模板（当 GlobalSettings.defaultPromptTemplates[type] 非空）
3. 预设 1（通用版）- 兜底

**其他说明：**
- 预设 1 作为系统默认，与原来的硬编码行为一致
- 不再保留单独的硬编码逻辑，所有通过预设实现

## 后端架构

### 存储设计

- 用户模板存储位置：`data/prompt_templates.json`
- 预设模板：硬编码在 `core/prompt_templates.py` 中，不随用户修改而改变

### API 端点

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/prompts/templates` | 列出所有模板（预设 + 用户自定义），查询参数 `?type=xxx` 可过滤类型 |
| POST | `/api/prompts/templates` | 创建新模板 |
| GET | `/api/prompts/templates/{id}` | 获取模板详情 |
| PUT | `/api/prompts/templates/{id}` | 更新模板（预设不可修改） |
| DELETE | `/api/prompts/templates/{id}` | 删除模板（预设不可删除），查询参数 `?cascade=true` 可级联更新使用处为默认 |
| POST | `/api/prompts/templates/{id}/duplicate` | 复制模板，请求体 `{ "newName": "新名称" }` |
| GET | `/api/prompts/variables` | 获取所有可用变量列表，查询参数 `?type=xxx` |

**端点说明：**
- `/duplicate`：用于复制任意模板（用户模板或预设）
- `/presets` 端点移除，预设通过 `/templates?type=xxx` 过滤 `isPreset=true` 获取
- `DELETE /templates/{id}?cascade=true`：级联更新所有使用该模板的设置为默认（空字符串）

### 核心模块

#### `core/prompt_templates.py`

```python
class PromptTemplateManager:
    def load_all_templates(prompt_type: Optional[PromptType] = None) -> List[PromptTemplate]
    def get_template(template_id: str) -> Optional[PromptTemplate]
    def save_template(template: PromptTemplate) -> PromptTemplate
    def delete_template(template_id: str, cascade: bool = False) -> Tuple[bool, List[str]]
        # Returns: (success, list of projects/settings that were using this template)
    def duplicate_template(template_id: str, new_name: str) -> PromptTemplate
    def get_variables(prompt_type: PromptType) -> List[PromptVariable]
    def render_template(template: PromptTemplate, **kwargs) -> Tuple[str, str]
    def get_template_usages(template_id: str) -> List[str]
        # Returns list of descriptions where this template is used
    def get_preset_by_id(preset_id: str) -> Optional[PromptTemplate]
        # Get a preset template by its preset_* ID
```

**删除模板行为：**
- 检查模板是否在使用中
- 如果未使用：直接删除
- 如果在使用中且 `cascade=false`：返回使用列表，阻止删除
- 如果在使用中且 `cascade=true`：删除模板，并将所有使用处更新为默认（空字符串）

#### 更新 LLM 客户端

修改 `ollama.py` 和 `openai_client.py`：
- 新增 `prompt_template_manager` 依赖
- 在 `extract_characters()`, `split_storyboard()`, `generate_image_prompt()` 方法中：
  1. 检查是否有项目级模板且项目 `useCustomPrompts=True`
  2. 检查是否有全局默认模板
  3. 回退到预设 1（通用版）
- 使用 `PromptTemplateManager.render_template()` 进行变量替换

**迁移说明：**
- 现有代码的硬编码 prompt 已提取为预设 1
- 不再保留单独的硬编码逻辑，所有通过预设实现
- 空字符串模板 ID 表示使用预设 1

### 变量系统

每个 PromptType 有预定义的变量：

#### CHARACTER_EXTRACTION 变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `chunk` | 当前处理的小说文本片段 | "第一章 初遇..." |

#### STORYBOARD_SPLIT 变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `chunk` | 当前处理的小说文本片段 | "第一章 初遇..." |
| `characters` | 角色列表信息 | "角色：\n- 张三：..." |
| `current_index` | 当前分镜起始序号 | "0" |

#### IMAGE_PROMPT 变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `scene_description` | 分镜画面描述 | "森林中的小屋..." |
| `characters` | 角色提示词列表 | "角色提示词：\n- 张三：..." |
| `style_prompt` | 风格提示词 | "anime style..." |

## 前端架构

### 新增页面

#### `src/pages/PromptManager.tsx`

**布局：**
```
┌─────────────────────────────────────────────────────────────────┐
│  ← 返回                               Prompt 模板管理器          │
├─────────────────────────────────────────────────────────────────┤
│ [角色提取] [分镜拆分] [图像生成]                   ← 类型标签页  │
├──────────────────┬──────────────────────────────────────────────┤
│ 模板列表         │  模板编辑器                                    │
│                  │                                              │
│ ┌─────────────┐ │  [名称输入]                                   │
│ │ 预设        │ │  [描述输入]                                   │
│ │  ∘ 通用版 ✓ │ │                                              │
│ │  ∘ 动漫风格  │ │  ┌ System Prompt ─────────────────────────┐  │
│ │  ∘ 写实风格  │ │  │                                        │  │
│ │  ∘ 古风武侠  │ │  │  [大文本输入域]                        │  │
│ │             │ │  │                                        │  │
│ │ 我的模板    │ │  └────────────────────────────────────────┘  │
│ │  ∘ 我的模板1 │ │                                              │
│ │  ∘ 我的模板2 │ │  ┌ User Prompt ──────────────────────────┐  │
│ └─────────────┘ │  │                                        │  │
│                  │  │  [大文本输入域]                        │  │
│ [+ 新建模板]    │  │                                        │  │
│                  │  └────────────────────────────────────────┘  │
└──────────────────┴──────────────────────────────────────────────┘
                                 [变量] [预览] [复制] [保存] [删除]
```

**功能：**
- 顶部：PromptType 标签页（角色提取/分镜拆分/图像生成），切换时刷新模板列表
- 左侧：模板列表（分组显示预设和我的模板，仅显示当前类型的模板）
- 右侧：模板编辑器
  - 名称/描述输入
  - System Prompt 编辑（支持 CodeMirror 或简单 Textarea）
  - User Prompt 编辑
  - 变量工具栏：
    - 显示当前类型可用的所有变量
    - 点击变量名插入到光标位置
    - 显示变量说明
  - 预览按钮：显示变量替换后的效果（使用示例数据）
  - 操作按钮：
    - 复制：弹出对话框输入新名称，基于当前模板创建新模板
    - 保存：保存修改
    - 删除：删除模板（预设不可删除），删除时确认对话框显示使用位置，提供"级联更新"选项

### 更新现有页面

#### `src/pages/Settings.tsx`

新增"Prompt 模板"标签页：
- 为每个 PromptType 显示当前选择的默认模板
- 下拉选择器选项：
  - "预设：通用版"（值为空字符串，默认选中）
  - "预设：动漫风格"（值为 preset_*_2）
  - "预设：写实风格"（值为 preset_*_3）
  - "预设：古风/武侠"（值为 preset_*_4）
  - 分隔线
  - 任意已保存的用户模板
- 链接到 PromptManager 页面的"管理模板"按钮

#### `src/pages/ProjectEditor.tsx`

在角色提取和分镜拆分按钮附近：
- "使用自定义 Prompt"开关（控制 `useCustomPrompts` 字段）
- 开关关闭时：使用全局默认
- 开关打开后显示：
  - 为每个 PromptType 选择模板的下拉框
  - 下拉框选项：
    - "使用全局默认"（值为空字符串）
    - "预设：通用版"（值为 preset_*_1）
    - "预设：动漫风格"（值为 preset_*_2）
    - "预设：写实风格"（值为 preset_*_3）
    - "预设：古风/武侠"（值为 preset_*_4）
    - 分隔线
    - 任意已保存的用户模板

### 类型定义（`src/services/api.ts`）

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

// API methods
export const promptApi = {
  listTemplates: (type?: PromptType) => axios.get<PromptTemplate[]>(`/api/prompts/templates${type ? `?type=${type}` : ''}`),
  getTemplate: (id: string) => axios.get<PromptTemplate>(`/api/prompts/templates/${id}`),
  createTemplate: (data: Partial<PromptTemplate>) => axios.post<PromptTemplate>('/api/prompts/templates', data),
  updateTemplate: (id: string, data: Partial<PromptTemplate>) => axios.put<PromptTemplate>(`/api/prompts/templates/${id}`, data),
  deleteTemplate: (id: string, cascade?: boolean) => axios.delete(`/api/prompts/templates/${id}${cascade ? '?cascade=true' : ''}`),
  duplicateTemplate: (id: string, newName: string) => axios.post<PromptTemplate>(`/api/prompts/templates/${id}/duplicate`, { newName }),
  getVariables: (type: PromptType) => axios.get<PromptVariable[]>(`/api/prompts/variables?type=${type}`),
};
```

## 预设模板定义

### 预设 ID 规范

所有预设使用 `preset_{type}_{index}` 格式：
- `preset_character_extraction_1` - 通用版角色提取
- `preset_character_extraction_2` - 动漫风格角色提取
- `preset_storyboard_split_1` - 通用版分镜拆分
- 等等...

### 预设 1：通用版

**CHARACTER_EXTRACTION (preset_character_extraction_1):**
- System: "你是一个专业的小说角色提取助手。从小说文本中提取所有主要角色。"
- User:
```
从以下小说文本中提取所有主要角色。对每个角色提供：
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
```

**STORYBOARD_SPLIT (preset_storyboard_split_1):**
- System: "你是一个专业的漫剧分镜师。将小说拆分为多个分镜。"
- User:
```
{characters}

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
```

**IMAGE_PROMPT (preset_image_prompt_1):**
- System: "你是一个专业的AI绘画提示词工程师。将画面描述转换为Stable Diffusion提示词。"
- User:
```
{characters}
风格提示词：{style_prompt}

将以下画面描述转换为详细的Stable Diffusion英文提示词。要求：
- 详细的视觉描述
- 包含光影、氛围、构图等元素
- 使用英文

画面描述：
{scene_description}

仅返回提示词内容，不要其他说明。
```

### 预设 2：动漫风格

**CHARACTER_EXTRACTION (preset_character_extraction_2):**
- System: "你是一个专业的动漫角色设计助手。从小说文本中提取角色，注重动漫化的视觉特征。"
- User:
```
从以下小说文本中提取所有主要角色，以动漫风格进行描述。对每个角色提供：
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
```

**STORYBOARD_SPLIT (preset_storyboard_split_2):**
- System: "你是一个专业的动漫分镜师。将小说拆分为适合动漫表现的分镜。"
- User:
```
{characters}

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
```

**IMAGE_PROMPT (preset_image_prompt_2):**
- System: "你是一个专业的动漫AI绘画提示词工程师。将画面描述转换为动漫风格的Stable Diffusion提示词。"
- User:
```
{characters}
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
```

### 预设 3：写实风格

**CHARACTER_EXTRACTION (preset_character_extraction_3):**
- System: "你是一个专业的角色分析助手。从小说文本中提取角色，注重真实的人物描写。"
- User:
```
从以下小说文本中提取所有主要角色，以写实风格进行描述。对每个角色提供：
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
```

**STORYBOARD_SPLIT (preset_storyboard_split_3):**
- System: "你是一个专业的电影分镜师。将小说拆分为适合电影表现的分镜。"
- User:
```
{characters}

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
```

**IMAGE_PROMPT (preset_image_prompt_3):**
- System: "你是一个专业的写实摄影提示词工程师。将画面描述转换为写实风格的Stable Diffusion提示词。"
- User:
```
{characters}
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
```

### 预设 4：古风/武侠

**CHARACTER_EXTRACTION (preset_character_extraction_4):**
- System: "你是一个专业的古风小说角色设计助手。从小说文本中提取武侠/古风角色。"
- User:
```
从以下小说文本中提取所有主要角色，以古风/武侠风格进行描述。对每个角色提供：
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
```

**STORYBOARD_SPLIT (preset_storyboard_split_4):**
- System: "你是一个专业的武侠剧分镜师。将小说拆分为适合武侠/古风表现的分镜。"
- User:
```
{characters}

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
```

**IMAGE_PROMPT (preset_image_prompt_4):**
- System: "你是一个专业的古风绘画提示词工程师。将画面描述转换为古风/武侠风格的Stable Diffusion提示词。"
- User:
```
{characters}
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
```

## 实施步骤

1. **后端数据模型**
   - 在 `models/schemas.py` 中添加 PromptType, PromptVariable, PromptTemplate
   - 更新 GlobalSettings 和 Project 模型

2. **后端存储和管理**
   - 创建 `core/prompt_templates.py`
   - 更新 `core/storage.py` 支持模板存储
   - 创建预设模板定义（完整的 prompt 文本）

3. **后端 API**
   - 创建 `api/prompts.py`
   - 在 `main.py` 注册路由

4. **后端 LLM 集成**
   - 更新 `ollama.py` 支持模板加载和变量替换
   - 更新 `openai_client.py` 同上
   - 更新 `generation.py` 传递项目/全局设置

5. **前端类型和 API**
   - 更新 `services/api.ts` 类型定义和 API 方法

6. **前端 PromptManager 页面**
   - 创建 `pages/PromptManager.tsx`
   - 实现模板列表和编辑器
   - 实现变量插入功能
   - 实现预览功能

7. **前端 Settings 更新**
   - 在 Settings 页面添加 Prompt 模板标签页

8. **前端 ProjectEditor 更新**
   - 添加项目级 Prompt 模板选择（开关 + 下拉框）

9. **测试和文档**
   - 测试所有功能
   - 更新 README 和 PROJECT_STATUS

## 注意事项

- 预设模板是只读的，用户只能复制后修改
- 变量替换使用简单的 `{var_name}` 语法
  - 如需输出字面量 `{` 或 `}`，使用 `{{` 或 `}}` 转义
- 删除模板前检查是否有项目或全局设置在使用
  - 未使用：直接删除
  - 已使用且 `cascade=false`：阻止删除并显示使用位置
  - 已使用且 `cascade=true`：删除模板并将所有使用处更新为空字符串（使用预设 1）
- 提供优雅的降级：如果配置的模板不存在，使用预设 1（通用版）
- 预设 ID 使用 `preset_` 前缀，保持稳定
- 模板名称长度限制：1-100 字符
- System Prompt 和 User Prompt 可以为空，但建议至少填写一个
