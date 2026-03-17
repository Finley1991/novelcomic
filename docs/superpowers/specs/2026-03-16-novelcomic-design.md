
# NovelComic 设计文档

**日期**: 2026-03-16
**项目**: NovelComic - 小说推文 AI漫剧生成工具

---

## ⚠️ 重要提示

**剪映工程格式声明**:
剪映（CapCut）的草稿文件格式是闭源且未公开的。本文档中描述的剪映工程生成功能基于对示例工程文件的逆向工程分析。该实现可能存在以下风险：
- 剪映版本更新可能导致格式不兼容
- 部分高级功能可能无法完全支持
- 生成的工程文件可能需要在剪映中手动调整

---

## 1. 项目概述

NovelComic 是一个分步交互式的小说转漫剧工具，帮助用户将小说文本转换为包含图片、配音和动画的剪映工程文件。

### 1.1 核心功能

- **角色提取与管理**: 自动从小说中提取角色，通过提示词、LoRA、参考图等方式维护角色一致性
- **剧本拆分**: 将小说文本智能拆分为多个分镜，支持长文本分块处理
- **AI图片生成**: 通过 ComfyUI API 生成漫剧画面，支持失败重试和降级策略
- **AI配音生成**: 通过微软 TTS API 生成配音，支持批量生成和断点续传
- **剪映工程导出**: 一键生成包含动画关键帧的剪映草稿

### 1.2 目标用户

- 小说推文创作者
- 漫剧视频制作者
- 内容创作者

### 1.3 视频规格

- 时长: 3分钟以上的长视频
- 分辨率: 16:9 (1920x1080)
- 平台: 剪映桌面版

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                        Frontend                          │
│  React 18 + TypeScript + Tailwind CSS                  │
│  • 分步工作流界面                                        │
│  • 分镜编辑器 (支持大量分镜)                            │
│  • 角色管理器                                            │
│  • 实时状态更新 (HTTP Polling)                         │
└────────────────┬────────────────────────────────────────┘
                 │ HTTP
┌────────────────▼────────────────────────────────────────┐
│                    Backend (FastAPI)                     │
│  • API 路由                                              │
│  • 任务状态管理 (内存存储，重启丢失)                    │
│  • 文件管理                                              │
└─────┬───────────────┬───────────────┬──────────────────┘
      │               │               │
┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
│ ComfyUI   │  │  Ollama   │  │ Microsoft │
│ API       │  │  API      │  │ TTS API   │
└───────────┘  └───────────┘  └───────────┘
      │               │               │
      └───────────────┴───────────────┘
                      │
            ┌─────────▼──────────┐
            │  本地文件存储        │
            │  • 用户配置          │
            │  • 项目数据          │
            └─────────────────────┘
```

### 2.2 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React 18 + TypeScript | 组件化开发，类型安全 |
| 前端样式 | Tailwind CSS | 原子化 CSS 框架 |
| 后端 | FastAPI (Python) | 异步高性能，自动生成文档 |
| AI接口 | ComfyUI API | 图片生成 |
| AI接口 | Ollama API | 文本处理（角色提取、剧本拆分） |
| AI接口 | Microsoft TTS API | 语音合成 |
| 数据存储 | 本地 JSON + 文件系统 | 简单直接，易于备份 |

### 2.3 错误处理与重试策略

**API 调用错误处理**:
- **超时配置**: 所有外部 API 调用设置合理超时 (ComfyUI: 300秒, Ollama: 120秒, TTS: 60秒)
- **重试机制**: 失败请求自动重试 2-3 次，指数退避
- **降级策略**: ComfyUI 失败时提示用户检查服务或上传自定义图片

**批量生成策略**:
- **并发控制**: 同时最多发起 3 个并发请求，避免 API 过载
- **断点续传**: 批量生成失败时记录已完成的项目，支持从断点继续
- **进度保存**: 生成进度定期保存到项目文件

---

## 3. 项目结构

```
novelcomic/
├── backend/
│   ├── main.py                    # FastAPI 入口
│   ├── config.py                  # 配置管理
│   ├── api/
│   │   ├── projects.py            # 项目管理 API
│   │   ├── characters.py          # 角色管理 API
│   │   ├── storyboard.py          # 分镜管理 API
│   │   ├── generation.py          # AI 生成 API
│   │   └── export.py              # 剪映导出 API
│   ├── core/
│   │   ├── comfyui.py             # ComfyUI 客户端 (含重试逻辑)
│   │   ├── ollama.py              # Ollama 客户端 (含长文本分块)
│   │   ├── tts.py                 # 微软 TTS 客户端
│   │   ├── retry.py               # 重试工具函数
│   │   └── jianying.py            # 剪映工程生成器
│   └── models/
│       └── schemas.py             # Pydantic 数据模型
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Step0Characters.tsx   # 步骤0：角色提取
│   │   │   ├── Step1Story.tsx         # 步骤1：剧本拆分
│   │   │   ├── Step2Images.tsx        # 步骤2：图片生成
│   │   │   ├── Step3Audio.tsx         # 步骤3：配音生成
│   │   │   └── Step4Export.tsx        # 步骤4：导出剪映
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx           # 项目列表
│   │   │   ├── Settings.tsx            # 全局设置
│   │   │   └── ProjectEditor.tsx       # 项目编辑
│   │   └── services/
│   │       └── api.ts                  # API 客户端
│   └── package.json
└── data/
    ├── config.json                # 全局用户配置
    └── projects/                  # 项目存储目录
