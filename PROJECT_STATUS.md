# NovelComic 项目状态

**更新日期:** 2026-03-17

## 项目概述

NovelComic 是一个将小说文本转换为漫剧视频的应用程序。它使用 LLM 进行角色提取和分镜拆分，使用 ComfyUI 生成图像，使用微软 TTS 生成音频，最后导出为剪映项目。

## 架构概览

```
novelcomic/
├── backend/          # FastAPI 后端
└── frontend/         # React + TypeScript 前端
```

## 后端文件结构

### 核心模块

| 文件 | 功能 | 状态 |
|------|------|------|
| `main.py` | FastAPI 应用入口，CORS 配置，路由注册 | ✅ 完成 |
| `config.py` | 全局配置（使用 pydantic_settings） | ✅ 完成 |
| `models/schemas.py` | Pydantic 数据模型 | ✅ 完成 |
| `core/storage.py` | 数据持久化（JSON 文件存储） | ✅ 完成 |

### LLM 相关模块

| 文件 | 功能 | 状态 |
|------|------|------|
| `core/llm.py` | 统一 LLM 客户端（支持 Ollama/OpenAI） | ✅ 完成 |
| `core/ollama.py` | Ollama API 客户端 | ✅ 完成 |
| `core/openai_client.py` | OpenAI API 客户端（支持代理） | ✅ 完成 |
| `core/retry.py` | 异步重试装饰器 | ✅ 完成 |

### API 路由

| 文件 | 功能 | 状态 |
|------|------|------|
| `api/projects.py` | 项目、角色、分镜、设置 API | ✅ 完成 |
| `api/generation.py` | 图像/音频生成 API | ✅ 完成 |
| `api/export.py` | 剪映导出 API | ✅ 完成 |
| `api/comfyui_workflows.py` | ComfyUI 工作流管理 API | ✅ 完成 |
| `api/settings.py` | Settings API（新增） | ✅ 完成 |

### 其他核心模块

| 文件 | 功能 | 状态 |
|------|------|------|
| `core/comfyui.py` | ComfyUI 图像生成客户端 | ✅ 完成 |
| `core/tts.py` | 微软 TTS 音频生成客户端（含 Token 缓存） | ✅ 完成 |
| `core/jianying.py` | 剪映项目导出 | ✅ 完成 |

## 前端文件结构

| 文件 | 功能 | 状态 |
|------|------|------|
| `src/main.tsx` | React 入口 | ✅ 完成 |
| `src/pages/Dashboard.tsx` | 项目列表页面 | ✅ 完成 |
| `src/pages/ProjectEditor.tsx` | 项目编辑页面（含角色声音配置） | ✅ 完成 |
| `src/pages/Settings.tsx` | 设置页面（含 LLM/TTS 测试） | ✅ 完成 |
| `src/services/api.ts` | API 客户端和类型定义 | ✅ 完成 |

## 核心功能实现

### 1. TTS 配音功能增强

**实现位置:**
- 后端: `models/schemas.py` - `TTSConfig` 模型
- 后端: `core/tts.py` - Token 缓存, tts_config 参数支持
- 后端: `api/generation.py` - 角色 ttsConfig 支持
- 前端: `ProjectEditor.tsx` - 角色声音配置 UI, 配音步骤增强

**配置字段 (TTSConfig):**
```python
voice: str    # 声音名称 (如 zh-CN-XiaoxiaoNeural)
rate: float   # 语速 (0.5x - 2.0x)
pitch: int    # 音调 (-100Hz - +100Hz)
```

**Token 缓存策略:**
- 内存缓存 + 文件缓存双重保障
- 缓存有效期: 9 分钟 (Azure Token 有效期为 10 分钟)
- 缓存文件位置: `data/tts_token_cache.json`

### 2. LLM 提供商切换

**实现位置:**
- 后端: `models/schemas.py` - `LLMProvider`, `LLMSettings`, `OpenAISettings`
- 后端: `core/llm.py` - `LLMClient` 统一接口
- 前端: `Settings.tsx` - LLM 提供商选择 UI

