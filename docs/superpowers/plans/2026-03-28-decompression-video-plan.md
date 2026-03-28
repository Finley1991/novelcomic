# 解压视频混剪推文项目 - 实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 NovelComic 项目中新增解压视频混剪推文功能模块，支持两种项目类型选择，复用现有 TTS、ComfyUI、MotionConfig 和剪映导出系统。

**Architecture:** 扩展现有 Project 模型增加 type 字段，新增解压视频专用数据模型和 API 端点，前端新增项目类型选择器和独立的解压视频编辑器组件。

**Tech Stack:** FastAPI, Pydantic, React 18, TypeScript, Tailwind CSS, pyJianYingDraft, ComfyUI, Microsoft TTS

---

## 前置准备：调研 pyJianYingDraft 多轨道支持

**Files:**
- Read: `backend/core/jianying_exporter.py`
- Read: `capcut-mate/src/pyJianYingDraft/` (外部库)

- [ ] **Step 1: 阅读 pyJianYingDraft 库代码，确认是否支持多视频轨道**
  - 检查 DraftFolder、TrackType、add_track 等方法
  - 确认是否可以添加多个视频轨道

- [ ] **Step 2: 根据调研结果确定实施方案**
  - 如果支持多轨道：实施方案 A（视频和图片在不同轨道叠加）
  - 如果不支持：实施方案 B（仅使用视频素材，暂不使用图片）

- [ ] **Step 3: 更新 decompression_exporter.py 中的 flag**
  - 如果支持多轨道：设置 `SUPPORT_MULTIPLE_VIDEO_TRACKS = True`
  - 如果不支持：设置 `SUPPORT_MULTIPLE_VIDEO_TRACKS = False`

- [ ] **Step 4: 确保 style_prompts 目录存在并包含预置风格文件**
  - 检查 `data/style_prompts/` 目录
  - 确认包含：美食甜点.txt、城市风景.txt、治愈插画.txt、水墨国风.txt
  - 如不存在，创建目录和占位文件

---

## 阶段一：后端数据模型和配置

### Task 1: 新增数据模型（schemas.py）

**Files:**
- Modify: `backend/models/schemas.py`

- [ ] **Step 1: 添加 ProjectType 枚举**

```python
class ProjectType(str, Enum):
    NOVEL_COMIC = "novel_comic"
    DECOMPRESSION_VIDEO = "decompression_video"
```

- [ ] **Step 2: 添加解压视频项目子模型**

```python
class TextSegment(BaseModel):
    """按行拆分的文本片段"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    index: int
    text: str

class AudioClip(BaseModel):
    """音频片段"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    textSegmentId: str
    text: str
    audioPath: Optional[str] = None
    duration: float = 0.0
    startTime: float = 0.0
    endTime: float = 0.0
    status: GenerationStatus = GenerationStatus.PENDING

class VideoClip(BaseModel):
    """视频素材片段"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filePath: str
    fileName: str
    duration: float
    startTime: float = 0.0
    endTime: float = 0.0

class ImageClip(BaseModel):
    """图片素材片段"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    index: int
    prompt: str
    imagePath: Optional[str] = None
    duration: float = 15.0
    startTime: float = 0.0
    endTime: float = 0.0
    motion: MotionConfig = Field(default_factory=MotionConfig)
    status: GenerationStatus = GenerationStatus.PENDING

class DecompressionProjectData(BaseModel):
    """解压视频混剪项目特定数据"""
    sourceText: str = ""
    selectedStyle: Optional[str] = None
    textSegments: List[TextSegment] = Field(default_factory=list)
    audioClips: List[AudioClip] = Field(default_factory=list)
    totalAudioDuration: float = 0.0
    videoClips: List[VideoClip] = Field(default_factory=list)
    imageClips: List[ImageClip] = Field(default_factory=list)
    status: str = "editing"
```

- [ ] **Step 3: 修改 Project 模型，新增 type 和 decompressionData 字段**

```python
class Project(BaseModel):
    # ... 现有字段 ...
    type: ProjectType = ProjectType.NOVEL_COMIC
    decompressionData: Optional[DecompressionProjectData] = None
```

- [ ] **Step 4: 修改 GlobalSettings，新增解压视频配置**

```python
class GlobalSettings(BaseModel):
    # ... 现有字段 ...
    decompressionVideoPath: str = "/Users/wyf-mac/Documents/小说推文/视频"
    stylePromptsPath: str = ""
```

- [ ] **Step 5: 添加请求/响应模型**

```python
class CreateProjectRequest(BaseModel):
    name: str
    sourceText: Optional[str] = None
    type: ProjectType = ProjectType.NOVEL_COMIC

class SplitTextRequest(BaseModel):
    pass

class SelectVideosRequest(BaseModel):
    pass

class GenerateDecompressionImagesRequest(BaseModel):
    forceRegenerate: bool = False

class ExportDecompressionJianyingRequest(BaseModel):
    canvasWidth: Optional[int] = None
    canvasHeight: Optional[int] = None
    fps: Optional[int] = None
```

- [ ] **Step 6: 提交**

```bash
git add backend/models/schemas.py
git commit -m "feat: 添加解压视频项目数据模型"
```

### Task 2: 更新配置（config.py）

**Files:**
- Modify: `backend/config.py`

- [ ] **Step 1: 添加默认配置**

```python
class Settings(BaseSettings):
    # ... 现有字段 ...
    decompression_video_path: str = "/Users/wyf-mac/Documents/小说推文/视频"
    style_prompts_path: str = ""
```

- [ ] **Step 2: 提交**

```bash
git add backend/config.py
git commit -m "feat: 添加解压视频默认配置"
```

### Task 3: 更新存储层（storage.py）

**Files:**
- Modify: `backend/core/storage.py`

- [ ] **Step 1: 更新 list_projects，返回 type 字段**

```python
def list_projects(self) -> List[dict]:
    # ... 现有代码 ...
    projects.append({
        "id": data.get("id"),
        "name": data.get("name"),
        "type": data.get("type", "novel_comic"),  # 新增
        "createdAt": data.get("createdAt"),
        "updatedAt": data.get("updatedAt"),
        "status": data.get("status")
    })
```

- [ ] **Step 2: 更新 load_project，向后兼容处理**

