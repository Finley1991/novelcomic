# 剪映草稿导出功能实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现剪映草稿导出功能，将 novelcomic 项目的图片和音频按顺序导出到剪映草稿目录，生成可直接在剪映中打开的草稿文件。

**Architecture:** 采用轻量级模板方案，复用现有剪映模板，通过修改 draft_content.json 来添加素材和时间线。不集成 pyJianYingDraft。

**Tech Stack:** Python 3.12+, FastAPI, Pydantic, JSON 处理

---

## 文件结构映射

| 文件 | 操作 | 职责 |
|------|------|------|
| `backend/config.py` | 修改 | 添加 `draftPath` 到 `JianyingSettings` |
| `backend/models/schemas.py` | 修改 | 更新 `JianyingSettings`，启用导出相关 schemas |
| `backend/core/jianying_exporter.py` | 新建 | 剪映导出核心逻辑 |
| `backend/api/export.py` | 修改 | 启用导出 API 端点 |
| `backend/main.py` | 修改 | 启用 export 路由 |

---

## Task 1: 更新配置模型

**Files:**
- Modify: `backend/config.py`
- Modify: `backend/models/schemas.py`

### Step 1: 更新 config.py

修改 `backend/config.py` 中的 `JianyingSettings` 类，添加 `draftPath` 字段：

```python
class Settings(BaseSettings):
    # ... 现有字段 ...

    jianying_canvas_width: int = 1920
    jianying_canvas_height: int = 1080
    jianying_canvas_ratio: str = "16:9"
    jianying_draft_path: str = ""  # 新增

    class Config:
        env_file = ".env"
        case_sensitive = False
```

### Step 2: 更新 schemas.py

修改 `backend/models/schemas.py`：

1. 更新 `JianyingSettings` 类，添加 `draftPath` 字段：

```python
class JianyingSettings(BaseModel):
    canvasWidth: int = 1920
    canvasHeight: int = 1080
    canvasRatio: str = "16:9"
    draftPath: str = ""  # 新增
```

2. 启用之前注释掉的导出相关 schemas（第 310-325 行）：

```python
class ExportJianyingRequest(BaseModel):
    canvasWidth: Optional[int] = None
    canvasHeight: Optional[int] = None
    fps: Optional[int] = None

class ExportJianyingResponse(BaseModel):
    exportId: str
    status: str
    draftPath: Optional[str] = None
    error: Optional[str] = None
```

### Step 3: 验证修改

检查修改是否正确，确保没有语法错误。

### Step 4: Commit

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add backend/config.py backend/models/schemas.py
git commit -m "feat: add jianying draftPath config field"
```

---

## Task 2: 实现 JianyingExporter 核心类

**Files:**
- Create: `backend/core/jianying_exporter.py`
- Reference: `backend/core/assets/jianying_template/`

### Step 1: 创建 jianying_exporter.py

创建 `backend/core/jianying_exporter.py`，包含以下内容：

```python
import json
import shutil
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional
import uuid

from config import settings
from models.schemas import Project, Storyboard

logger = logging.getLogger(__name__)