**配置字段 (OpenAISettings):**
```python
apiKey: str           # API 密钥
baseUrl: str          # Base URL (支持兼容 API)
model: str            # 模型名称 (如 gpt-4o, gpt-4)
timeout: int          # 超时时间(秒)
maxRetries: int       # 最大重试次数
chunkSize: int        # 文本分块大小
proxy: str            # HTTP 代理 URL (如 http://127.0.0.1:7897)
```

### 3. 代理支持

**实现位置:** `core/openai_client.py`

**关键代码:**
```python
# 创建 aiohttp session 时启用 trust_env
async with aiohttp.ClientSession(timeout=timeout, connector=connector, trust_env=True) as session:
    request_kwargs = {
        "url": url,
        "json": payload,
        "headers": headers
    }
    # 如果配置了代理，添加到请求参数
    if self.proxy and self.proxy.strip():
        request_kwargs["proxy"] = self.proxy
```

### 4. LLM 测试端点

**API 端点:** `POST /api/settings/llm/test`

**实现位置:** `api/projects.py:272-276`

**功能:**
- 使用当前配置的 LLM 提供商
- 发送简单测试提示："请用一句话介绍你自己。"
- 返回 `{success, provider, response, error}`

### 5. TTS 测试端点

**API 端点:** `POST /api/settings/tts/test`

**实现位置:** `api/settings.py`

**功能:**
- 使用当前配置的 TTS 设置
- 生成简单测试音频："你好，这是一个测试。"
- 返回 `{success, voice, duration, audioSize, error}`

### 6. 设置持久化

**存储位置:** `data/config.json`

**实现位置:** `core/storage.py:22-35`

**功能:**
- 自动加载保存的配置
- 向后兼容旧的 `ollama` 配置结构
- 支持新的 `llm` 嵌套配置结构

## 最近更新

### 添加的功能

1. **TTS 配音功能增强** (2026-03-17)
   - 新增 `TTSConfig` 数据模型
   - 角色独立声音配置：每个角色可配置独立的 TTS 参数
   - 支持配置：声音（voice）、语速（rate）、音调（pitch）
   - TTSClient Token 缓存优化（缓存 9 分钟）
   - 配音生成步骤增强：显示完整旁白/台词文本
   - 分镜独立配音生成按钮
   - 角色声音配置 UI：可展开的声音配置区域
   - 常用中文声音列表：Xiaoxiao, Yunxi, Yunyang, Xiaoyou, Xiaohan, Yunjian

2. **TTS 测试功能** (2026-03-17)
   - 新增 `POST /api/settings/tts/test` 端点
   - 前端新增"测试 TTS"按钮
   - 实时显示测试结果（成功/失败、声音、音频时长）

3. **ComfyUI 工作流参数配置** (2026-03-17)
   - 新增 `ComfyUIWorkflowParams` 数据模型
   - 每个工作流支持独立的默认参数配置
   - 支持配置：宽度、高度、CFG、Steps、Seed、Sampler、Batch Size
   - 支持正向提示词前缀/后缀
   - 支持否定提示词覆盖
   - 前端 UI 完整支持参数配置

4. **ComfyUI 工作流管理增强** (2026-03-17)
   - 工作流节点解析与映射配置
   - 支持设置激活工作流
   - 工作流数据持久化
   - 参数应用逻辑更新（保留工作流原值）

5. **Settings API 端点** (2026-03-17)
   - 新增 `GET /api/settings` 获取全局设置
   - 新增 `PUT /api/settings` 更新全局设置
   - 新增 `POST /api/settings/llm/test` 测试 LLM 连接

6. **OpenAI 支持** (2026-03-17)
   - 新增 `OpenAISettings` 模型，包含 proxy 字段
   - 新增 `OpenAIClient` 类，支持 aiohttp 代理
   - 新增 `LLMProvider` 枚举和 `LLMSettings` 模型
   - 新增统一的 `LLMClient` 接口

7. **代理配置** (2026-03-17)
   - OpenAI 设置中新增代理输入字段
   - 默认占位符: `http://127.0.0.1:7897`
   - 支持通过环境变量或 UI 配置

8. **LLM 测试功能** (2026-03-17)
   - 新增 `/api/settings/llm/test` 端点
   - 前端新增"测试连接"按钮
   - 显示测试结果（成功/失败、提供商、响应内容）

