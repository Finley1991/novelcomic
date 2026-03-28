# 解压视频混剪推文项目 - 设计文档

**日期:** 2026-03-28
**版本:** 1.0

## 概述

在现有 NovelComic 项目中新增"解压视频混剪推文项目"功能模块，与原有的"AI推文视频项目"并存。

### 目标
- 支持两种项目类型：AI推文视频（原功能）、解压视频混剪（新功能）
- 复用现有 TTS、ComfyUI、MotionConfig、剪映导出系统
- 新增解压视频素材管理、风格提示词管理

## 功能设计

### 项目类型选择

创建新项目时提供明确的选择器：
- **AI推文视频项目** - 原有的小说转漫剧功能
- **解压视频混剪项目** - 新增的解压视频混剪功能

### 整体流程（解压视频混剪项目）

```
1. 项目设置
   ├─ 输入项目名称
   ├─ 选择风格（美食甜点/城市风景/治愈插画/水墨国风）
   └─ 显示该风格的提示词数量

2. 小说文本
   └─ 输入小说文本

3. 音频生成
   ├─ 按行拆分文本为片段
   ├─ 为每个片段生成 TTS 配音
   ├─ 显示每个片段的状态和时长
   └─ 计算总音频时长

4. 素材准备
   ├─ 视频素材区
   │  ├─ 自动选择视频（累加时长 ≥ 总音频时长）
   │  ├─ 视频尽量不重复，不足时才重复
   │  └─ 支持手动添加/删除视频
   │
   └─ 图片素材区
      ├─ 计算图片数量 = ceil(总音频时长 / 15秒)
      ├─ 从选定风格中随机抽取提示词（不重复，不足时可重复）
      ├─ ComfyUI 批量生成图片
      ├─ 每张图片随机分配 MotionConfig 动效
      └─ 每张图片固定 15 秒

5. 导出剪映
   └─ 一键导出剪映草稿
```

## 数据模型设计

### 新增枚举

```python
class ProjectType(str, Enum):
    NOVEL_COMIC = "novel_comic"      # AI推文视频项目（原项目）
    DECOMPRESSION_VIDEO = "decompression_video"  # 解压视频混剪项目
```

### 修改现有 Project 模型

```python
class Project(BaseModel):
    # ... 现有字段 ...
    type: ProjectType = ProjectType.NOVEL_COMIC  # 新增，默认向后兼容
```

### 解压视频项目数据模型

```python
class TextSegment(BaseModel):
    """按行拆分的文本片段"""
    id: str
    index: int
    text: str


class AudioClip(BaseModel):
    """音频片段"""
    id: str
    textSegmentId: str
    text: str
    audioPath: Optional[str] = None
    duration: float = 0.0
    startTime: float = 0.0  # 在时间线上的开始时间
    endTime: float = 0.0    # 在时间线上的结束时间
    status: GenerationStatus = GenerationStatus.PENDING


class VideoClip(BaseModel):
    """视频素材片段"""
    id: str
    filePath: str  # 解压视频文件路径
    fileName: str
    duration: float  # 视频时长
    startTime: float = 0.0  # 在时间线上的开始时间
    endTime: float = 0.0    # 在时间线上的结束时间


class ImageClip(BaseModel):
    """图片素材片段"""
    id: str
    index: int
    prompt: str  # 使用的提示词
    imagePath: Optional[str] = None
    duration: float = 15.0  # 固定15秒
    startTime: float = 0.0
    endTime: float = 0.0
    motion: MotionConfig  # 动效配置
    status: GenerationStatus = GenerationStatus.PENDING


class DecompressionProject(BaseModel):
    """解压视频混剪项目"""
    # 基础信息
    id: str
    name: str
    type: ProjectType = ProjectType.DECOMPRESSION_VIDEO
    createdAt: datetime
    updatedAt: datetime

    # 小说文本
    sourceText: str = ""

    # 风格选择
    selectedStyle: Optional[str] = None  # 如 "美食甜点"

    # 按行拆分后的文本片段
    textSegments: List[TextSegment] = []

    # 音频信息
    audioClips: List[AudioClip] = []
    totalAudioDuration: float = 0.0

    # 视频素材
    videoClips: List[VideoClip] = []

    # 图片素材
    imageClips: List[ImageClip] = []

    # 状态
    status: str = "editing"
```