class JianyingExporter:
    """剪映草稿导出器"""

    def __init__(self, template_dir: Path, draft_base_path: Path):
        """
        初始化导出器

        Args:
            template_dir: 剪映模板目录路径
            draft_base_path: 剪映草稿保存基础路径
        """
        self.template_dir = template_dir
        self.draft_base_path = draft_base_path

    def export_project(self, project: Project, project_dir: Path) -> Dict[str, str]:
        """
        导出项目为剪映草稿

        Args:
            project: 项目数据
            project_dir: 项目文件目录

        Returns:
            包含 draft_id 和 draft_path 的字典
        """
        # 生成草稿 ID
        draft_id = f"{project.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        draft_dir = self.draft_base_path / draft_id

        logger.info(f"开始导出项目 {project.id} 到剪映草稿 {draft_id}")

        try:
            # 1. 创建草稿目录并复制模板
            self._copy_template(draft_dir)

            # 2. 复制素材文件
            materials_map = self._copy_materials(project, project_dir, draft_dir)

            # 3. 修改 draft_content.json
            self._modify_draft_content(draft_dir, project, materials_map)

            logger.info(f"成功导出项目 {project.id} 到 {draft_dir}")

            return {
                "draft_id": draft_id,
                "draft_path": str(draft_dir)
            }

        except Exception as e:
            logger.error(f"导出失败: {e}", exc_info=True)
            # 清理部分创建的目录
            if draft_dir.exists():
                shutil.rmtree(draft_dir)
            raise

    def _copy_template(self, target_dir: Path):
        """复制模板文件到目标目录"""
        if target_dir.exists():
            shutil.rmtree(target_dir)

        shutil.copytree(self.template_dir, target_dir)
        logger.debug(f"已复制模板到 {target_dir}")

    def _copy_materials(self, project: Project, project_dir: Path, draft_dir: Path) -> Dict[str, Dict[str, str]]:
        """
        复制素材文件到草稿目录

        Returns:
            分镜 ID 到素材路径的映射
        """
        images_dir = draft_dir / "images"
        audio_dir = draft_dir / "audio"
        images_dir.mkdir(exist_ok=True)
        audio_dir.mkdir(exist_ok=True)

        materials_map = {}

        for storyboard in project.storyboards:
            sb_map = {}

            # 复制图片
            if storyboard.imagePath:
                src_img = project_dir / storyboard.imagePath
                if src_img.exists():
                    ext = src_img.suffix or ".jpg"
                    dst_img = images_dir / f"{storyboard.id}{ext}"
                    shutil.copy2(src_img, dst_img)
                    sb_map["image"] = f"images/{storyboard.id}{ext}"
                    logger.debug(f"已复制图片: {src_img} -> {dst_img}")

            # 复制音频
            if storyboard.audioPath:
                src_audio = project_dir / storyboard.audioPath
                if src_audio.exists():
                    ext = src_audio.suffix or ".wav"
                    dst_audio = audio_dir / f"{storyboard.id}{ext}"
                    shutil.copy2(src_audio, dst_audio)
                    sb_map["audio"] = f"audio/{storyboard.id}{ext}"
                    logger.debug(f"已复制音频: {src_audio} -> {dst_audio}")

            materials_map[storyboard.id] = sb_map

        return materials_map

    def _modify_draft_content(self, draft_dir: Path, project: Project, materials_map: Dict[str, Dict[str, str]]):
        """修改 draft_content.json 文件"""
        draft_content_path = draft_dir / "draft_content.json"

        with open(draft_content_path, 'r', encoding='utf-8') as f:
            draft_content = json.load(f)

        # 更新画布尺寸
        canvas = draft_content.get("canvas", {})
        canvas["width"] = settings.jianying_canvas_width
        canvas["height"] = settings.jianying_canvas_height

        # 清空现有轨道
        tracks = draft_content.get("tracks", [])
        video_track = None
        audio_track = None

        # 找到视频和音频轨道
        for track in tracks:
            if track.get("type") == "video":
                video_track = track
            elif track.get("type") == "audio":
                audio_track = track

        # 清空轨道片段
        if video_track:
            video_track["segments"] = []
        if audio_track:
            audio_track["segments"] = []

        # 清空现有素材
        materials = draft_content.get("materials", {})
        materials["videos"] = []
        materials["audios"] = []

        # 添加分镜素材和片段
        current_time = 0

        for storyboard in project.storyboards:
            sb_map = materials_map.get(storyboard.id, {})
            duration = int(max(storyboard.audioDuration, 3.0) * 1000000)  # 转换为微秒

            # 添加视频素材和片段
            if "image" in sb_map and video_track:
                video_material_id = str(uuid.uuid4())
                self._add_video_material(materials, video_material_id, sb_map["image"])
                self._add_video_segment(video_track, video_material_id, current_time, duration)

            # 添加音频素材和片段
            if "audio" in sb_map and audio_track:
                audio_material_id = str(uuid.uuid4())
                self._add_audio_material(materials, audio_material_id, sb_map["audio"], duration)
                self._add_audio_segment(audio_track, audio_material_id, current_time, duration)

            current_time += duration

        # 保存修改后的文件
        with open(draft_content_path, 'w', encoding='utf-8') as f:
            json.dump(draft_content, f, ensure_ascii=False, indent=2)

        logger.debug(f"已修改 draft_content.json")

    def _add_video_material(self, materials: Dict, material_id: str, path: str):
        """添加视频素材"""
        materials["videos"].append({
            "id": material_id,
            "path": path,
            "type": "image",
            "width": settings.jianying_canvas_width,
            "height": settings.jianying_canvas_height
        })

    def _add_audio_material(self, materials: Dict, material_id: str, path: str, duration: int):
        """添加音频素材"""
        materials["audios"].append({
            "id": material_id,
            "path": path,
            "duration": duration
        })

    def _add_video_segment(self, track: Dict, material_id: str, start: int, duration: int):
        """添加视频片段到轨道"""
        track["segments"].append({
            "material_id": material_id,
            "target_timerange": {
                "start": start,
                "duration": duration
            },
            "source_timerange": {
                "start": 0,
                "duration": duration
            }
        })

    def _add_audio_segment(self, track: Dict, material_id: str, start: int, duration: int):
        """添加音频片段到轨道"""
        track["segments"].append({
            "material_id": material_id,
            "target_timerange": {
                "start": start,
                "duration": duration
            },
            "source_timerange": {
                "start": 0,
                "duration": duration
            }
        })
```

### Step 2: 验证代码语法

运行 Python 语法检查：

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic/backend
python -m py_compile core/jianying_exporter.py
```

Expected: 无输出（无语法错误）