```python
def load_project(self, project_id: str) -> Optional[Project]:
    # ... 现有代码 ...
    # 向后兼容：确保 type 字段存在
    if "type" not in data:
        data["type"] = "novel_comic"
    # 向后兼容：确保 decompressionData 字段存在
    if data["type"] == "decompression_video" and "decompressionData" not in data:
        data["decompressionData"] = {}
    return Project(**data)
```

- [ ] **Step 3: 更新 save_project，为解压视频项目创建专用文件夹**

```python
def save_project(self, project: Project):
    # ... 现有代码 ...
    if project.type == ProjectType.DECOMPRESSION_VIDEO:
        (proj_dir / "decompression_images").mkdir(exist_ok=True)
    # ... 保存代码 ...
```

- [ ] **Step 4: 提交**

```bash
git add backend/core/storage.py
git commit -m "feat: 更新存储层支持解压视频项目"
```

---

## 阶段二：后端核心业务逻辑

### Task 4: 新增视频和提示词扫描服务

**Files:**
- Create: `backend/core/decompression_utils.py`

- [ ] **Step 1: 创建视频扫描工具类**

```python
import json
import random
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

try:
    from pymediainfo import MediaInfo
    HAS_PYMEDIAINFO = True
except ImportError:
    HAS_PYMEDIAINFO = False
    logger.warning("pymediainfo not installed, video duration reading will not work")


class VideoScanner:
    """解压视频扫描器"""

    SUPPORTED_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv'}

    def __init__(self, cache_path: Path):
        self.cache_path = cache_path
        self._cache: Optional[Dict] = None

    def _load_cache(self) -> Dict:
        if self._cache is not None:
            return self._cache
        if self.cache_path.exists():
            try:
                with open(self.cache_path, 'r', encoding='utf-8') as f:
                    self._cache = json.load(f)
                    return self._cache
            except Exception:
                pass
        self._cache = {"videos": [], "last_scan": None}
        return self._cache

    def _save_cache(self):
        with open(self.cache_path, 'w', encoding='utf-8') as f:
            json.dump(self._cache, f, indent=2, ensure_ascii=False)

    def get_video_duration(self, video_path: Path) -> float:
        """获取视频时长（秒）"""
        if not HAS_PYMEDIAINFO:
            return 0.0
        try:
            media_info = MediaInfo.parse(str(video_path))
            for track in media_info.tracks:
                if track.track_type == "Video":
                    if track.duration:
                        return float(track.duration) / 1000.0
        except Exception as e:
            logger.warning(f"Failed to read duration for {video_path}: {e}")
        return 0.0

    def scan_videos(self, video_dir: Path, force_rescan: bool = False) -> List[Dict]:
        """扫描视频目录"""
        cache = self._load_cache()

        if not force_rescan and cache.get("last_scan"):
            return cache.get("videos", [])

        videos = []
        if not video_dir.exists():
            return videos

        for file_path in video_dir.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in self.SUPPORTED_EXTENSIONS:
                mtime = file_path.stat().st_mtime

                cached_video = next((v for v in cache.get("videos", [])
                                    if v["filePath"] == str(file_path)), None)

                if cached_video and cached_video.get("mtime") == mtime:
                    videos.append(cached_video)
                else:
                    duration = self.get_video_duration(file_path)
                    videos.append({
                        "filePath": str(file_path),
                        "fileName": file_path.name,
                        "duration": duration,
                        "mtime": mtime
                    })

        self._cache = {
            "videos": videos,
            "last_scan": datetime.now().isoformat()
        }
        self._save_cache()
        return videos

    def select_videos_for_duration(self, video_dir: Path, target_duration: float) -> List[Dict]:
        """选择视频直到达到目标时长"""
        videos = self.scan_videos(video_dir)
        if not videos:
            return []

        selected = []
        current_duration = 0.0
        used_indices = set()
        video_list = videos.copy()

        while current_duration < target_duration:
            available = [v for i, v in enumerate(video_list) if i not in used_indices]

            if not available:
                used_indices.clear()
                random.shuffle(video_list)
                available = video_list

            video = random.choice(available)
            idx = video_list.index(video)
            used_indices.add(idx)

            selected.append(video)
            current_duration += video["duration"]

        return selected


class StylePromptScanner:
    """风格提示词扫描器"""

    def __init__(self, style_prompts_dir: Path):
        self.style_prompts_dir = style_prompts_dir

    def scan_styles(self) -> List[str]:
        """扫描所有风格"""
        styles = []
        if not self.style_prompts_dir.exists():
            return styles

        for file_path in self.style_prompts_dir.iterdir():
            if file_path.is_file() and file_path.suffix.lower() == '.txt':
                styles.append(file_path.stem)

        return sorted(styles)

    def get_prompts_for_style(self, style_name: str) -> List[str]:
        """获取某风格的提示词列表"""
        file_path = self.style_prompts_dir / f"{style_name}.txt"
        if not file_path.exists():
            return []

        prompts = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    prompts.append(line)

        return prompts

    def select_random_prompts(self, style_name: str, count: int) -> List[str]:
        """随机选择提示词"""
        prompts = self.get_prompts_for_style(style_name)
        if not prompts:
            return []

        selected = []
        prompt_list = prompts.copy()
        used_indices = set()

        while len(selected) < count:
            available = [p for i, p in enumerate(prompt_list) if i not in used_indices]

            if not available:
                used_indices.clear()
                random.shuffle(prompt_list)
                available = prompt_list

            prompt = random.choice(available)
            idx = prompt_list.index(prompt)
            used_indices.add(idx)
            selected.append(prompt)

        return selected
```

- [ ] **Step 2: 提交**

```bash
git add backend/core/decompression_utils.py
git commit -m "feat: 添加视频和提示词扫描工具"
```

### Task 5: 新增解压视频 API 端点

**Files:**
- Create: `backend/api/decompression.py`

- [ ] **Step 1: 创建 API 路由**