9. **前端 UI 更新** (2026-03-17)
   - LLM 提供商下拉选择 (Ollama / OpenAI)
   - 条件渲染对应提供商的设置表单
   - OpenAI 设置包含：API Key, Base URL, 模型, 代理
   - 测试结果显示区域
   - ComfyUI 工作流参数配置 UI
   - 角色声音配置 UI（声音选择器、语速滑块、音调滑块）

## API 端点列表

### 设置相关

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/settings` | 获取全局设置 |
| PUT | `/api/settings` | 更新全局设置 |
| POST | `/api/settings/llm/test` | 测试 LLM 连接 |
| POST | `/api/settings/tts/test` | 测试 TTS 连接 |

### ComfyUI 工作流相关

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/comfyui-workflows` | 列出所有工作流 |
| POST | `/api/comfyui-workflows` | 上传新工作流 |
| GET | `/api/comfyui-workflows/{id}` | 获取工作流详情 |
| PUT | `/api/comfyui-workflows/{id}` | 更新工作流（含参数配置） |
| DELETE | `/api/comfyui-workflows/{id}` | 删除工作流 |
| PUT | `/api/comfyui-workflows/{id}/activate` | 设置为激活工作流 |
| POST | `/api/comfyui-workflows/parse` | 解析工作流节点 |

### 项目相关

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/projects` | 列出所有项目 |
| POST | `/api/projects` | 创建新项目 |
| GET | `/api/projects/{id}` | 获取项目详情 |
| PUT | `/api/projects/{id}` | 更新项目 |
| DELETE | `/api/projects/{id}` | 删除项目 |

### 角色相关

| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/api/projects/{id}/characters/extract` | 自动抽取角色 |
| POST | `/api/projects/{id}/characters` | 创建角色 |
| PUT | `/api/projects/{id}/characters/{charId}` | 更新角色 |
| DELETE | `/api/projects/{id}/characters/{charId}` | 删除角色 |
| POST | `/api/projects/{id}/characters/{charId}/reference` | 上传角色参考图 |

### 分镜相关

| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/api/projects/{id}/storyboards/split` | 自动拆分分镜 |
| GET | `/api/projects/{id}/storyboards` | 列出分镜 |
| POST | `/api/projects/{id}/storyboards` | 创建分镜 |
| PUT | `/api/projects/{id}/storyboards/{sbId}` | 更新分镜 |
| DELETE | `/api/projects/{id}/storyboards/{sbId}` | 删除分镜 |
| PUT | `/api/projects/{id}/storyboards/reorder` | 重新排序分镜 |

### 生成相关

| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/api/projects/{id}/generate/image` | 生成单张图像 |
| POST | `/api/projects/{id}/generate/images` | 批量生成图像 |
| POST | `/api/projects/{id}/generate/audio` | 生成单个音频 |
| POST | `/api/projects/{id}/generate/audios` | 批量生成音频 |
| GET | `/api/projects/{id}/generate/status` | 获取生成状态 |

### 导出相关

| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/api/projects/{id}/export/jianying` | 导出剪映项目 |

## 配置说明

### 默认配置 (config.py)

```python
# ComfyUI
comfyui_api_url = "http://8.222.174.34:8188"

# Ollama
ollama_api_url = "http://8.222.174.34:11434"
ollama_model = "llama3"

# OpenAI
openai_base_url = "https://api.openai.com/v1"
openai_model = "gpt-4o"
```

### 环境变量支持

所有配置都可通过环境变量覆盖（使用大写 + 下划线）：
- `COMFYUI_API_URL`
- `OLLAMA_API_URL`
- `OLLAMA_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- 等等...

## 使用指南

### 配置 OpenAI + 代理

1. 启动应用（后端: `python main.py`, 前端: `npm run dev`）
2. 打开前端设置页面
3. 在"大模型设置"中选择 "OpenAI / 兼容 API"
4. 填写：
   - API Key: 你的 OpenAI API Key (sk-...)
   - Base URL: `https://api.openai.com/v1` (或兼容 API 地址)
   - 模型: `gpt-4o` 或 `gpt-4`
   - 代理: `http://127.0.0.1:7897` (如需要)
5. 点击"保存设置"
6. 点击"测试连接"验证配置

### 常见问题