### 全局设置新增

```python
class GlobalSettings(BaseModel):
    # ... 现有字段 ...

    # 解压视频混剪相关设置
    decompressionVideoPath: str = "/Users/wyf-mac/Documents/小说推文/视频"
    stylePromptsPath: str = ""  # 默认指向 data/style_prompts/
```

## 全局设置与扫描

### 解压视频目录

- **配置项:** `decompressionVideoPath`
- **默认值:** `/Users/wyf-mac/Documents/小说推文/视频`
- **支持格式:** .mp4, .mov, .avi, .mkv, .webm, .flv
- **扫描内容:**
  - 文件路径
  - 文件名
  - 视频时长
- **缓存:** 扫描结果缓存，避免重复读取

### 风格提示词目录

- **配置项:** `stylePromptsPath`
- **默认值:** `data/style_prompts/`
- **文件格式:** 每个风格一个 `.txt` 文件
- **文件命名:** `{风格名}.txt`（如 `美食甜点.txt`）
- **内容格式:** 每行一个提示词
- **预置风格:**
  - 美食甜点
  - 城市风景
  - 治愈插画
  - 水墨国风

## 向导流程详情

### 步骤 1: 项目设置

**功能:**
- 项目名称输入
- 风格选择下拉框（从扫描的风格列表中选择）
- 显示该风格的提示词数量预览

### 步骤 2: 小说文本

**功能:**
- 大文本输入框
- 支持粘贴长文本

### 步骤 3: 音频生成

**功能:**
- 自动按行拆分文本为片段
- 显示片段列表，每行可编辑
- "生成配音"按钮 - 批量 TTS 生成
- 显示每个片段的生成状态、时长
- 实时计算总音频时长

### 步骤 4: 素材准备

#### 视频素材区

**功能:**
- 显示已选择的视频列表
- 显示每个视频的时长
- 显示视频总时长
- "自动选择视频"按钮:
  - 随机不重复选择视频
  - 累加时长直到 ≥ 总音频时长
  - 所有视频用完仍不够时才开始重复
  - 重复时重新随机打乱顺序
- 支持手动添加/删除视频

#### 图片素材区

**功能:**
- 计算需要的图片数量 = `ceil(总音频时长 / 15)`
- 显示将使用的提示词列表（随机不重复抽取）
- "生成图片"按钮 - 批量 ComfyUI 生成
- 每张图片随机分配 MotionConfig 动效
- 支持手动配置动效
- 显示每张图片的生成状态

### 步骤 5: 导出剪映

**功能:**
- 显示所有素材预览
- "导出剪映草稿"按钮

## 剪映草稿导出

### 轨道安排

| 轨道 | 内容 | 说明 |
|------|------|------|
| Screen | 解压视频 | 完整使用，按顺序拼接 |
| 额外视频轨道 | 图片素材 | 每张 15 秒，带 MotionConfig 动效 |
| Subtitle | 字幕 | 按配音文本时间线 |
| TTS | 音频 | 按配音时间线 |

### 时间线计算

1. 总时长 = `max(音频总时长, 视频总时长, 图片总时长)`
2. 视频素材: 从 0 开始按顺序拼接
3. 图片素材: 从 0 开始按顺序拼接（每张 15 秒）
4. 音频+字幕: 精确按时间线放置

**注意:**
- 音频和字幕严格按文本片段的时间线
- 视频和图片只要总时长够即可，不需要和音频同步

## API 端点设计

### 新增 API 端点

```python
# 解压视频素材管理
GET  /api/decompression/videos - 扫描并返回解压视频列表
POST /api/decompression/videos/scan - 重新扫描视频目录

# 风格提示词管理
GET  /api/decompression/styles - 返回所有风格列表
GET  /api/decompression/styles/{style_name}/prompts - 返回某风格的提示词列表
POST /api/decompression/styles/scan - 重新扫描风格提示词目录

# 解压视频项目特定操作
POST /api/projects/{projectId}/decompression/split-text - 按行拆分文本
POST /api/projects/{projectId}/decompression/generate-audio - 生成配音
POST /api/projects/{projectId}/decompression/select-videos - 自动选择视频素材
POST /api/projects/{projectId}/decompression/generate-images - 生成图片
POST /api/projects/{projectId}/decompression/export-jianying - 导出剪映草稿
```

