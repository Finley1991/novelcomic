# 图片生成提示词预设管理 - 设计文档

**日期:** 2026-03-21

## 概述

为小说推文 AI 漫剧生成工具新增图片生成提示词预设管理功能，支持提示词片段库和可组合模板，提升图片生成提示词的复用性和灵活性。

## 目标

1. **提示词片段库**: 分类管理可复用的提示词片段
2. **可组合模板**: 定义片段组合方式和变量插入位置
3. **变量支持**: 支持插入分镜内容、角色提示词等动态变量
4. **独立管理页面**: 类似 Prompt 管理器的独立页面
5. **项目编辑器集成**: 在分镜列表中可快速选择使用模板

## 数据模型

### 后端数据模型 (schemas.py)

#### PromptSnippetCategory (枚举)

提示词片段分类：

```python
class PromptSnippetCategory(str, Enum):
    STYLE = "style"        # 风格
    QUALITY = "quality"    # 质量
    LIGHTING = "lighting"  # 光照
    COMPOSITION = "composition"  # 构图
    CUSTOM = "custom"      # 自定义
```

#### PromptSnippet (提示词片段)

```python
class PromptSnippet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str                    # 片段名称，如"动漫风格"
    description: str = ""        # 描述
    category: PromptSnippetCategory  # 分类
    content: str                 # 提示词内容，如"anime style, cel shading"
    isPreset: bool = False       # 是否预设
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)
```

#### ImagePromptTemplate (提示词模板)

```python
class ImagePromptTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str                    # 模板名称，如"动漫高质量"
    description: str = ""
    template: str                # 模板字符串，如"{quality}, {lighting}, {scene}, {style}"
    snippetIds: List[str] = Field(default_factory=list)  # 默认选中的片段 ID
    isPreset: bool = False
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)
```

### 前端类型定义 (api.ts)

```typescript
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
  template: string;  // e.g., "{quality}, {lighting}, {scene}, {style}"
  snippetIds: string[];
  isPreset: boolean;
  createdAt: string;
  updatedAt: string;
}

// 模板支持的变量
export type ImagePromptVariable =
  | 'scene'        // 分镜的 sceneDescription
  | 'characters'   // 角色提示词
  | 'style_prompt' // 项目的 stylePrompt
  | 'custom';      // 自定义内容

// 渲染请求
export interface RenderImagePromptRequest {
  scene?: string;
  characterPrompts?: string;
  stylePrompt?: string;
  custom?: string;
  additionalSnippets?: string[];  // 额外添加的片段
}

// 渲染响应
export interface RenderImagePromptResponse {
  renderedPrompt: string;
}
```

## API 端点设计

### 提示词片段管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/image-prompts/snippets` | 获取所有片段，支持 `?category=style` 过滤 |
| POST | `/api/image-prompts/snippets` | 创建新片段 |
| GET | `/api/image-prompts/snippets/{id}` | 获取单个片段 |
| PUT | `/api/image-prompts/snippets/{id}` | 更新片段（预设不可修改） |
| DELETE | `/api/image-prompts/snippets/{id}` | 删除片段（预设不可删除） |
| POST | `/api/image-prompts/snippets/{id}/duplicate` | 复制片段 |

### 提示词模板管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/image-prompts/templates` | 获取所有模板 |
| POST | `/api/image-prompts/templates` | 创建新模板 |
| GET | `/api/image-prompts/templates/{id}` | 获取单个模板 |
| PUT | `/api/image-prompts/templates/{id}` | 更新模板（预设不可修改） |
| DELETE | `/api/image-prompts/templates/{id}` | 删除模板（预设不可删除） |
| POST | `/api/image-prompts/templates/{id}/duplicate` | 复制模板 |
| POST | `/api/image-prompts/templates/{id}/render` | 渲染模板，生成最终提示词 |

### 渲染模板 API

**请求:**
```json
POST /api/image-prompts/templates/{id}/render
{
  "scene": "森林中的小屋",
  "characterPrompts": "1girl, long hair",
  "stylePrompt": "watercolor style",
  "additionalSnippets": ["snippet_id_1", "snippet_id_2"]
}
```

**响应:**
```json
{
  "renderedPrompt": "masterpiece, best quality, cinematic lighting, 森林中的小屋, 1girl, long hair, anime style, cel shading"
}
```

## 存储结构

存储在 `data/image_prompts.json`：

```json
{
  "snippets": [
    {
      "id": "preset_style_anime",
      "name": "动漫风格",
      "description": "适合动漫风格的提示词",
      "category": "style",
      "content": "anime style, cel shading, vibrant colors",
      "isPreset": true,
      "createdAt": "2026-03-21T00:00:00",
      "updatedAt": "2026-03-21T00:00:00"
    }
  ],
  "templates": [
    {
      "id": "preset_template_anime_quality",
      "name": "动漫高质量",
      "description": "动漫风格高质量提示词",
      "template": "{quality}, {lighting}, {scene}, {style}",
      "snippetIds": ["preset_quality_masterpiece", "preset_lighting_cinematic", "preset_style_anime"],
      "isPreset": true,
      "createdAt": "2026-03-21T00:00:00",
      "updatedAt": "2026-03-21T00:00:00"
    }
  ]
}
```

## 预设数据

### 预设提示词片段

