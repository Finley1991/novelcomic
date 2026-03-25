# 更新日志

## [Unreleased]

### 2026-03-25

#### 剪映草稿导出功能重大升级
- **集成 pyJianYingDraft 库**
  - 使用 capcut-mate 项目的 pyJianYingDraft 库直接创建和管理剪映草稿
  - 完全解决"媒体文件丢失"问题
  - 自动处理素材路径和时长
  - 正确添加视频和音频轨道
  - 支持剪映 5.9+ 格式

- **前端配置修复**
  - 修复 Vite 代理配置：从端口 8001 改为 8000
  - 修复前端"一直显示加载中"问题

- **API 端点**
  - 新增 `POST /api/projects/{projectId}/export/jianying` 导出剪映草稿
  - 返回 draft_id 和 draft_path

#### 技术改进
- 新增 `JianyingExporter` 类，完全重写剪映导出逻辑
- 使用 `DraftFolder.create_draft()` 创建草稿
- 使用 `VideoMaterial` 和 `AudioMaterial` 处理素材
- 使用 `VideoSegment` 和 `AudioSegment` 添加片段
- 音频片段时长自动限制为素材实际时长
- 图片素材支持任意时长显示

#### 文件清单
**新增文件:**
- `backend/core/assets/jianying_template/` - 剪映模板素材目录
- `docs/superpowers/specs/2026-03-24-jianying-draft-export-design.md` - 设计文档
- `docs/superpowers/plans/2026-03-24-jianying-draft-export.md` - 实施计划

**修改文件:**
- `backend/core/jianying_exporter.py` - 完全重写，使用 pyJianYingDraft 库
- `backend/config.py` - 添加剪映相关配置
- `backend/models/schemas.py` - 添加 JianyingSettings, ExportJianyingRequest
- `backend/api/export.py` - 剪映导出 API 端点
- `backend/main.py` - 启用 export 路由
- `backend/requirements.txt` - 添加 pymediainfo==7.0.1
- `frontend/src/services/api.ts` - 启用剪映类型和 API
- `frontend/src/pages/Settings.tsx` - 添加剪映设置界面
- `frontend/src/pages/ProjectEditor.tsx` - 添加导出剪映功能
- `frontend/vite.config.js` - 修复代理端口为 8000
- `README.md` - 更新功能说明和配置文档

### 2026-03-20

#### 剧本拆分功能优化
- **按行分割剧本**
  - 支持用户选择 1/2/3 行一个分镜
  - 原文直接填入 sceneDescription，不处理台词/旁白/角色
  - 更简单直观的分镜创建方式
- **自动批量生成提示词**
  - 分镜拆分后自动为所有分镜生成画图提示词（imagePrompt）
  - 新增 API 端点 `POST /api/projects/{projectId}/storyboards/generate-prompts`
  - 支持单独为指定分镜生成提示词
- **前端分镜提示词编辑**
  - 每个分镜显示可展开/收起的 imagePrompt 输入框
  - 支持手动编辑提示词，失焦自动保存
  - 显示提示词生成状态
- **音频生成修复**
  - 修复按行拆分后音频不生成的问题
  - 音频生成逻辑优先级：narration → dialogue → sceneDescription

#### 技术改进
- 新增 `SplitStoryboardRequest` Schema，支持 lines_per_storyboard 参数
- 新增 `GeneratePromptsRequest` 和 `GeneratePromptsResponse` Schema
- 新增 `_generate_prompts_for_project` 辅助函数
- 前端 TypeScript 类型完整更新
- 前端分镜列表 UI 优化，支持提示词展开编辑

#### 文件清单
**修改文件:**
- `backend/models/schemas.py` - 添加新的请求/响应 Schema
- `backend/api/generation.py` - 按行分割 + 自动生成提示词
- `frontend/src/services/api.ts` - TypeScript 类型和 API 方法更新
- `frontend/src/pages/ProjectEditor.tsx` - 行数选择、提示词编辑 UI

