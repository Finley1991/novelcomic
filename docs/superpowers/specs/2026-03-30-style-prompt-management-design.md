# 风格提示词管理功能设计文档

**日期:** 2026-03-30
**版本:** 1.0

## 概述

在现有的提示词管理功能基础上，新增风格提示词独立管理模块。基于现有的 txt 文本文件进行存储和修改，提供列表式编辑、大模型仿写、测试生图等功能。

## 目标

- 新建独立的 `StylePromptManager`，不改动现有的 `ImagePromptManager`
- 按风格分类管理提示词，每个风格对应一个 txt 文件
- 提供列表式编辑界面，每个提示词可独立编辑、删除、测试
- 支持调用本地大模型一键仿写提示词
- 支持使用当前 ComfyUI 配置测试提示词生图效果
- 前端集成到现有的提示词管理页面

## 数据模型和存储结构

### 存储位置

- 风格提示词目录：`settings.style_prompts_path` → `data/style_prompts/`
- 临时图片目录：`data/tmp/`（自动创建）

### 文件命名规则

风格名称到文件名的转换规则：
- 中文转拼音/英文
- 空格转下划线
- 全小写

示例映射：
- "动漫风格" → `anime_style.txt`
- "写实风格" → `photorealistic.txt`
- "古风武侠" → `wuxia_style.txt`

### TXT 文件格式

```txt
masterpiece, best quality, ultra detailed
anime style, cel shading, vibrant colors
1girl, blonde hair, blue eyes
```

规则说明：
- **每行一个提示词**
- 空行自动忽略
- 行首行尾自动 trim

### 后端数据模型

```python
from pydantic import BaseModel
from typing import List

class StylePromptList(BaseModel):
    styleName: str           # 风格名称，如 "动漫风格"
    fileName: str            # 文件名，如 "anime_style.txt"
    prompts: List[str]       # 提示词列表（按行）

class ParaphraseRequest(BaseModel):
    originalPrompt: str      # 原始提示词
    count: int               # 生成数量
    requirement: str         # 额外需求描述

class ParaphraseResponse(BaseModel):
    generatedPrompts: List[str]  # 生成的提示词列表

class TestImageRequest(BaseModel):
    prompt: str             # 要测试的提示词

class TestImageResponse(BaseModel):
    filename: str           # 生成的图片文件名
```

## 后端 API 设计

### 新建文件

- `backend/core/style_prompt_manager.py` - 风格提示词管理器
- `backend/api/style_prompts.py` - 风格提示词 API

### API 端点

#### 风格管理

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/style-prompts/styles` | 列出所有风格 |
| POST | `/api/style-prompts/styles` | 创建新风格 |
| PUT | `/api/style-prompts/styles/{style_name}` | 重命名风格 |
| DELETE | `/api/style-prompts/styles/{style_name}` | 删除风格 |

#### 提示词管理

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/style-prompts/styles/{style_name}/prompts` | 获取风格下的所有提示词 |
| POST | `/api/style-prompts/styles/{style_name}/prompts` | 添加新提示词 |
| PUT | `/api/style-prompts/styles/{style_name}/prompts/{index}` | 修改提示词（按索引） |
| DELETE | `/api/style-prompts/styles/{style_name}/prompts/{index}` | 删除提示词（按索引） |
| POST | `/api/style-prompts/styles/{style_name}/prompts/batch` | 批量追加提示词 |

#### 仿写和测试

| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/api/style-prompts/paraphrase` | 大模型仿写提示词 |
| POST | `/api/style-prompts/test-image` | 测试提示词生图 |
| GET | `/api/style-prompts/test-image/{filename}` | 获取生成的图片 |

### StylePromptManager 核心方法

```python
class StylePromptManager:
    def __init__(self):
        self.style_dir = Path(settings.style_prompts_path)
        self.tmp_dir = Path(settings.data_dir) / "tmp"
        self._ensure_dirs()

    def _ensure_dirs(self):
        self.style_dir.mkdir(parents=True, exist_ok=True)
        self.tmp_dir.mkdir(parents=True, exist_ok=True)

    def _style_name_to_filename(self, style_name: str) -> str:
        """风格名称转文件名"""
        # 实现中文转拼音/英文，空格转下划线，全小写
        pass

    def _filename_to_style_name(self, filename: str) -> str:
        """文件名转风格名称（从映射表读取）"""
        pass

    # ===== 风格管理 =====
    def list_styles(self) -> List[StylePromptList]:
        """列出所有风格"""
        pass

    def create_style(self, style_name: str) -> StylePromptList:
        """创建新风格"""
        pass

    def rename_style(self, old_name: str, new_name: str) -> StylePromptList:
        """重命名风格"""
        pass

    def delete_style(self, style_name: str) -> bool:
        """删除风格"""
        pass

    # ===== 提示词管理 =====
    def get_prompts(self, style_name: str) -> List[str]:
        """获取风格下的所有提示词"""
        pass

    def add_prompt(self, style_name: str, prompt: str) -> List[str]:
        """添加新提示词"""
        pass

    def update_prompt(self, style_name: str, index: int, new_prompt: str) -> List[str]:
        """修改提示词（按索引）"""
        pass

    def delete_prompt(self, style_name: str, index: int) -> List[str]:
        """删除提示词（按索引）"""
        pass

    def batch_append_prompts(self, style_name: str, prompts: List[str]) -> List[str]:
        """批量追加提示词"""
        pass

    # ===== 仿写功能 =====
    async def paraphrase_prompt(
        self,
        original: str,
        count: int,
        requirement: str
    ) -> List[str]:
        """大模型仿写提示词"""
        pass

    # ===== 测试生图 =====
    async def test_generate_image(self, prompt: str) -> str:
        """测试提示词生图，返回文件名"""
        pass
```

## 前端界面设计

### 页面结构

在现有的提示词管理页面（PromptManager）增加一个新标签页：

```
┌─────────────────────────────────────────────────────────────────┐
│  ← 返回                         Prompt 模板管理器          │
├─────────────────────────────────────────────────────────────────┤
│ [角色提取] [分镜拆分] [图像生成] [风格提示词] ← 新增标签 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  风格提示词标签页内容：                                         │
│                                                                 │
│  ┌─────────────────────┬─────────────────────────────────────┐ │
│  │ 风格列表            │   提示词列表                        │ │
│  │                     │                                     │ │
│  │ [+ 新建风格]        │   当前风格：动漫风格                │ │
│  │                     │                                     │ │
│  │ ◉ 动漫风格 ✓        │   [+ 添加提示词]   [✍️ 仿写]      │ │
│  │ ○ 写实风格          │                                     │ │
│  │ ○ 古风武侠          │   ┌─────────────────────────────┐   │ │
│  │ ○ ...               │   │ ◉ masterpiece...        [✏️] │   │ │
│  │                     │   │                        [🗑️] │   │ │
│  │ [重命名] [删除]     │   │                        [🖼️ 测试]│   │ │
│  │                     │   ├─────────────────────────────┤   │ │
│  │                     │   │ ○ best quality...       [✏️] │   │ │
│  │                     │   │                        [🗑️] │   │ │
│  │                     │   │                        [🖼️ 测试]│   │ │
│  │                     │   └─────────────────────────────┘   │ │
│  └─────────────────────┴─────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 主要功能弹窗

#### 1. 仿写弹窗

```
┌─────────────────────────────────┐
│  仿写提示词                  [×] │
├─────────────────────────────────┤
│                                 │
│  原始提示词：                   │
│  ┌─────────────────────────┐   │
│  │ masterpiece, best...   │   │
│  └─────────────────────────┘   │
│                                 │
│  生成数量：[ 5 ] 个            │
│                                 │
│  额外需求：                     │
│  ┌─────────────────────────┐   │
│  │ 更暗一点，增加神秘感... │   │
│  └─────────────────────────┘   │
│                                 │
│        [生成中...]              │
│                                 │
│  生成结果（可勾选）：           │
│  ┌─────────────────────────┐   │
│  │ ✓ dark masterpiece...  │   │
│  │ ✓ mysterious, best...  │   │
│  │ ○ moody lighting...   │   │
│  └─────────────────────────┘   │
│                                 │
│              [取消]  [追加]     │
└─────────────────────────────────┘
```