```python
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Dict, Optional
import uuid
import logging
from pathlib import Path
import random
import math

from config import settings
from models.schemas import (
    Project, SplitTextRequest, SelectVideosRequest,
    GenerateDecompressionImagesRequest, ExportDecompressionJianyingRequest,
    TextSegment, AudioClip, VideoClip, ImageClip,
    ProjectType, MotionType, MotionConfig, GenerationStatus
)
from core.storage import storage
from core.decompression_utils import VideoScanner, StylePromptScanner
from core.tts import TTSClient
from core.comfyui import ComfyUIClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/decompression", tags=["decompression"])

def get_video_scanner() -> VideoScanner:
    cache_path = Path(settings.data_dir) / "decompression_video_cache.json"
    return VideoScanner(cache_path)

def get_style_scanner() -> StylePromptScanner:
    global_settings = storage.load_global_settings()
    style_dir = Path(global_settings.stylePromptsPath) if global_settings.stylePromptsPath else Path(settings.data_dir) / "style_prompts"
    return StylePromptScanner(style_dir)


@router.get("/videos", response_model=List[Dict])
async def list_videos():
    """获取解压视频列表"""
    global_settings = storage.load_global_settings()
    video_dir = Path(global_settings.decompressionVideoPath) if global_settings.decompressionVideoPath else Path(settings.decompression_video_path)
    scanner = get_video_scanner()
    return scanner.scan_videos(video_dir)


@router.post("/videos/scan", response_model=List[Dict])
async def scan_videos():
    """重新扫描视频目录"""
    global_settings = storage.load_global_settings()
    video_dir = Path(global_settings.decompressionVideoPath) if global_settings.decompressionVideoPath else Path(settings.decompression_video_path)
    scanner = get_video_scanner()
    return scanner.scan_videos(video_dir, force_rescan=True)


@router.get("/styles", response_model=List[str])
async def list_styles():
    """获取风格列表"""
    scanner = get_style_scanner()
    return scanner.scan_styles()


@router.get("/styles/{style_name}/prompts", response_model=List[str])
async def get_style_prompts(style_name: str):
    """获取某风格的提示词列表"""
    scanner = get_style_scanner()
    return scanner.get_prompts_for_style(style_name)


@router.post("/styles/scan", response_model=List[str])
async def scan_styles():
    """重新扫描风格提示词目录"""
    scanner = get_style_scanner()
    return scanner.scan_styles()


@router.post("/projects/{project_id}/split-text")
async def split_text(project_id: str, request: SplitTextRequest):
    """按行拆分文本"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")

    if not project.decompressionData:
        from models.schemas import DecompressionProjectData
        project.decompressionData = DecompressionProjectData()

    lines = [line.strip() for line in project.decompressionData.sourceText.split('\n') if line.strip()]
    segments = []
    for i, line in enumerate(lines):
        segments.append(TextSegment(index=i, text=line))

    project.decompressionData.textSegments = segments
    storage.save_project(project)
    return {"success": True, "segments": segments}


@router.post("/projects/{project_id}/generate-audio")
async def generate_audio(project_id: str, background_tasks: BackgroundTasks):
    """生成配音"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")
    if not project.decompressionData or not project.decompressionData.textSegments:
        raise HTTPException(status_code=400, detail="No text segments found")

    background_tasks.add_task(_generate_audio_task, project_id)
    return {"success": True, "message": "Audio generation started"}


async def _generate_audio_task(project_id: str):
    """后台生成配音任务"""
    project = storage.load_project(project_id)
    if not project or not project.decompressionData:
        return

    tts_client = TTSClient()
    global_settings = storage.load_global_settings()
    proj_dir = Path(settings.data_dir) / "projects" / project_id
    audio_dir = proj_dir / "audio"
    audio_dir.mkdir(exist_ok=True)

    audio_clips = []
    current_time = 0.0

    for segment in project.decompressionData.textSegments:
        clip = AudioClip(
            textSegmentId=segment.id,
            text=segment.text,
            status=GenerationStatus.GENERATING
        )

        try:
            audio_path = audio_dir / f"{clip.id}.wav"
            tts_client.synthesize(
                text=segment.text,
                output_path=str(audio_path),
                voice=global_settings.tts.voice,
                rate=global_settings.tts.rate,
                pitch=global_settings.tts.pitch
            )

            import wave
            with wave.open(str(audio_path), 'rb') as wav:
                duration = wav.getnframes() / wav.getframerate()

            clip.audioPath = str(audio_path)
            clip.duration = duration
            clip.startTime = current_time
            clip.endTime = current_time + duration
            clip.status = GenerationStatus.COMPLETED
            current_time += duration

        except Exception as e:
            logger.error(f"Failed to generate audio for segment {segment.id}: {e}")
            clip.status = GenerationStatus.FAILED

        audio_clips.append(clip)

    project.decompressionData.audioClips = audio_clips
    project.decompressionData.totalAudioDuration = current_time
    storage.save_project(project)


@router.post("/projects/{project_id}/select-videos")
async def select_videos(project_id: str, request: SelectVideosRequest):
    """自动选择视频素材"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")
    if not project.decompressionData:
        raise HTTPException(status_code=400, detail="Project data not initialized")

    target_duration = project.decompressionData.totalAudioDuration
    if target_duration <= 0:
        raise HTTPException(status_code=400, detail="No audio duration found")

    global_settings = storage.load_global_settings()
    video_dir = Path(global_settings.decompressionVideoPath) if global_settings.decompressionVideoPath else Path(settings.decompression_video_path)
    scanner = get_video_scanner()
    selected_videos = scanner.select_videos_for_duration(video_dir, target_duration)

    video_clips = []
    current_time = 0.0
    for video_data in selected_videos:
        clip = VideoClip(
            filePath=video_data["filePath"],
            fileName=video_data["fileName"],
            duration=video_data["duration"],
            startTime=current_time,
            endTime=current_time + video_data["duration"]
        )
        video_clips.append(clip)
        current_time += video_data["duration"]

    project.decompressionData.videoClips = video_clips
    storage.save_project(project)
    return {"success": True, "videos": video_clips}


@router.post("/projects/{project_id}/generate-images")
async def generate_images(project_id: str, request: GenerateDecompressionImagesRequest, background_tasks: BackgroundTasks):
    """生成图片"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")
    if not project.decompressionData:
        raise HTTPException(status_code=400, detail="Project data not initialized")
    if not project.decompressionData.selectedStyle:
        raise HTTPException(status_code=400, detail="No style selected")

    target_duration = project.decompressionData.totalAudioDuration
    image_count = math.ceil(target_duration / 15) if target_duration > 0 else 0
    if image_count <= 0:
        raise HTTPException(status_code=400, detail="Invalid image count")

    scanner = get_style_scanner()
    prompts = scanner.select_random_prompts(project.decompressionData.selectedStyle, image_count)

    motion_types = list(MotionType)
    image_clips = []
    current_time = 0.0
    for i, prompt_text in enumerate(prompts):
        motion_type = random.choice(motion_types)
        motion = MotionConfig(type=motion_type)
        if motion_type in (MotionType.ZOOM_IN, MotionType.ZOOM_OUT):
            motion.startScale = 1.0 if motion_type == MotionType.ZOOM_OUT else 0.9
            motion.endScale = 1.1 if motion_type == MotionType.ZOOM_IN else 1.0

        clip = ImageClip(
            index=i,
            prompt=prompt_text,
            duration=15.0,
            startTime=current_time,
            endTime=current_time + 15.0,
            motion=motion,
            status=GenerationStatus.PENDING
        )
        image_clips.append(clip)
        current_time += 15.0

    project.decompressionData.imageClips = image_clips
    storage.save_project(project)

    if len(image_clips) > 0:
        background_tasks.add_task(_generate_images_task, project_id, request.forceRegenerate)

    return {"success": True, "images": image_clips}


async def _generate_images_task(project_id: str, force_regenerate: bool):
    """后台生成图片任务"""
    project = storage.load_project(project_id)
    if not project or not project.decompressionData:
        return

    comfyui_client = ComfyUIClient()
    global_settings = storage.load_global_settings()
    proj_dir = Path(settings.data_dir) / "projects" / project_id
    image_dir = proj_dir / "decompression_images"
    image_dir.mkdir(exist_ok=True)

    for clip in project.decompressionData.imageClips:
        if clip.status == GenerationStatus.COMPLETED and not force_regenerate:
            continue

        clip.status = GenerationStatus.GENERATING
        storage.save_project(project)

        try:
            image_path = image_dir / f"{clip.id}.png"
            seed = random.randint(0, 2**32 - 1)

            comfyui_client.generate_image(
                prompt=clip.prompt,
                negative_prompt="",
                output_path=str(image_path),
                seed=seed
            )

            clip.imagePath = str(image_path)
            clip.status = GenerationStatus.COMPLETED

        except Exception as e:
            logger.error(f"Failed to generate image for clip {clip.id}: {e}")
            clip.status = GenerationStatus.FAILED

        storage.save_project(project)


@router.post("/projects/{project_id}/export-jianying")
async def export_jianying(project_id: str, request: ExportDecompressionJianyingRequest):
    """导出剪映草稿"""
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.type != ProjectType.DECOMPRESSION_VIDEO:
        raise HTTPException(status_code=400, detail="Not a decompression video project")
    if not project.decompressionData:
        raise HTTPException(status_code=400, detail="Project data not initialized")

    from core.decompression_exporter import DecompressionJianyingExporter
    from config import settings

    global_settings = storage.load_global_settings()
    proj_dir = Path(settings.data_dir) / "projects" / project_id
    template_dir = Path(__file__).parent.parent / "core" / "assets" / "jianying_template"
    draft_base_path = Path(global_settings.jianying.draftPath) if global_settings.jianying.draftPath else Path(settings.jianying_draft_path)

    exporter = DecompressionJianyingExporter(template_dir, draft_base_path)
    result = exporter.export_project(project, proj_dir)

    return result
```