### 2026-03-18

#### 剪映草稿导出优化
- **更新草稿结构匹配真实剪映格式**
  - 添加完整的根级字段（version: 400000, new_version: 127.0.0, create_time, update_time, config, platform 等）
  - 添加所有 5 个标准轨道：Screen, Subtitle, ScreenTitle, TTS, Music
  - 字幕文本轨道自动添加对话/旁白
  - 完整的 material 字段结构
  - 添加 hdr_settings, uniform_scale, responsive_layout 等片段字段
  - 添加 attachment_editing.json 和 common_attachment 文件夹
  - 图片素材使用 type: "video" 并放在 video/ 文件夹
  - 使用独立的 path_placeholder_id

#### 已知问题
- **剪映草稿媒体丢失问题**：图片和音频文件在文件夹中存在，但剪映中显示媒体丢失
  - 需要进一步调试真实剪映草稿的路径解析机制
  - 可能需要分析剪映导入草稿时的路径映射逻辑

#### 性能优化
- **Ollama 响应速度大幅提升**
  - 在 OllamaClient 中添加 `"think": False` 参数
  - 禁用模型的思考推理过程
  - 实测响应速度提升 **87.2%** (从 125.66 秒降至 16.04 秒)
  - 保持输出质量的同时显著减少等待时间

#### 技术改进
- `backend/core/ollama.py` - 添加 `think: False` 参数到 API payload

### 2026-03-17

#### 新增功能
- **TTS 配音功能增强**
  - 角色独立声音配置：每个角色可配置独立的 TTS 参数
  - 支持配置：声音（voice）、语速（rate）、音调（pitch）
  - TTSClient Token 缓存：缓存 Azure TTS access token 9 分钟
  - 配音生成步骤增强：显示完整旁白/台词文本
  - 分镜独立配音生成按钮
  - 角色声音配置 UI：可展开的声音配置区域

- **TTS 测试功能**
  - 新增 `POST /api/settings/tts/test` 测试 TTS 连接
  - 前端新增"测试 TTS"按钮
  - 实时显示测试结果

- **ComfyUI 工作流参数配置**
  - 为每个工作流添加独立的默认参数配置
  - 支持配置：宽度、高度、CFG、Steps、Seed、Sampler、Batch Size
  - 支持正向提示词前缀/后缀
  - 支持否定提示词覆盖
  - 前端 UI 完整支持参数配置

- **ComfyUI 工作流管理增强**
  - 工作流节点解析与映射配置
  - 支持设置激活工作流
  - 工作流数据持久化

- **settings API 端点**
  - 新增 `GET /api/settings` 获取全局设置
  - 新增 `PUT /api/settings` 更新全局设置
  - 新增 `POST /api/settings/llm/test` 测试 LLM 连接

#### 修复
- 修复 TTS 配置不从 storage 加载的问题
- 修复 LLM 客户端硬编码问题，统一使用 LLMClient
- 修复代理配置导致的连接失败问题（清空默认代理）
- 修复 ComfyUI 采样器参数覆盖问题，保留工作流原值
- 修复缺失的 settings API 端点

#### 技术改进
- 新增 `TTSConfig` 数据模型
- 新增 `Character` 模型的 `ttsConfig` 字段
- 更新 `TTSClient` 支持 token 缓存和 tts_config 参数
- 更新 `generation.py` 支持角色 ttsConfig
- 新增 `ComfyUIWorkflowParams` 数据模型
- 新增 `ComfyUIWorkflow` 模型的 `defaultParams` 字段
- 更新 `comfyui.py` 的 `_apply_workflow_mappings` 方法支持参数应用
- 前端类型定义完整更新

#### 文件清单
**新增文件:**
- `backend/api/settings.py` - Settings API 端点
- `docs/superpowers/specs/2026-03-17-tts-enhancements-design.md` - TTS 增强设计文档
- `docs/superpowers/plans/2026-03-17-tts-enhancements.md` - TTS 增强实施计划
- `docs/superpowers/specs/2026-03-17-workflow-params-config-design.md` - 设计文档
- `docs/superpowers/plans/2026-03-17-workflow-params-config.md` - 实施计划

