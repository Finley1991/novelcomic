# 更新日志

## [Unreleased]

### 2026-03-28

#### 解压视频混剪推文项目新功能
- **全新解压视频项目类型**
  - 新增 `ProjectType.DECOMPRESSION_VIDEO` 项目类型
  - 新增 `DecompressionProjectData` 数据模型
  - 新增 `DecompressionVideoEditor.tsx` 独立编辑页面
  - 原小说漫画编辑器重命名为 `NovelComicEditor.tsx`
  - Dashboard 支持两种项目类型的创建和显示

- **解压视频素材管理**
  - 新增 `VideoScanner` 类扫描视频素材目录
  - 支持自动扫描解压视频素材并获取时长
  - 智能视频选择算法：根据目标总时长自动选择视频组合
  - 视频素材缓存机制，避免重复扫描

- **风格提示词管理**
  - 新增 `StylePromptScanner` 类扫描风格提示词目录
  - 支持多级目录结构：`{style_name}/prompt.txt` 或 `{style_name}.txt`
  - 可选择不同风格用于图片生成
  - 随机选择风格提示词用于批量图片生成

- **文本分段与配音生成**
  - 按行自动拆分原始文本为文本片段
  - 支持批量生成配音（TTS）
  - 自动计算音频时长和时间轴
  - 音频片段支持状态管理（pending/generating/completed/failed）

- **AI 图片生成**
  - 根据总音频时长计算需要的图片数量（每张15秒）
  - 随机选择风格提示词生成图片
  - 自动分配图片时间轴（每张15秒）
  - 支持批量生成和断点续传
  - 图片片段配置运动类型（随机选择缩放或平移）

- **剪映草稿导出（解压视频）**
  - 新增 `DecompressionJianyingExporter` 类
  - 多轨道支持：
    - 视频轨道（下层）：按顺序拼接解压视频素材
    - 图片轨道（上层）：叠加图片素材，带关键帧动画
    - 音频轨道：配音音频
    - 字幕轨道：按配音文本显示字幕
  - 顺序时间计算：确保片段无重叠、连续排列
  - 素材自动复制到草稿目录
  - 默认配置：
    - 画布比例：9:16 (1080x1920 竖屏)
    - 字幕字体：新青年体，字号 15
    - 图片关键帧：从140%缩放(1.4)到100%缩放(1.0)

#### 小说漫画编辑器改进
- 原 `ProjectEditor.tsx` 拆分为两个独立编辑器
- `NovelComicEditor.tsx` 专注于小说漫画项目
- 保持原有的向导式6步工作流
- 更新 API 调用以适配新的数据结构

#### 技术改进
- 新增 `MotionType` 枚举：支持7种运动类型（none/pan_left/pan_right/pan_up/pan_down/zoom_in/zoom_out）
- 新增 `MotionConfig` 模型：配置运动参数（起始/结束缩放、位移等）
- 新增 `TextSegment`、`AudioClip`、`VideoClip`、`ImageClip` 模型
- 新增全局设置：`decompressionVideoPath`、`stylePromptsPath`
- 新增完整的解压视频 API 端点：`/api/decompression/*`
- 前端 TypeScript 类型完整更新

#### 文件清单
**新增文件:**
- `backend/api/decompression.py` - 解压视频 API 端点
- `backend/core/decompression_exporter.py` - 解压视频剪映导出器
- `backend/core/decompression_utils.py` - 视频扫描和风格提示词工具
- `docs/superpowers/specs/2026-03-28-decompression-video-design.md` - 解压视频设计文档
- `docs/superpowers/plans/2026-03-28-decompression-video-implementation.md` - 解压视频实施计划
- `frontend/src/pages/DecompressionVideoEditor.tsx` - 解压视频编辑器
- `frontend/src/pages/NovelComicEditor.tsx` - 小说漫画编辑器（原 ProjectEditor）

**修改文件:**
- `backend/api/projects.py` - 支持创建两种类型项目
- `backend/config.py` - 添加解压视频相关配置
- `backend/core/comfyui.py` - 支持独立的解压视频图片生成
- `backend/core/storage.py` - 支持 DecompressionProjectData
- `backend/core/tts.py` - 支持解压视频音频生成
- `backend/main.py` - 注册 decompression 路由
- `backend/models/schemas.py` - 新增解压视频相关数据模型
- `frontend/src/pages/Dashboard.tsx` - 支持创建两种类型项目
- `frontend/src/pages/ProjectEditor.tsx` - 重定向到对应编辑器
- `frontend/src/pages/Settings.tsx` - 添加解压视频设置
- `frontend/src/services/api.ts` - 新增解压视频类型和 API
- `frontend/vite.config.js` - 代理配置更新

### 2026-03-28

#### 剪映导出默认配置优化
- **画布默认比例 9:16**
  - 解压视频导出默认使用竖屏比例 (1080x1920)
  - 适合抖音、快手等短视频平台