**Q: 测试连接超时？**
- 检查代理是否正常运行
- 确认代理地址格式正确 (如 `http://127.0.0.1:7897`)
- 检查防火墙设置

**Q: 模型不存在错误？**
- 使用有效的模型名称: `gpt-4o`, `gpt-4`, `gpt-3.5-turbo`
- 不要使用不存在的模型如 `gpt-5-nano`

**Q: SSL 连接错误？**
- 确认代理支持 HTTPS
- 检查系统 SSL 证书

## 数据模型

### GlobalSettings

```python
class GlobalSettings:
    comfyui: ComfyUISettings
    llm: LLMSettings          # 新的 LLM 配置
    ollama: OllamaSettings    # 保留用于向后兼容
    tts: TTSSettings
    jianying: JianyingSettings
```

### LLMSettings

```python
class LLMSettings:
    provider: LLMProvider  # "ollama" 或 "openai"
    ollama: OllamaSettings
    openai: OpenAISettings
```

### OpenAISettings

```python
class OpenAISettings:
    apiKey: str = ""
    baseUrl: str = "https://api.openai.com/v1"
    model: str = "gpt-4o"
    timeout: int = 120
    maxRetries: int = 2
    chunkSize: int = 4000
    proxy: str = ""  # 新增
```

### TTSConfig

```python
class TTSConfig:
    voice: str = "zh-CN-XiaoxiaoNeural"
    rate: float = 1.0
    pitch: int = 0
```

### Character

```python
class Character:
    id: str
    name: str
    description: str
    characterPrompt: str
    negativePrompt: str
    referenceImages: List[str]
    loraName: Optional[str]
    loraWeight: float
    ttsConfig: Optional[TTSConfig] = None
```

### ComfyUIWorkflowParams

```python
class ComfyUIWorkflowParams:
    width: Optional[int] = None
    height: Optional[int] = None
    cfg: Optional[float] = None
    steps: Optional[int] = None
    seed: Optional[int] = None
    sampler: Optional[str] = None
    batchSize: Optional[int] = None
    positivePromptPrefix: Optional[str] = None
    positivePromptSuffix: Optional[str] = None
    negativePromptOverride: Optional[str] = None
```

### ComfyUIWorkflow

```python
class ComfyUIWorkflow:
    id: str
    name: str
    workflowData: Dict[str, Any]
    nodeMappings: ComfyUINodeMappings
    defaultParams: Optional[ComfyUIWorkflowParams] = None  # 新增
    isActive: bool = False
    createdAt: str
    updatedAt: str
```

## 已修复的问题

### 1. TTS 配置不从 storage 加载
- **问题**: TTSClient 使用 config.py 硬编码默认值，不从 storage.load_global_settings() 加载
- **修复**: 更新 TTSClient 接受 GlobalSettings 对象，更新 generation.py 从 storage 加载设置

### 2. LLM 客户端硬编码问题
- **问题**: `generation.py` 中硬编码使用 `OllamaClient()`，不支持 OpenAI
- **修复**: 替换为统一的 `LLMClient`，根据设置自动选择提供商

### 3. 代理配置导致连接失败
- **问题**: 默认代理 `http://127.0.0.1:7897` 导致 OpenAI 连接失败
- **修复**: 清空默认代理配置，用户按需配置

### 4. ComfyUI 采样器参数覆盖问题
- **问题**: 代码强制覆盖采样器等参数，与工作流原值不匹配
- **修复**: 移除强制覆盖，保留工作流原值，通过 defaultParams 可选配置

### 5. 缺失的 Settings API 端点
- **问题**: 前端调用 `/api/settings` 但后端没有实现
- **修复**: 新建 `backend/api/settings.py` 并在 `main.py` 注册

## 待办事项

- [ ] 添加更多 LLM 提供商支持 (Anthropic, etc.)
- [ ] 添加设置导入/导出功能
- [ ] 添加 LLM 使用量统计
- [ ] 添加配置验证
- [ ] 添加 TTS 试听功能
- [ ] 添加独立的配音管理页面

## 相关文档

- 后端: `README.md`
- 前端: `frontend/README.md`
- 设计文档: `docs/superpowers/specs/`
- 实施计划: `docs/superpowers/plans/`