| ID | 分类 | 名称 | 内容 |
|----|------|------|------|
| `preset_style_anime` | style | 动漫风格 | `anime style, cel shading, vibrant colors` |
| `preset_style_photorealistic` | style | 写实风格 | `photorealistic, sharp focus, ultra detailed` |
| `preset_style_wuxia` | style | 古风武侠 | `traditional Chinese art, wuxia style, ink painting` |
| `preset_quality_masterpiece` | quality | 高质量 | `masterpiece, best quality` |
| `preset_quality_8k` | quality | 8K超高清 | `8k, ultra detailed, high resolution` |
| `preset_lighting_cinematic` | lighting | 电影光感 | `cinematic lighting, dramatic shadows` |
| `preset_lighting_natural` | lighting | 自然光 | `natural lighting, soft shadows` |
| `preset_composition_closeup` | composition | 特写 | `close-up, portrait, detailed face` |
| `preset_composition_wide` | composition | 广角 | `wide angle, full body, environment` |

### 预设提示词模板

| ID | 名称 | 模板字符串 | 默认片段 |
|----|------|------------|----------|
| `preset_template_anime_quality` | 动漫高质量 | `{quality}, {lighting}, {scene}, {style}` | 高质量 + 电影光感 + 动漫风格 |
| `preset_template_photorealistic` | 写实电影感 | `{quality}, {lighting}, {scene}, {style}` | 高质量 + 电影光感 + 写实风格 |
| `preset_template_wuxia` | 古风武侠 | `{quality}, {scene}, {style}` | 高质量 + 古风武侠 |

## 前端 UI 设计

### 页面路由

- `/image-prompts` - 图片生成提示词管理页面

### 页面结构

```
┌─────────────────────────────────────────────────────────────┐
│  ← 返回         图片生成提示词管理                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  提示词片段  │  提示词模板                      │   │ ← 标签页
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [  左侧：分类/列表    ]  [  右侧：编辑器/预览    ]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 标签页 1：提示词片段管理

**左侧面板：**
- 分类筛选（全部、风格、质量、光照、构图、自定义）
- 片段列表（区分预设和用户创建）
- 新建片段按钮

**右侧面板：**
- 名称输入
- 分类下拉选择
- 描述输入
- 内容文本域
- 保存/取消/删除按钮

### 标签页 2：提示词模板管理

**左侧面板：**
- 模板列表（区分预设和用户创建）
- 新建模板按钮

**右侧面板：**
- 名称输入
- 描述输入
- 模板字符串编辑器
- 可用变量按钮（点击插入）
- 默认片段选择（多选）
- 预览区域（显示渲染后的提示词）
- 保存/取消/删除按钮

### 变量支持

模板字符串支持以下变量：

| 变量 | 描述 | 来源 |
|------|------|------|
| `{quality}` | 质量片段内容 | 模板选择的 quality 分类片段 |
| `{lighting}` | 光照片段内容 | 模板选择的 lighting 分类片段 |
| `{composition}` | 构图片段内容 | 模板选择的 composition 分类片段 |
| `{style}` | 风格片段内容 | 模板选择的 style 分类片段 |
| `{scene}` | 分镜画面描述 | 分镜的 sceneDescription |
| `{characters}` | 角色提示词 | 相关角色的 characterPrompt 拼接 |
| `{style_prompt}` | 项目风格提示词 | 项目的 stylePrompt |
| `{custom}` | 自定义内容 | 用户输入的自定义内容 |

### 项目编辑器集成

在分镜列表的提示词编辑区域添加：

1. **"使用模板"下拉按钮**
   - 列出所有可用模板
   - 点击后自动渲染并填入提示词

2. **提示词输入框保持可编辑**
   - 使用模板后用户仍可手动修改

## 渲染逻辑

### 模板渲染步骤

1. **收集片段内容**
   - 从 `snippetIds` 获取所有选中的片段
   - 按分类分组：quality、lighting、composition、style、custom
   - 同分类多个片段用逗号连接

2. **替换变量**
   - `{quality}` → 质量片段内容
   - `{lighting}` → 光照片段内容
   - `{composition}` → 构图片段内容
   - `{style}` → 风格片段内容
   - `{scene}` → 传入的 scene 参数
   - `{characters}` → 传入的 characterPrompts 参数
   - `{style_prompt}` → 传入的 stylePrompt 参数
   - `{custom}` → 传入的 custom 参数

3. **添加额外片段**
   - 将 `additionalSnippets` 中的片段内容追加到末尾

4. **清理**
   - 移除多余的逗号
   - 移除多余的空格

### 示例

模板：`{quality}, {lighting}, {scene}, {style}`

选中片段：
- quality: `masterpiece, best quality`
- lighting: `cinematic lighting`
- style: `anime style, cel shading`

传入参数：
- scene: `森林中的小屋`

渲染结果：
`masterpiece, best quality, cinematic lighting, 森林中的小屋, anime style, cel shading`

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

## 技术要点

1. **复用现有模式**: 参考 PromptTemplateManager 的实现模式
2. **预设保护**: 预设片段和模板不可修改/删除，只能复制
3. **变量渲染**: 简单的字符串替换，避免过度设计
4. **路由集成**: 与现有 Prompt 管理器保持一致的导航模式

## 后续扩展（可选）

1. **片段标签**: 支持为片段添加自定义标签
2. **片段搜索**: 支持按名称和内容搜索片段
3. **提示词权重**: 支持 Stable Diffusion 权重语法 `(keyword:1.5)`
4. **历史记录**: 保存使用过的提示词组合