### Step 3: Commit

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add backend/core/jianying_exporter.py
git commit -m "feat: add JianyingExporter core class"
```

---

## Task 3: 实现导出 API 端点

**Files:**
- Modify: `backend/api/export.py`
- Modify: `backend/main.py`

### Step 1: 更新 export.py

修改 `backend/api/export.py`，启用并实现导出端点：

```python
from fastapi import APIRouter, HTTPException
from pathlib import Path
import logging

from models.schemas import ExportJianyingRequest, ExportJianyingResponse
from core.storage import storage
from core.jianying_exporter import JianyingExporter
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["export"])


@router.post("/projects/{project_id}/export/jianying", response_model=ExportJianyingResponse)
async def export_jianying(project_id: str, request: ExportJianyingRequest):
    """导出项目为剪映草稿"""

    # 加载全局设置
    global_settings = storage.load_global_settings()
    draft_path = global_settings.jianying.draftPath or settings.jianying_draft_path

    if not draft_path:
        raise HTTPException(
            status_code=400,
            detail="请先在设置中配置剪映草稿保存路径"
        )

    draft_base_path = Path(draft_path)

    # 验证草稿路径
    try:
        draft_base_path.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"无法访问剪映草稿路径: {e}"
        )

    # 加载项目
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    project_dir = storage._get_project_dir(project_id)

    # 初始化导出器
    template_dir = Path(__file__).parent.parent / "core" / "assets" / "jianying_template"

    if not template_dir.exists():
        raise HTTPException(
            status_code=500,
            detail="剪映模板文件不存在"
        )

    exporter = JianyingExporter(template_dir, draft_base_path)

    try:
        # 执行导出
        result = exporter.export_project(project, project_dir)

        return ExportJianyingResponse(
            exportId=result["draft_id"],
            status="success",
            draftPath=result["draft_path"]
        )

    except Exception as e:
        logger.error(f"导出失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"导出失败: {str(e)}"
        )
```

### Step 2: 更新 main.py

修改 `backend/main.py`，启用 export 路由（取消注释第 14 行和第 36 行）：

```python
from config import settings, ensure_data_dirs
from api import projects, generation, comfyui_workflows, settings as settings_api, prompts, image_prompts, export  # 取消注释 export

# ...

# Include routers
app.include_router(projects.router)
app.include_router(generation.router)
app.include_router(export.router)  # 取消注释
app.include_router(comfyui_workflows.router, prefix="/api/comfyui", tags=["comfyui"])
app.include_router(settings_api.router)
app.include_router(prompts.router)
app.include_router(image_prompts.router)
```

### Step 3: 验证路由

启动后端验证路由是否正确注册：

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic/backend
python -c "
from main import app
routes = [r.path for r in app.routes if hasattr(r, 'path')]
print('Available routes:')
for route in sorted(routes):
    print(f'  {route}')
"
```

Expected: 输出包含 `/api/projects/{project_id}/export/jianying`

### Step 4: Commit

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add backend/api/export.py backend/main.py
git commit -m "feat: implement jianying export API endpoint"
```

---

## Task 4: 前端设置页面集成

**Files:**
- 需要检查前端项目结构后确定

### Note: 前端部分

由于本计划专注于后端实现，前端部分的具体实现需要查看前端代码结构后确定。主要需要：

1. 在设置页面添加"剪映草稿路径"输入框
2. 将剪映草稿路径保存到全局设置
3. 在项目编辑页面启用"导出到剪映"按钮
4. 调用导出 API 并显示结果

这部分可以作为独立的后续任务。

---

## Task 5: 手动测试验证

**Files:**
- 使用已有的项目数据进行测试

### Step 1: 准备测试项目

确保有一个包含图片和音频的测试项目。

### Step 2: 配置剪映草稿路径

1. 启动后端服务
2. 通过 API 或设置页面配置剪映草稿路径
   - macOS: `/Users/{用户名}/Movies/JianyingPro/User Data/Projects/com.lveditor.draft`
   - Windows: `C:\Users\{用户名}\AppData\Local\JianyingPro\User Data\Projects\com.lveditor.draft`

### Step 3: 调用导出 API

```bash
curl -X POST "http://localhost:8000/api/projects/{project_id}/export/jianying" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: 返回成功状态和草稿路径

### Step 4: 验证导出结果

1. 检查剪映草稿目录是否创建了新草稿
2. 检查素材文件是否已复制
3. 在剪映中打开草稿，验证：
   - 图片按顺序显示在视频轨道
   - 音频按顺序显示在音频轨道
   - 时间线长度正确

---

## Summary

这个计划实现了剪映草稿导出的 MVP 版本：

1. **配置更新** - 添加剪映草稿路径配置
2. **核心导出器** - `JianyingExporter` 类处理模板复制、素材处理、JSON 修改
3. **API 端点** - `/api/projects/{project_id}/export/jianying`
4. **手动测试** - 验证功能完整性

后续迭代可以添加：
- 图片动画效果
- 转场效果
- 字幕/文本
- 更丰富的视频编辑功能