- **字幕默认样式**
  - 默认字体：新青年体
  - 默认字号：15
  - 自动换行，居中对齐

- **图片关键帧动画**
  - 默认缩放关键帧：起始 140% (1.4)，结束 100% (1.0)
  - 15秒内平滑缩放，产生自然的视觉效果

#### 文件清单
**修改文件:**
- `backend/core/decompression_exporter.py` - 添加默认配置

### 2026-03-28

#### UI/UX 全面优化升级

### 2026-03-28

#### UI/UX 全面优化升级
- **全新视觉设计系统**
  - 温暖亲和风格配色：温暖的橙色与蓝色调搭配
  - 明暗双主题完整支持，通过 CSS 自定义属性实现
  - 新增 Tailwind 自定义颜色主题（primary-50~900）
  - 新增圆角、阴影、过渡动画设计 tokens
  - 新增长阴影效果（shadow-card, shadow-card-hover, shadow-primary）

- **侧边栏导航 + 向导式混合布局**
  - 全新可折叠侧边栏（Sidebar）组件
  - 顶部导航栏（TopBar）：主题切换、通知中心、快捷键帮助
  - AppLayout 组件整合侧边栏与顶部栏
  - 向导式步骤导航（WizardSteps）组件
  - 项目编辑器采用向导式布局，6个步骤清晰展示

- **Toast 通知系统**
  - React Context 管理的 Toast 系统
  - useToast Hook 提供 toast() 方法
  - 4种通知类型：success/info/warning/error
  - ToastContainer 自动显示/隐藏动画
  - 4秒自动消失，支持手动关闭

- **键盘快捷键系统**
  - useKeyboardShortcuts Hook 监听全局快捷键
  - Cmd/Ctrl + K: 打开快捷键帮助
  - Cmd/Ctrl + [: 切换到上一步
  - Cmd/Ctrl + ]: 切换到下一步
  - Esc: 关闭弹窗/取消操作
  - KeyboardShortcutsHelp 弹窗显示所有快捷键

- **设计组件库**
  - @layer card 组件：带悬停效果和阴影的卡片
  - @layer btn-primary: 渐变主按钮，带悬停动画
  - @layer btn-secondary: 次要按钮，边框样式
  - @layer btn-icon: 圆形图标按钮
  - @layer input-field: 输入框样式，带焦点状态
  - 所有组件支持明暗主题