```

---

## 4. 数据模型

### 4.1 全局配置文件 (data/config.json)

```json
{
  "comfyui": {
    "apiUrl": "http://8.222.174.34:8188",
    "timeout": 300,
    "maxRetries": 3,
    "concurrentLimit": 3
  },
  "ollama": {
    "apiUrl": "http://8.222.174.34:11434",
    "model": "llama3",
    "timeout": 120,
    "maxRetries": 2,
    "chunkSize": 4000
  },
  "tts": {
    "azureKey": "",
    "azureRegion": "",
    "voice": "zh-CN-XiaoxiaoNeural",
    "rate": 1.0,
    "pitch": 0,
    "timeout": 60,
    "maxRetries": 3,
    "concurrentLimit": 5
  },
  "jianying": {
    "canvasWidth": 1920,
    "canvasHeight": 1080,
    "canvasRatio": "16:9"
  }
}
```

### 4.2 项目主文件 (project.json)

```json
{
  "id": "uuid",
  "name": "我的小说漫剧",
  "createdAt": "2026-03-16T...",
  "updatedAt": "2026-03-16T...",
  "status": "editing",
  "sourceText": "原始小说文本...",
  "stylePrompt": "动漫风格，高清，细节丰富...",
  "negativePrompt": "bad anatomy, bad hands, blurry",
  "generationProgress": {
    "imagesCompleted": 0,
    "imagesTotal": 0,
    "audioCompleted": 0,
    "audioTotal": 0,
    "lastSavedAt": "2026-03-16T..."
  },
  "characters": [
    {
      "id": "uuid",
      "name": "萧炎",
      "description": "少年，黑衣，黑发，眼神坚毅...",
      "characterPrompt": "1boy, black hair, black eyes, martial artist, chinese style...",
      "negativePrompt": "bad anatomy, bad hands",
      "referenceImages": [
        "characters/xiaoyan-ref-1.png"
      ],
      "loraName": "xiaoyan-character-v1",
      "loraWeight": 0.8
    }
  ],
  "storyboards": [
    {
      "id": "uuid",
      "index": 0,
      "sceneDescription": "画面描述...",
      "dialogue": "角色台词...",
      "narration": "旁白...",
      "characterIds": ["uuid-char-1", "uuid-char-2"],
      "imagePrompt": "SD 提示词...",
      "negativePrompt": "负面提示词...",
      "imagePath": "images/storyboard-0.png",
      "imageStatus": "pending|generating|completed|failed",
      "imageError": null,
      "audioPath": "audio/storyboard-0.wav",
      "audioDuration": 3.5,
      "audioStatus": "pending|generating|completed|failed",
      "audioError": null,
      "motion": {
        "type": "pan_left|pan_right|pan_up|pan_down|zoom_in|zoom_out|none",
        "startScale": 1.2,
        "endScale": 1.0,
        "startX": 0,
        "endX": -0.3,
        "startY": 0,
        "endY": 0
      }
    }
  ]
}
```

**字段说明**:
- `characterIds`: 使用角色 UUID 引用，而非角色名称，避免重命名导致关联断裂
- `imageStatus`/`audioStatus`: 记录生成状态，支持断点续传
- `imageError`/`audioError`: 记录失败原因，方便用户排查
- `motion.*X/Y`: 坐标单位为相对于画布尺寸的比例，范围 [-1.0, 1.0]，0.333 表示移动 1/3 画布宽度/高度

### 4.3 文件目录结构

```
data/
├── config.json                   # 全局配置
└── projects/
    └── {project-id}/
        ├── project.json          # 项目主文件
        ├── characters/           # 角色资源
        │   └── {char-id}-ref1.png
        ├── images/               # 分镜图片
        │   ├── sb-001.png
        │   └── ...
        ├── audio/                # 配音文件
        │   ├── sb-001.wav
        │   └── ...
        └── export/
            └── jianying-draft.zip    # 导出的剪映工程