- [ ] **Step 2: 提交**

```bash
git add backend/api/decompression.py
git commit -m "feat: 添加解压视频 API 端点"
```

### Task 6: 更新 projects API 支持项目类型

**Files:**
- Modify: `backend/api/projects.py`

- [ ] **Step 1: 更新 CreateProjectRequest 使用**

```python
@router.post("/projects", response_model=Project)
async def create_project(request: CreateProjectRequest):
    project = Project(
        id=str(uuid.uuid4()),
        name=request.name,
        sourceText=request.sourceText or "",
        type=request.type  # 新增
    )

    if request.type == ProjectType.DECOMPRESSION_VIDEO:
        from models.schemas import DecompressionProjectData
        project.decompressionData = DecompressionProjectData(sourceText=request.sourceText or "")

    storage.save_project(project)
    return project
```

- [ ] **Step 2: 更新 get_project 向后兼容**

```python
@router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    project = storage.load_project(project_id)
    # ... 现有兼容代码 ...

    # 确保 type 字段存在
    if not hasattr(project, 'type') or project.type is None:
        project.type = ProjectType.NOVEL_COMIC

    return project
```

- [ ] **Step 3: 提交**

```bash
git add backend/api/projects.py
git commit -m "feat: 更新 projects API 支持项目类型"
```

### Task 7: 注册 decompression 路由

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: 导入并注册路由**

```python
from api import projects, generation, comfyui_workflows, settings as settings_api, prompts, image_prompts, export, scenes, decompression

# ...

app.include_router(decompression.router)
```

- [ ] **Step 2: 提交**

```bash
git add backend/main.py
git commit -m "feat: 注册解压视频路由"
```

### Task 8: 新增解压视频剪映导出器

**Files:**
- Create: `backend/core/decompression_exporter.py`

**注意:** 根据前置准备的调研结果选择实施方案：
- **方案 A（优先）**: 支持多轨道时 - 视频在下层轨道，图片在上层轨道叠加
- **方案 B（备用）**: 不支持多轨道时 - 仅使用视频素材，图片暂不添加

- [ ] **Step 1: 创建导出器类（支持方案 A 和 B）**