#### 2. 测试生图弹窗

```
┌─────────────────────────────────┐
│  测试提示词                [×] │
├─────────────────────────────────┤
│                                 │
│  提示词：                       │
│  masterpiece, best quality...   │
│                                 │
│        [生成中...]              │
│                                 │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  │      (加载/图片)        │   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│              [关闭]  [重新生成] │
└─────────────────────────────────┘
```

## 集成点和数据流

### 1. 大模型仿写集成

**使用的模型：**
- 优先使用用户配置的 LLM（Ollama 或 OpenAI）
- 使用现有的 LLM 客户端（`core/ollama.py` 或 `core/openai_client.py`）

**仿写提示词模板：**
```
你是一个专业的 AI 绘画提示词工程师。
请根据以下原始提示词，生成 {count} 个类似但不同的提示词。

原始提示词：
{original_prompt}

额外要求：
{requirement}

请只返回提示词列表，每行一个，不要任何解释。
```

### 2. 测试生图集成

**使用现有的 ComfyUI 客户端：**
- 复用 `core/comfyui.py` 的 `ComfyUIClient`
- 使用当前全局激活的 ComfyUI 工作流和配置
- 临时图片保存到 `data/tmp/` 目录
- 文件名格式：`test_{timestamp}_{uuid}.png`

**测试时使用的场景：**
- 为了简化，测试时只使用风格提示词 + 一个简单的通用场景
- 通用场景：`1girl, simple background`（或其他中性提示词）

### 3. 路由注册

在 `backend/main.py` 中添加：
```python
from api import style_prompts

app.include_router(style_prompts.router)
```

### 4. 完整数据流示例

**添加提示词流程：**
```
用户点击"添加提示词"
    ↓
前端弹窗输入提示词
    ↓
POST /api/style-prompts/styles/{style_name}/prompts
    ↓
StylePromptManager 读取 txt 文件
    ↓
追加一行到文件末尾
    ↓
返回更新后的提示词列表
    ↓
前端刷新列表显示
```

**仿写流程：**
```
用户点击"仿写"
    ↓
弹窗选择原提示词、输入数量和需求
    ↓
POST /api/style-prompts/paraphrase
    ↓
调用 LLM 生成
    ↓
返回生成的提示词列表
    ↓
用户勾选要追加的
    ↓
POST /api/style-prompts/styles/{style_name}/prompts/batch
    ↓
追加到 txt 文件
    ↓
前端刷新列表
```

## 实施步骤

1. **后端数据模型和管理器**
   - 在 `models/schemas.py` 中添加风格提示词相关模型
   - 创建 `core/style_prompt_manager.py`
   - 实现风格和提示词的 CRUD 操作

2. **后端 API**
   - 创建 `api/style_prompts.py`
   - 实现所有 API 端点
   - 在 `main.py` 中注册路由

3. **仿写和生图功能**
   - 集成 LLM 客户端实现仿写
   - 集成 ComfyUI 客户端实现测试生图
   - 实现临时图片管理

4. **前端类型和 API**
   - 更新 `services/api.ts` 类型定义和 API 方法

5. **前端界面**
   - 在 `PromptManager.tsx` 中增加"风格提示词"标签页
   - 实现风格列表和提示词列表
   - 实现仿写弹窗和测试生图弹窗

6. **测试和文档**
   - 测试所有功能
   - 更新相关文档

## 注意事项

- 不改动现有的 `ImagePromptManager`，完全独立实现
- 使用轻量级方案，按行管理提示词，不需要复杂的元数据
- 临时图片目录 `data/tmp/` 需要定期清理（可后续实现）
- 风格名称和文件名的映射需要持久化（可以在 style_prompts 目录下放一个 `_mapping.json`）