```

---

## 5. 分步工作流

### 步骤 0: 角色提取与管理

**功能**:
- 输入小说文本
- Ollama LLM 自动提取主要角色列表
- 为每个角色设置:
  - 角色描述（用于 LLM 生成画面时保持一致）
  - 角色提示词（注入到 SD 提示词中）
  - 负面提示词
  - 参考图片（可选，用于 ControlNet/Reference Only）
  - LoRA 配置（可选）

**长文本处理**:
- 超过 LLM 上下文窗口的小说自动分块
- 分块大小可配置（默认 4000 token）
- 分块间保留重叠上下文以维持一致性

### 步骤 1: 剧本拆分

**功能**:
- Ollama LLM 自动将小说拆分成多个分镜
- 每个分镜包含:
  - 画面描述
  - 台词/旁白
  - 出现的角色 ID 列表
- 可手动编辑每个分镜的内容
- 可添加/删除分镜
- 可调整分镜顺序
- 大量分镜时支持虚拟滚动和分组显示

### 步骤 2: 图片生成

**功能**:
- 为每个分镜生成 SD 提示词（自动注入角色提示词）
- 调用 ComfyUI API 生成图片
- 可编辑提示词/负面提示词
- 可重新生成单张图片
- 可上传自定义图片替代
- 预览生成的图片
- 批量生成支持并发控制和断点续传

**错误处理**:
- NSFW 过滤提示用户调整提示词
- OOM 错误提示降低图片分辨率
- 网络错误自动重试

### 步骤 3: 配音生成

**功能**:
- 调用微软 TTS 生成配音
- 可选择配音角色
- 可调整语速/音调
- 可试听每段音频
- 可上传自定义音频
- 自动获取音频时长
- 根据音频时长自动调整运动参数范围

### 步骤 4: 剪映导出

**功能**:
- 为每个分镜设置图片运动效果:
  - `pan_left` / `pan_right`: 左右平移
  - `pan_up` / `pan_down`: 上下平移
  - `zoom_in` / `zoom_out`: 缩放
  - `none`: 无运动
- 一键生成剪映工程文件
- 下载剪映草稿文件夹（包含 draft_content.json + 素材）

---

## 6. API 设计

### 6.1 项目管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/projects` | 创建新项目 |
| GET | `/api/projects` | 获取项目列表 |
| GET | `/api/projects/{id}` | 获取项目详情 |
| PUT | `/api/projects/{id}` | 更新项目 |
| DELETE | `/api/projects/{id}` | 删除项目 |

**请求/响应示例**:
```typescript
// POST /api/projects
interface CreateProjectRequest {
  name: string;
  sourceText?: string;
}

interface ProjectResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  // ... other fields
}
```

### 6.2 全局设置

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/settings` | 获取全局设置 |
| PUT | `/api/settings` | 更新全局设置 |

### 6.3 角色管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/projects/{id}/characters/extract` | 自动提取角色 |
| PUT | `/api/projects/{id}/characters/{charId}` | 更新角色 |
| DELETE | `/api/projects/{id}/characters/{charId}` | 删除角色 |
| POST | `/api/projects/{id}/characters/{charId}/reference` | 上传角色参考图 |

### 6.4 分镜管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/projects/{id}/storyboards/split` | 自动拆分剧本 |
| GET | `/api/projects/{id}/storyboards` | 获取分镜列表 |
| PUT | `/api/projects/{id}/storyboards/{sbId}` | 更新分镜 |
| POST | `/api/projects/{id}/storyboards` | 添加分镜 |
| DELETE | `/api/projects/{id}/storyboards/{sbId}` | 删除分镜 |
| PUT | `/api/projects/{id}/storyboards/reorder` | 重排分镜顺序 |