```python
import json
import shutil
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict
import uuid
import sys

from config import settings
from models.schemas import Project

logger = logging.getLogger(__name__)

CAPCUT_MATE_PATH = Path("/Users/wyf-mac/Documents/code/claudecode/capcut-mate/src")
sys.path.insert(0, str(CAPCUT_MATE_PATH.parent))

# 根据前置准备的调研结果设置（在前置准备后更新此值）
SUPPORT_MULTIPLE_VIDEO_TRACKS = True


class DecompressionJianyingExporter:
    """解压视频剪映草稿导出器"""

    def __init__(self, template_dir: Path, draft_base_path: Path):
        self.template_dir = template_dir
        self.draft_base_path = draft_base_path

    def export_project(self, project: Project, project_dir: Path) -> Dict[str, str]:
        """导出项目为剪映草稿"""
        if not project.decompressionData:
            raise ValueError("No decompression data")

        draft_id = f"{project.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        draft_dir = self.draft_base_path / draft_id

        logger.info(f"开始导出解压视频项目 {project.id} 到剪映草稿 {draft_id}")

        try:
            import src.pyJianYingDraft as draft
            from src.pyJianYingDraft.draft_folder import DraftFolder
            from src.pyJianYingDraft.time_util import trange

            draft_folder = DraftFolder(str(self.draft_base_path))
            script = draft_folder.create_draft(
                draft_id,
                settings.jianying_canvas_width,
                settings.jianying_canvas_height,
                fps=30,
                allow_replace=True
            )

            # 添加轨道
            if SUPPORT_MULTIPLE_VIDEO_TRACKS:
                script.add_track(draft.TrackType.video, "video_background")
                script.add_track(draft.TrackType.video, "video_overlay")
                script.add_track(draft.TrackType.audio, "tts_audio")
                script.add_track(draft.TrackType.text, "subtitle")
                video_track_index = 0
                image_track_index = 1
                audio_track_index = 2
                subtitle_track_index = 3
            else:
                script.add_track(draft.TrackType.video, "main_video")
                script.add_track(draft.TrackType.audio, "tts_audio")
                script.add_track(draft.TrackType.text, "subtitle")
                video_track_index = 0
                audio_track_index = 1
                subtitle_track_index = 2

            # 复制素材
            materials_map = self._copy_materials(project, project_dir, draft_dir)

            # 添加视频素材
            logger.info("添加视频素材")
            for video_clip in project.decompressionData.videoClips:
                material_key = f"video_{video_clip.id}"
                if material_key in materials_map:
                    script.add_material_to_track(
                        materials_map[material_key],
                        video_track_index,
                        trange(video_clip.startTime, video_clip.endTime)
                    )

            # 添加图片素材（仅在有多轨道支持时）
            if SUPPORT_MULTIPLE_VIDEO_TRACKS and project.decompressionData.imageClips:
                logger.info("添加图片素材")
                for image_clip in project.decompressionData.imageClips:
                    material_key = f"image_{image_clip.id}"
                    if material_key in materials_map:
                        script.add_material_to_track(
                            materials_map[material_key],
                            image_track_index,
                            trange(image_clip.startTime, image_clip.endTime)
                        )

            # 添加音频和字幕
            logger.info("添加音频和字幕")
            for audio_clip in project.decompressionData.audioClips:
                if audio_clip.audioPath:
                    material_key = f"audio_{audio_clip.id}"
                    if material_key in materials_map:
                        script.add_material_to_track(
                            materials_map[material_key],
                            audio_track_index,
                            trange(audio_clip.startTime, audio_clip.endTime)
                        )

                # 添加字幕
                script.add_text_to_track(
                    audio_clip.text,
                    subtitle_track_index,
                    trange(audio_clip.startTime, audio_clip.endTime)
                )

            script.save()

            logger.info(f"成功导出剪映草稿: {draft_dir}")
            return {
                "exportId": draft_id,
                "status": "success",
                "draftPath": str(draft_dir)
            }

        except Exception as e:
            logger.error(f"导出剪映草稿失败: {e}", exc_info=True)
            return {
                "exportId": draft_id,
                "status": "failed",
                "error": str(e)
            }

    def _copy_materials(self, project: Project, project_dir: Path, draft_dir: Path) -> Dict[str, str]:
        """复制素材到草稿目录"""
        materials_map = {}
        draft_materials_dir = draft_dir / "materials"
        draft_materials_dir.mkdir(exist_ok=True)

        if project.decompressionData:
            # 复制视频素材
            for video_clip in project.decompressionData.videoClips:
                src_path = Path(video_clip.filePath)
                if src_path.exists():
                    ext = src_path.suffix
                    dst_path = draft_materials_dir / f"video_{video_clip.id}{ext}"
                    shutil.copy2(src_path, dst_path)
                    materials_map[f"video_{video_clip.id}"] = str(dst_path)

            # 复制图片素材
            for image_clip in project.decompressionData.imageClips:
                if image_clip.imagePath:
                    src_path = Path(image_clip.imagePath)
                    if src_path.exists():
                        ext = src_path.suffix
                        dst_path = draft_materials_dir / f"image_{image_clip.id}{ext}"
                        shutil.copy2(src_path, dst_path)
                        materials_map[f"image_{image_clip.id}"] = str(dst_path)

            # 复制音频素材
            for audio_clip in project.decompressionData.audioClips:
                if audio_clip.audioPath:
                    src_path = Path(audio_clip.audioPath)
                    if src_path.exists():
                        ext = src_path.suffix
                        dst_path = draft_materials_dir / f"audio_{audio_clip.id}{ext}"
                        shutil.copy2(src_path, dst_path)
                        materials_map[f"audio_{audio_clip.id}"] = str(dst_path)

        return materials_map
```

- [ ] **Step 2: 提交**

```bash
git add backend/core/decompression_exporter.py
git commit -m "feat: 添加解压视频剪映导出器"
```

### Task 9: 添加 pymediainfo 到 requirements.txt

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: 添加依赖**

```
pymediainfo==7.0.1
```

- [ ] **Step 2: 提交**

```bash
git add backend/requirements.txt
git commit -m "feat: 添加 pymediainfo 依赖"
```

---

## 阶段三：前端改动

### Task 10: 新增 TypeScript 类型定义

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: 添加项目类型枚举**

```typescript
export type ProjectType = 'novel_comic' | 'decompression_video';
```

- [ ] **Step 2: 添加解压视频相关类型**