- **路由与布局重构**
  - /prompts 和 /image-prompts 保留独立布局（StandaloneWrapper）
  - /* 路由使用 AppLayout（LayoutWrapper）
  - 新增 Templates 页面作为新布局下的提示词模板入口
  - /templates 路由重定向到 /prompts 保持兼容性

#### 技术改进
- ThemeProvider 使用 CSS 自定义属性实现主题切换
- Tailwind config 配置完整的自定义设计 tokens
- 所有组件使用 dark: 前缀支持暗色主题
- React.lazy + Suspense 实现代码分割和加载状态
- 向导式步骤状态管理与路由同步

#### 文件清单
**新增文件:**
- `docs/superpowers/specs/2026-03-27-ui-ux-optimization-design.md` - UI/UX 优化设计文档
- `docs/superpowers/plans/2026-03-28-ui-ux-optimization-plan.md` - 实施计划
- `frontend/src/styles/themes.tsx` - ThemeProvider 和 useTheme Hook
- `frontend/src/hooks/useToast.tsx` - Toast 上下文和 Hook
- `frontend/src/hooks/useKeyboardShortcuts.ts` - 键盘快捷键 Hook
- `frontend/src/components/ui/Toast.tsx` - Toast 组件和 ToastContainer
- `frontend/src/components/ui/KeyboardShortcutsHelp.tsx` - 快捷键帮助弹窗
- `frontend/src/components/layout/Sidebar.tsx` - 侧边栏导航组件
- `frontend/src/components/layout/TopBar.tsx` - 顶部栏组件
- `frontend/src/components/layout/AppLayout.tsx` - 应用主布局
- `frontend/src/components/project/WizardSteps.tsx` - 向导步骤导航组件
- `frontend/src/pages/Templates.tsx` - 新提示词模板页面

**修改文件:**
- `frontend/tailwind.config.js` - 自定义颜色主题、圆角、阴影设计 tokens
- `frontend/src/index.css` - @layer base/components 组件库定义
- `frontend/src/main.tsx` - 路由重构、ThemeProvider、ToastProvider 集成
- `frontend/src/pages/Dashboard.tsx` - 新卡片式设计布局
- `frontend/src/pages/ProjectEditor.tsx` - 向导式步骤导航集成

### 2026-03-25

#### 场景提取与增强图片提示词生成功能
- **场景自动提取**
  - 新增 `Scene` 数据模型：包含 id、name、description、createdAt、updatedAt
  - 新增场景提取提示词模版：4个预设模版 (default/verbose/visual/detailed)
  - 新增独立的"场景管理"步骤（步骤 1），与角色管理并列
  - 场景列表支持编辑、删除操作
  - 场景提取按钮添加 loading 状态和错误提示

- **分镜自动关联场景与角色**
  - `Storyboard` 模型新增 `sceneId` 字段
  - 分镜拆分时自动通过关键词匹配关联场景
  - 分镜拆分时自动通过关键词匹配关联角色
  - 分镜编辑界面显示场景下拉选择器
  - 分镜编辑界面显示角色多选按钮

- **增强版图片提示词生成**
  - 新增 `generate_image_prompt_enhanced` 方法
  - 结合分镜描述 + 角色描述 + 场景描述 + 前后5个分镜（共11个）上下文
  - 首尾分镜自动处理：首分镜只用后面5个，尾分镜只用前面5个
  - `_get_surrounding_storyboards` 辅助函数获取上下文分镜

- **向后兼容处理**
  - 后端 `load_project` 自动补全缺失的 `scenes` 字段
  - 后端自动补全旧分镜缺失的 `sceneId` 字段
  - 前端加载项目时重建数据结构，确保所有必需字段存在
  - 前端所有访问 `project.scenes` 的地方使用安全访问 `(project.scenes || [])`

#### 技术改进
- `PromptType` 枚举新增 `SCENE_EXTRACTION`
- `Project` 模型新增 `scenes: List[Scene]` 字段
- `UpdateStoryboardRequest` 新增 `sceneId` 字段
- 新增场景管理 API 端点：`/api/projects/{projectId}/scenes/*`
- 新增 `sceneApi` 前端 API 封装
- 前端 ProjectEditor 步骤从 5 个扩展到 6 个（新增场景管理）
- 修复前端"一直显示加载中"问题，添加多层容错和安全措施

#### 文件清单
**新增文件:**
- `backend/api/scenes.py` - 场景管理 API 端点

**修改文件:**
- `backend/models/schemas.py` - 新增 Scene、更新 Project/Storyboard/PromptType
- `backend/core/prompt_templates.py` - 新增 SCENE_EXTRACTION 预设模版和变量
- `backend/main.py` - 注册 scenes 路由
- `backend/core/llm.py` - 新增 extract_scenes 和 generate_image_prompt_enhanced
- `backend/core/ollama.py` - 新增场景提取和增强版提示词生成
- `backend/core/openai_client.py` - 新增场景提取和增强版提示词生成
- `backend/api/generation.py` - 自动关联逻辑、增强版提示词生成
- `backend/api/projects.py` - update_storyboard 支持 sceneId、get_project 数据兼容
- `backend/core/storage.py` - load_project 向后兼容处理
- `frontend/src/services/api.ts` - 新增 Scene 类型、sceneApi、更新相关类型
- `frontend/src/pages/ProjectEditor.tsx` - 场景管理 UI、分镜场景/角色关联

### 2026-03-25

#### TTS 音色配置功能全面升级
- **更多音色选项**
  - 从 6 个音色扩展到 **24 个** Azure TTS 音色
  - 包含女声、男声和童声
  - 新增 `frontend/src/constants/ttsVoices.ts` 统一管理音色列表

- **角色声音配置体验优化**
  - 新增「保存」按钮确认修改才保存
  - 使用 `tempCharacterTts` 暂存修改，避免误操作
  - 编辑时显示「收起」/「保存」按钮

- **分镜级音色配置**
  - 每个分镜可独立设置音色
  - `Storyboard` 模型新增 `ttsConfig` 字段
  - 优先级：分镜配置 > 角色配置 > 全局默认

- **批量音色设置**
  - 顶部「批量设置音色」下拉选择器
  - 「应用到所有分镜」一键批量更新
  - 修复之前按钮无响应的问题

#### 技术改进
- `UpdateStoryboardRequest` 新增 `ttsConfig` 字段
- `update_storyboard` API 正确处理 `ttsConfig` 更新
- 音频生成逻辑优先使用分镜独立配置
- 前端 TypeScript 类型完整更新

#### 文件清单
**新增文件:**
- `frontend/src/constants/ttsVoices.ts` - 24 个音色选项和辅助函数

**修改文件:**
- `backend/models/schemas.py` - Storyboard 和 UpdateStoryboardRequest 新增 ttsConfig
- `backend/api/projects.py` - update_storyboard 支持 ttsConfig 更新
- `backend/api/generation.py` - 音频生成优先使用分镜 ttsConfig
- `frontend/src/pages/ProjectEditor.tsx` - 角色保存按钮、分镜音色选择、批量设置
- `frontend/src/services/api.ts` - Storyboard 类型新增 ttsConfig

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