### 修改现有 API 端点

```python
# 创建项目支持 type 参数
POST /api/projects
请求体新增: { "type": "novel_comic" | "decompression_video" }

# 获取项目根据类型返回不同结构
GET /api/projects/{projectId}
响应根据 project.type 返回不同数据结构

# 项目列表包含 type 字段
GET /api/projects
每个项目包含 type 字段
```

## 前端 UI 改动

### Dashboard 页面

**改动:**
- "新建项目"按钮弹出选择器
- 两个选项卡片：
  - "AI推文视频项目" - 带图标和描述
  - "解压视频混剪项目" - 带图标和描述
- 项目列表显示项目类型标签

### ProjectEditor 重构

**改动:**
- 拆分为两个编辑器组件:
  - `NovelComicEditor` - 原有编辑器
  - `DecompressionVideoEditor` - 新增解压视频编辑器
- 根据 `project.type` 动态渲染对应的编辑器

### DecompressionVideoEditor 组件

**功能:**
- 向导式布局，5个步骤
- 复用现有组件: WizardSteps, Toast, 快捷键等

### Settings 页面新增

**新增区域:** "解压视频混剪"设置卡片

**配置项:**
- 解压视频目录: 路径输入 + 文件夹选择 + 扫描按钮
- 风格提示词目录: 路径输入 + 文件夹选择 + 扫描按钮

## 复用现有系统

### TTS 配音系统

- 复用 `TTSSettings` 配置
- 复用 `TTSClient` 客户端
- 复用 `generate_audios` 逻辑

### ComfyUI 图片生成

- 复用 `ComfyUISettings` 配置
- 复用 `ComfyUIClient` 客户端
- 复用工作流管理和节点映射

### MotionConfig 动效系统

- 复用 `MotionType` 枚举
- 复用 `MotionConfig` 模型
- 随机分配动效给图片

### 剪映草稿导出

- 复用 `pyJianYingDraft` 库
- 复用 `JianyingExporter` 基础结构
- 扩展支持多视频轨道、图片轨道

## 文件清单

### 新增文件

**后端:**
- `backend/api/decompression.py` - 解压视频相关 API
- `backend/core/decompression_exporter.py` - 解压视频剪映导出

**前端:**
- `frontend/src/pages/DecompressionVideoEditor.tsx` - 解压视频编辑器
- `frontend/src/components/project/DecompressionWizardSteps.tsx` - 解压视频向导步骤

### 修改文件

**后端:**
- `backend/models/schemas.py` - 新增 ProjectType 和相关模型
- `backend/main.py` - 注册 decompression 路由
- `backend/config.py` - 新增默认路径配置
- `backend/api/projects.py` - 支持项目类型
- `backend/core/storage.py` - 支持存储新项目类型

**前端:**
- `frontend/src/pages/Dashboard.tsx` - 项目类型选择器
- `frontend/src/pages/ProjectEditor.tsx` - 拆分编辑器
- `frontend/src/pages/Settings.tsx` - 新增解压视频设置
- `frontend/src/services/api.ts` - 新增类型和 API 方法
- `frontend/src/main.tsx` - 路由更新（如需要）

## 向后兼容

- 现有 Project 模型新增 `type` 字段，默认 `NOVEL_COMIC`
- 现有 API 保持不变，只在需要时新增参数
- 现有数据存储格式兼容，新项目类型使用新字段

## 风险与注意事项

1. **视频时长读取**: 需要使用 `pymediainfo` 或类似库读取视频时长
2. **视频素材量大**: 扫描大量视频时可能较慢，需要缓存
3. **图片生成数量**: 总音频时长较长时，图片生成数量可能很多
4. **剪映多轨道**: 需要确认 pyJianYingDraft 库是否支持多视频轨道