```typescript
export interface TextSegment {
  id: string;
  index: number;
  text: string;
}

export interface AudioClip {
  id: string;
  textSegmentId: string;
  text: string;
  audioPath?: string;
  duration: number;
  startTime: number;
  endTime: number;
  status: GenerationStatus;
}

export interface VideoClip {
  id: string;
  filePath: string;
  fileName: string;
  duration: number;
  startTime: number;
  endTime: number;
}

export interface ImageClip {
  id: string;
  index: number;
  prompt: string;
  imagePath?: string;
  duration: number;
  startTime: number;
  endTime: number;
  motion: MotionConfig;
  status: GenerationStatus;
}

export interface DecompressionProjectData {
  sourceText: string;
  selectedStyle?: string;
  textSegments: TextSegment[];
  audioClips: AudioClip[];
  totalAudioDuration: number;
  videoClips: VideoClip[];
  imageClips: ImageClip[];
  status: string;
}

export interface Project {
  // ... 现有字段 ...
  type: ProjectType;
  decompressionData?: DecompressionProjectData;
}

export interface CreateProjectRequest {
  name: string;
  sourceText?: string;
  type?: ProjectType;
}
```

- [ ] **Step 3: 添加解压视频 API 方法**

```typescript
// 解压视频 API
export const decompressionApi = {
  listVideos: () => api.get<{ filePath: string; fileName: string; duration: number }[]>('/decompression/videos'),
  scanVideos: () => api.post<{ filePath: string; fileName: string; duration: number }[]>('/decompression/videos/scan'),
  listStyles: () => api.get<string[]>('/decompression/styles'),
  getStylePrompts: (styleName: string) => api.get<string[]>(`/decompression/styles/${styleName}/prompts`),
  scanStyles: () => api.post<string[]>('/decompression/styles/scan'),
  splitText: (projectId: string) => api.post(`/projects/${projectId}/decompression/split-text`, {}),
  generateAudio: (projectId: string) => api.post(`/projects/${projectId}/decompression/generate-audio`, {}),
  selectVideos: (projectId: string) => api.post(`/projects/${projectId}/decompression/select-videos`, {}),
  generateImages: (projectId: string, forceRegenerate?: boolean) => api.post(`/projects/${projectId}/decompression/generate-images`, { forceRegenerate }),
  exportJianying: (projectId: string, params?: { canvasWidth?: number; canvasHeight?: number; fps?: number }) =>
    api.post(`/projects/${projectId}/decompression/export-jianying`, params || {}),
};
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: 添加解压视频 TypeScript 类型"
```

### Task 11: 更新 Dashboard 页面

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: 添加项目类型选择器**

```typescript
// 添加状态
const [showCreateModal, setShowCreateModal] = useState(false);
const [newProjectName, setNewProjectName] = useState('');
const [selectedProjectType, setSelectedProjectType] = useState<ProjectType>('novel_comic');

// 创建项目
const handleCreateProject = async () => {
  if (!newProjectName.trim()) return;
  try {
    const project = await projectApi.create({
      name: newProjectName.trim(),
      type: selectedProjectType,
    });
    navigate(`/project/${project.id}`);
  } catch (error) {
    console.error('Failed to create project:', error);
  }
};

// 渲染选择器
{showCreateModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="card p-6 w-full max-w-md">
      <h3 className="text-xl font-bold mb-4">创建新项目</h3>
      <input
        type="text"
        value={newProjectName}
        onChange={(e) => setNewProjectName(e.target.value)}
        placeholder="项目名称"
        className="input-field w-full mb-4"
      />
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">项目类型</label>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setSelectedProjectType('novel_comic')}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              selectedProjectType === 'novel_comic'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">🎬</div>
            <div className="font-medium">AI推文视频项目</div>
            <div className="text-sm text-gray-500">小说转漫剧</div>
          </button>
          <button
            onClick={() => setSelectedProjectType('decompression_video')}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              selectedProjectType === 'decompression_video'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">🎮</div>
            <div className="font-medium">解压视频混剪项目</div>
            <div className="text-sm text-gray-500">视频+图片混剪</div>
          </button>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setShowCreateModal(false)} className="btn-secondary">取消</button>
        <button onClick={handleCreateProject} className="btn-primary">创建</button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: 更新项目列表显示类型标签**

```typescript
{project.type === 'decompression_video' && (
  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">解压视频</span>
)}
{project.type === 'novel_comic' && (
  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">AI推文</span>
)}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: 更新 Dashboard 支持项目类型选择"
```

### Task 12: 重构 ProjectEditor 支持两种项目类型

**Files:**
- Modify: `frontend/src/pages/ProjectEditor.tsx`
- Create: `frontend/src/pages/NovelComicEditor.tsx`
- Create: `frontend/src/pages/DecompressionVideoEditor.tsx`

- [ ] **Step 1: 将现有 ProjectEditor 代码提取到 NovelComicEditor.tsx**
  - 复制现有 ProjectEditor.tsx 内容
  - 重命名组件为 NovelComicEditor
  - 保留所有现有功能

- [ ] **Step 2: 创建 DecompressionVideoEditor.tsx**

```typescript
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectApi, decompressionApi } from '../services/api';
import type { Project, ProjectType } from '../services/api';
import { WizardSteps } from '../components/project/WizardSteps';

interface DecompressionVideoEditorProps {
  project: Project;
}

const DecompressionVideoEditor: React.FC<DecompressionVideoEditorProps> = ({ project: initialProject }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project>(initialProject);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { id: 'settings', label: '项目设置' },
    { id: 'text', label: '小说文本' },
    { id: 'audio', label: '音频生成' },
    { id: 'materials', label: '素材准备' },
    { id: 'export', label: '导出剪映' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-light-border dark:border-dark-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="text-primary-500 hover:text-primary-600">
              ← 返回
            </button>
            <h1 className="text-xl font-bold">{project.name}</h1>
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">解压视频</span>
          </div>
        </div>
      </div>

      <WizardSteps
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
      />

      <div className="flex-1 overflow-auto p-6">
        {currentStep === 0 && <StepSettings project={project} onUpdate={setProject} />}
        {currentStep === 1 && <StepText project={project} onUpdate={setProject} />}
        {currentStep === 2 && <StepAudio project={project} onUpdate={setProject} />}
        {currentStep === 3 && <StepMaterials project={project} onUpdate={setProject} />}
        {currentStep === 4 && <StepExport project={project} />}
      </div>
    </div>
  );
};