**请求/响应示例**:
```typescript
// PUT /api/projects/{id}/storyboards/reorder
interface ReorderStoryboardsRequest {
  storyboardIds: string[];  // 新的顺序
}

// PUT /api/projects/{id}/storyboards/{sbId}
interface UpdateStoryboardRequest {
  index?: number;
  sceneDescription?: string;
  dialogue?: string;
  narration?: string;
  characterIds?: string[];
  imagePrompt?: string;
  negativePrompt?: string;
  motion?: MotionConfig;
}
```

### 6.5 AI 生成

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/projects/{id}/generate/image` | 生成单张图片 |
| POST | `/api/projects/{id}/generate/images` | 批量生成图片 |
| POST | `/api/projects/{id}/generate/audio` | 生成单条配音 |
| POST | `/api/projects/{id}/generate/audios` | 批量生成配音 |
| GET | `/api/projects/{id}/generate/status` | 查询生成状态 |

**请求/响应示例**:
```typescript
// POST /api/projects/{id}/generate/images
interface GenerateImagesRequest {
  storyboardIds?: string[];  // 可选，不传则生成所有 pending
  forceRegenerate?: boolean;  // 是否强制重新生成已完成的
}

interface GenerationStatusResponse {
  images: {
    completed: number;
    total: number;
    inProgress: string[];  // storyboardIds
    failed: Array<{id: string, error: string}>;
  };
  audio: {
    completed: number;
    total: number;
    inProgress: string[];
    failed: Array<{id: string, error: string}>;
  };
}
```

### 6.6 剪映导出

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/projects/{id}/export/jianying` | 生成剪映工程 |
| GET | `/api/projects/{id}/export/download` | 下载工程文件 ZIP |

**请求/响应示例**:
```typescript
// POST /api/projects/{id}/export/jianying
interface ExportJianyingRequest {
  canvasWidth?: number;
  canvasHeight?: number;
  fps?: number;
}

interface ExportJianyingResponse {
  exportId: string;
  status: "generating" | "ready" | "failed";
  downloadUrl?: string;
  error?: string;
}
```

---

## 7. 剪映工程生成

### 7.1 剪映文件结构分析

通过分析示例剪映草稿，工程文件结构如下:

```
jianying_draft/
├── draft_content.json       # 主工程文件
├── draft_meta_info.json     # 元信息
├── draft.extra              # 额外数据
├── video/                   # 视频素材（图片也放这里）
├── image/                   # 图片素材
└── audio/                   # 音频素材
```

### 7.2 draft_content.json 核心结构

```json
{
  "canvas_config": {
    "width": 1920,
    "height": 1080,
    "ratio": "16:9"
  },
  "materials": {
    "videos": [
      {
        "id": "uuid",
        "type": "photo",
        "file_path": "image/xxx.png",
        "width": 1920,
        "height": 1080,
        "duration": 10800000000
      }
    ],
    "audios": [
      {
        "id": "uuid",
        "file_path": "audio/xxx.mp3",
        "duration": 6800000
      }
    ],
    "texts": []
  },
  "tracks": [
    {
      "type": "video",
      "name": "Screen",
      "segments": [
        {
          "id": "uuid",
          "material_id": "uuid",
          "target_timerange": {
            "start": 0,
            "duration": 6800000
          },
          "clip": {
            "scale": {"x": 1.0, "y": 1.0},
            "transform": {"x": 0, "y": 0}
          },
          "common_keyframes": [
            {
              "property_type": "KFTypePositionY",
              "keyframe_list": [
                {
                  "time_offset": 0,
                  "values": [0.0]
                },
                {
                  "time_offset": 6800000,
                  "values": [0.333333]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "audio",
      "name": "TTS",
      "segments": []
    }
  ]
}
```

### 7.3 关键帧动画类型

| property_type | 说明 | values |
|---------------|------|--------|
| KFTypePositionX | X轴平移 | [x_offset] |
| KFTypePositionY | Y轴平移 | [y_offset] |
| KFTypeScale | 缩放 | [scale] |

**时间单位**: 微秒 (1秒 = 1,000,000微秒)

**坐标/缩放单位说明**:
- position X/Y: 相对于画布尺寸的比例，0.333 表示移动 1/3 画布宽度/高度
- scale: 缩放比例，1.0 表示原始大小，1.333 表示放大 1/3

### 7.4 运动效果实现