**修改文件:**
- `backend/models/schemas.py` - 添加 TTSConfig, 更新 Character
- `backend/core/tts.py` - Token 缓存, tts_config 参数支持
- `backend/api/generation.py` - 支持角色 ttsConfig
- `backend/api/projects.py` - 添加 TTS 测试端点
- `backend/main.py` - 注册 settings 路由
- `frontend/src/services/api.ts` - TypeScript 类型定义更新
- `frontend/src/pages/ProjectEditor.tsx` - 配音步骤增强, 角色声音配置 UI
- `frontend/src/pages/Settings.tsx` - TTS 测试 UI, 工作流参数配置 UI
- `README.md` - 功能说明更新

### 2026-03-17 (之前)

#### 新增功能
- **OpenAI / 兼容 API 支持**
  - 添加了 `LLMProvider` 枚举，支持 Ollama 和 OpenAI 两种提供商
  - 新增 `OpenAISettings` 数据模型，包含完整的 OpenAI 配置选项
  - 新增 `LLMSettings` 嵌套配置结构
  - 新增 `OpenAIClient` 客户端类，使用 aiohttp 进行异步请求
  - 新增 `LLMClient` 统一接口，自动根据配置选择提供商

- **代理支持**
  - 在 `OpenAISettings` 中添加 `proxy` 字段
  - `OpenAIClient` 支持通过 HTTP 代理发送请求
  - 支持 `http://127.0.0.1:7897` 等本地代理格式
  - 使用 aiohttp 的 `trust_env=True` 确保代理正常工作

- **LLM 测试功能**
  - 新增 API 端点 `POST /api/settings/llm/test`
  - 前端新增"测试连接"按钮
  - 实时显示测试结果（成功/失败、提供商、响应内容）
  - 支持 60 秒超时保护

- **前端 UI 改进**
  - 新增 LLM 提供商下拉选择器
  - 条件渲染对应提供商的设置表单
  - OpenAI 设置表单包含：API Key、Base URL、模型、代理
  - 测试结果显示区域，支持成功/失败样式

#### 配置更新
- 更新 `config.py`，添加 OpenAI 相关配置项
- 更新 `.env` 和 `.env.example`，添加 OpenAI 配置示例
- 更新 `README.md`，添加 OpenAI 和代理配置说明
- 新建 `PROJECT_STATUS.md`，详细记录项目当前状态

#### 向后兼容
- 保留旧的 `ollama` 配置结构，用于向后兼容
- `LLMClient` 会优先使用新的 `llm.ollama` 配置，降级到旧的 `ollama` 配置
- 存储层自动处理新旧配置格式的迁移

#### 文件清单
**新增文件:**
- `backend/core/openai_client.py` - OpenAI API 客户端
- `backend/core/llm.py` - 统一 LLM 客户端接口
- `PROJECT_STATUS.md` - 项目状态文档
- `CHANGELOG.md` - 更新日志
- `backend/.env.example` - 环境变量示例

**修改文件:**
- `backend/models/schemas.py` - 添加 LLMProvider, LLMSettings, OpenAISettings
- `backend/config.py` - 添加 OpenAI 配置
- `backend/api/projects.py` - 添加 LLM 测试端点
- `backend/core/storage.py` - 保持向后兼容
- `frontend/src/services/api.ts` - 添加类型定义和 API 方法
- `frontend/src/pages/Settings.tsx` - 更新设置 UI
- `README.md` - 更新文档
- `backend/.env` - 添加 OpenAI 配置

## [0.1.0] - 2026-03-16

### 初始版本
- 项目基础架构
- 小说文本输入与项目管理
- 角色提取与管理
- 剧本分镜拆分
- 图片生成（ComfyUI）
- 配音生成（Microsoft TTS）
- 剪映草稿导出