// Step 组件: 项目设置
const StepSettings: React.FC<{ project: Project; onUpdate: (p: Project) => void }> = ({ project, onUpdate }) => {
  const [styles, setStyles] = useState<string[]>([]);
  const [selectedStyle, setSelectedStyle] = useState(project.decompressionData?.selectedStyle || '');

  useEffect(() => {
    loadStyles();
  }, []);

  const loadStyles = async () => {
    try {
      const data = await decompressionApi.listStyles();
      setStyles(data);
    } catch (error) {
      console.error('Failed to load styles:', error);
    }
  };

  const handleSelectStyle = async (style: string) => {
    setSelectedStyle(style);
    const updated = { ...project };
    if (updated.decompressionData) {
      updated.decompressionData.selectedStyle = style;
    }
    // 调用更新项目 API（需要在 api.ts 中添加此方法）
    await projectApi.update(project.id, {
      decompressionData: updated.decompressionData
    });
    onUpdate(updated);
  };

  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold mb-4">项目设置</h2>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">选择风格</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {styles.map((style) => (
            <button
              key={style}
              onClick={() => handleSelectStyle(style)}
              className={`p-4 border-2 rounded-lg text-center transition-all ${
                selectedStyle === style
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Step 组件: 小说文本
const StepText: React.FC<{ project: Project; onUpdate: (p: Project) => void }> = ({ project, onUpdate }) => {
  const [text, setText] = useState(project.decompressionData?.sourceText || '');
  const [splitting, setSplitting] = useState(false);

  const handleSplit = async () => {
    setSplitting(true);
    try {
      const updated = { ...project };
      if (updated.decompressionData) {
        updated.decompressionData.sourceText = text;
      }
      await projectApi.update(project.id, { sourceText: text });
      await decompressionApi.splitText(project.id);
      await onUpdate(await projectApi.get(project.id));
    } catch (error) {
      console.error('Failed to split text:', error);
    } finally {
      setSplitting(false);
    }
  };

  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold mb-4">小说文本</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="input-field w-full h-64 mb-4"
        placeholder="粘贴小说文本..."
      />
      <button onClick={handleSplit} disabled={splitting} className="btn-primary">
        {splitting ? '拆分中...' : '按行拆分'}
      </button>
      {project.decompressionData?.textSegments && (
        <div className="mt-4">
          <h3 className="font-medium mb-2">已拆分 {project.decompressionData.textSegments.length} 段</h3>
        </div>
      )}
    </div>
  );
};

// Step 组件: 音频生成
const StepAudio: React.FC<{ project: Project; onUpdate: (p: Project) => void }> = ({ project, onUpdate }) => {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await decompressionApi.generateAudio(project.id);
      const poll = setInterval(async () => {
        const updated = await projectApi.get(project.id);
        onUpdate(updated);
        const allDone = updated.decompressionData?.audioClips.every(
          c => c.status === 'completed' || c.status === 'failed'
        );
        if (allDone) clearInterval(poll);
      }, 2000);
    } catch (error) {
      console.error('Failed to generate audio:', error);
    } finally {
      setGenerating(false);
    }
  };

  const clips = project.decompressionData?.audioClips || [];
  const totalDuration = project.decompressionData?.totalAudioDuration || 0;

  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold mb-4">音频生成</h2>
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          共 {clips.length} 段，总时长 {totalDuration.toFixed(1)} 秒
        </p>
      </div>
      <button onClick={handleGenerate} disabled={generating || clips.length === 0} className="btn-primary mb-4">
        {generating ? '生成中...' : '生成配音'}
      </button>
      <div className="space-y-2 max-h-96 overflow-auto">
        {clips.map((clip) => (
          <div key={clip.id} className="flex items-center gap-4 p-2 bg-gray-50 rounded">
            <span className="text-sm flex-1">{clip.text}</span>
            <span className={`text-xs px-2 py-1 rounded ${
              clip.status === 'completed' ? 'bg-green-100 text-green-800' :
              clip.status === 'generating' ? 'bg-yellow-100 text-yellow-800' :
              clip.status === 'failed' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {clip.status}
            </span>
            {clip.duration > 0 && <span className="text-xs text-gray-500">{clip.duration.toFixed(1)}s</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

// Step 组件: 素材准备
const StepMaterials: React.FC<{ project: Project; onUpdate: (p: Project) => void }> = ({ project, onUpdate }) => {
  const [selectingVideos, setSelectingVideos] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);

  const handleSelectVideos = async () => {
    setSelectingVideos(true);
    try {
      await decompressionApi.selectVideos(project.id);
      const updated = await projectApi.get(project.id);
      onUpdate(updated);
    } catch (error) {
      console.error('Failed to select videos:', error);
    } finally {
      setSelectingVideos(false);
    }
  };

  const handleGenerateImages = async () => {
    setGeneratingImages(true);
    try {
      await decompressionApi.generateImages(project.id);
      const poll = setInterval(async () => {
        const updated = await projectApi.get(project.id);
        onUpdate(updated);
        const allDone = updated.decompressionData?.imageClips.every(
          c => c.status === 'completed' || c.status === 'failed'
        );
        if (allDone) clearInterval(poll);
      }, 2000);
    } catch (error) {
      console.error('Failed to generate images:', error);
    } finally {
      setGeneratingImages(false);
    }
  };

  const videoClips = project.decompressionData?.videoClips || [];
  const imageClips = project.decompressionData?.imageClips || [];
  const videoTotal = videoClips.reduce((sum, v) => sum + v.duration, 0);
  const imageTotal = imageClips.length * 15;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">视频素材</h2>
        <p className="text-sm text-gray-600 mb-4">
          已选择 {videoClips.length} 个视频，总时长 {videoTotal.toFixed(1)} 秒
        </p>
        <button onClick={handleSelectVideos} disabled={selectingVideos} className="btn-primary mb-4">
          {selectingVideos ? '选择中...' : '自动选择视频'}
        </button>
        <div className="space-y-1 max-h-48 overflow-auto">
          {videoClips.map((clip) => (
            <div key={clip.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
              <span>{clip.fileName}</span>
              <span className="text-gray-500">{clip.duration.toFixed(1)}s</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">图片素材</h2>
        <p className="text-sm text-gray-600 mb-4">
          {imageClips.length} 张图片，总时长 {imageTotal.toFixed(1)} 秒
        </p>
        <button onClick={handleGenerateImages} disabled={generatingImages} className="btn-primary mb-4">
          {generatingImages ? '生成中...' : '生成图片'}
        </button>
        <div className="grid grid-cols-4 gap-4">
          {imageClips.map((clip) => (
            <div key={clip.id} className="aspect-square bg-gray-100 rounded overflow-hidden">
              {clip.imagePath ? (
                <img src={`/data/projects/${project.id}/decompression_images/${clip.id}.png`} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  {clip.status === 'generating' ? '生成中...' : clip.status}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Step 组件: 导出剪映
const StepExport: React.FC<{ project: Project }> = ({ project }) => {
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await decompressionApi.exportJianying(project.id);
      setResult(data);
    } catch (error) {
      console.error('Failed to export:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold mb-4">导出剪映</h2>
      <button onClick={handleExport} disabled={exporting} className="btn-primary mb-4">
        {exporting ? '导出中...' : '导出剪映草稿'}
      </button>
      {result && result.status === 'success' && (
        <div className="p-4 bg-green-50 text-green-800 rounded">
          导出成功！草稿路径: {result.draftPath}
        </div>
      )}
    </div>
  );
};

export default DecompressionVideoEditor;
```

- [ ] **Step 3: 更新 ProjectEditor.tsx 作为路由分发器**

```typescript
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { projectApi } from '../services/api';
import type { Project } from '../services/api';
import NovelComicEditor from './NovelComicEditor';
import DecompressionVideoEditor from './DecompressionVideoEditor';

const ProjectEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      const data = await projectApi.get(id!);
      setProject(data);
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6">加载中...</div>;
  if (!project) return <div className="p-6">项目未找到</div>;

  if (project.type === 'decompression_video') {
    return <DecompressionVideoEditor project={project} />;
  }

  return <NovelComicEditor project={project} />;
};

export default ProjectEditor;
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/pages/ProjectEditor.tsx
git add frontend/src/pages/NovelComicEditor.tsx
git add frontend/src/pages/DecompressionVideoEditor.tsx
git commit -m "feat: 添加解压视频编辑器"
```

### Task 13: 更新 Settings 页面

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: 添加解压视频设置区域**

```typescript
const [decompressionVideoPath, setDecompressionVideoPath] = useState(settings.decompressionVideoPath || '');
const [stylePromptsPath, setStylePromptsPath] = useState(settings.stylePromptsPath || '');
const [scanningVideos, setScanningVideos] = useState(false);
const [scanningStyles, setScanningStyles] = useState(false);

// ...

<div className="card p-6">
  <h3 className="text-lg font-semibold mb-4">解压视频混剪</h3>

  <div className="mb-4">
    <label className="block text-sm font-medium mb-2">解压视频目录</label>
    <div className="flex gap-2">
      <input
        type="text"
        value={decompressionVideoPath}
        onChange={(e) => setDecompressionVideoPath(e.target.value)}
        className="input-field flex-1"
      />
      <button
        onClick={async () => {
          setScanningVideos(true);
          try {
            await decompressionApi.scanVideos();
          } finally {
            setScanningVideos(false);
          }
        }}
        disabled={scanningVideos}
        className="btn-secondary"
      >
        {scanningVideos ? '扫描中...' : '扫描'}
      </button>
    </div>
  </div>

  <div className="mb-4">
    <label className="block text-sm font-medium mb-2">风格提示词目录</label>
    <div className="flex gap-2">
      <input
        type="text"
        value={stylePromptsPath}
        onChange={(e) => setStylePromptsPath(e.target.value)}
        className="input-field flex-1"
      />
      <button
        onClick={async () => {
          setScanningStyles(true);
          try {
            await decompressionApi.scanStyles();
          } finally {
            setScanningStyles(false);
          }
        }}
        disabled={scanningStyles}
        className="btn-secondary"
      >
        {scanningStyles ? '扫描中...' : '扫描'}
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat: 更新设置页面添加解压视频配置"
```

---

## 阶段四：测试和收尾

### Task 14: 后端测试

**Files:**
- Run: 后端服务

- [ ] **Step 1: 安装新依赖**

```bash
cd backend
source venv/bin/activate
pip install pymediainfo
```

- [ ] **Step 2: 启动后端服务**

```bash
python main.py
```

- [ ] **Step 3: 验证 API 端点**

```bash
# 检查健康状态
curl http://localhost:8000/health

# 检查样式列表
curl http://localhost:8000/api/decompression/styles
```

### Task 15: 前端测试

**Files:**
- Run: 前端服务

- [ ] **Step 1: 启动前端服务**

```bash
cd frontend
npm run dev
```

- [ ] **Step 2: 手动测试流程**
  - 创建解压视频项目
  - 选择风格
  - 输入文本并拆分
  - 生成音频
  - 选择视频素材
  - 生成图片
  - 导出剪映

### Task 16: 更新文档

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 更新 README 添加功能说明**
- [ ] **Step 2: 更新 CHANGELOG 添加本次改动**
- [ ] **Step 3: 提交**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: 更新文档添加解压视频功能"
```

---

## 文件清单

### 新增文件

**后端:**
- `backend/core/decompression_utils.py` - 视频和提示词扫描工具
- `backend/api/decompression.py` - 解压视频 API 端点
- `backend/core/decompression_exporter.py` - 解压视频剪映导出器

**前端:**
- `frontend/src/pages/NovelComicEditor.tsx` - 原项目编辑器（从 ProjectEditor 拆分）
- `frontend/src/pages/DecompressionVideoEditor.tsx` - 解压视频编辑器

### 修改文件

**后端:**
- `backend/models/schemas.py` - 新增数据模型
- `backend/config.py` - 新增默认配置
- `backend/core/storage.py` - 更新存储层
- `backend/api/projects.py` - 支持项目类型
- `backend/main.py` - 注册路由
- `backend/requirements.txt` - 添加 pymediainfo

**前端:**
- `frontend/src/services/api.ts` - 新增类型和 API 方法
- `frontend/src/pages/Dashboard.tsx` - 项目类型选择器
- `frontend/src/pages/ProjectEditor.tsx` - 改为分发器
- `frontend/src/pages/Settings.tsx` - 新增解压视频设置