| 效果类型 | 实现方式 |
|----------|----------|
| 向下移动 (pan_down) | KFTypePositionY 从 0 → 0.333 |
| 向上移动 (pan_up) | KFTypePositionY 从 0 → -0.333 |
| 向右移动 (pan_right) | KFTypePositionX 从 0 → 0.333 |
| 向左移动 (pan_left) | KFTypePositionX 从 0 → -0.333 |
| 放大 (zoom_in) | KFTypeScale 从 1.0 → 1.333 |
| 缩小 (zoom_out) | KFTypeScale 从 1.333 → 1.0 |

**自适应调整**:
- 运动幅度根据音频时长自动缩放，确保短片段运动不会太快
- 公式: `幅度 = base_amplitude * min(1.0, audio_duration / 5.0)`

---

## 8. AI 客户端设计

### 8.1 Ollama 客户端

**职责**:
- 角色提取: 从小说文本中提取角色列表
- 剧本拆分: 将小说拆分为分镜
- 提示词生成: 为每个分镜生成 SD 提示词

**长文本分块策略**:
- 按段落分割，确保语义完整性
- 配置化的块大小 (默认 4000 tokens)
- 块间保留 500 tokens 重叠以维持上下文连续性

**示例 Prompt (角色提取)**:
```
从以下小说文本中提取所有主要角色。
对每个角色提供:
1. 姓名
2. 外貌描述
3. 性格特点

以 JSON 格式返回。
```

**重试配置**:
- 最大重试次数: 2
- 超时: 120秒
- 退避策略: 指数退避 (1s, 2s)

### 8.2 ComfyUI 客户端

**职责**:
- 调用 ComfyUI API 生成图片
- 支持工作流注入
- 处理生成状态轮询

**API 端点**:
- `GET /system_stats` - 检查服务状态
- `POST /prompt` - 提交生成任务
- `GET /history/{prompt_id}` - 查询任务状态
- `GET /view` - 获取生成的图片

**重试配置**:
- 最大重试次数: 3
- 超时: 300秒
- 退避策略: 指数退避 (2s, 4s, 8s)
- 并发限制: 最多 3 个同时请求

### 8.3 微软 TTS 客户端

**职责**:
- 调用 Azure TTS API 生成语音
- 支持多语音选择
- 支持语速/音调调整

**重试配置**:
- 最大重试次数: 3
- 超时: 60秒
- 退避策略: 指数退避 (1s, 2s, 4s)
- 并发限制: 最多 5 个同时请求

---

## 9. 配置管理

### 9.1 环境变量 (.env)

```env
# Server
HOST=0.0.0.0
PORT=8000

# Data
DATA_DIR=./data

# AI Services (可以在 UI 中覆盖)
COMFYUI_API_URL=http://8.222.174.34:8188
OLLAMA_API_URL=http://8.222.174.34:11434
OLLAMA_MODEL=llama3

# Microsoft TTS (可以在 UI 中覆盖)
AZURE_TTS_KEY=
AZURE_TTS_REGION=
```

### 9.2 配置优先级

1. UI 中的全局设置 (data/config.json) - 最高优先级
2. 环境变量
3. 代码默认值

---

## 10. 安全与权限

### 10.1 认证与授权

**MVP 版本**:
- 无用户认证（本地单用户使用）
- 假设运行在受信任的本地网络环境

**未来扩展**:
- 可添加 API Key 认证
- 可添加多用户支持

### 10.2 数据备份

**手动备份 (MVP)**:
- 整个 `data/` 目录可直接复制备份
- 单个项目可通过复制项目文件夹备份
- 建议定期手动备份重要项目

**自动备份 (未来扩展)**:
- 自动周期性备份项目数据
- project.json 版本历史记录
- UI 中的备份/恢复功能
- 备份保留策略配置

---

## 11. 未来扩展

### 11.1 可能的功能

- **ControlNet 支持**: 使用参考图控制角色一致性
- **任务队列**: 引入 Celery/RQ 实现持久化任务队列，后端重启不丢失任务
- **WebSocket 支持**: 实时推送生成状态，替代轮询
- **自动备份**: 项目数据自动周期性备份，版本历史记录
- **批量导出**: 支持多章节批量生成
- **模板系统**: 保存常用的风格/角色配置为模板
- **视频预览**: 前端预览简单的视频效果
- **更多平台**: 支持导出其他剪辑软件格式

---

## 附录

### A. 参考资料

- [剪映官方网站](https://www.capcut.cn/)
- [ComfyUI API 文档](https://docs.comfy.org/)
- [Ollama API 文档](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Azure TTS 文档](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/)

