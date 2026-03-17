
# NovelComic Implementation Plan

&gt; **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete NovelComic application - a novel-to-manhua-video generation tool with step-by-step workflow, AI image/audio generation, and Jianying draft export.

**Architecture:** FastAPI backend with React frontend, local file-based storage, integrating with ComfyUI, Ollama, and Microsoft TTS APIs.

**Tech Stack:** Python 3.10+, FastAPI, React 18, TypeScript, Tailwind CSS

---

## Chunk 1: Project Scaffolding &amp; Backend Foundation

**Files Created:**
- `novelcomic/backend/requirements.txt`
- `novelcomic/backend/config.py`
- `novelcomic/backend/main.py`
- `novelcomic/backend/models/schemas.py`
- `novelcomic/.env.example`

### Task 1.1: Create Project Structure

- [ ] **Step 1: Create backend directories**

```bash
cd /Users/wyf-mac/Documents/code/claudecode
mkdir -p novelcomic/backend/{api,core,models}
mkdir -p novelcomic/frontend
mkdir -p novelcomic/data/projects
```

- [ ] **Step 2: Create requirements.txt**

```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
pydantic-settings==2.1.0
python-multipart==0.0.6
python-dotenv==1.0.0
aiohttp==3.9.1
Pillow==10.2.0
```

- [ ] **Step 3: Create novelcomic/.env.example**

```env
# Server
HOST=0.0.0.0
PORT=8000

# Data
DATA_DIR=./data

# AI Services
COMFYUI_API_URL=http://8.222.174.34:8188
OLLAMA_API_URL=http://8.222.174.34:11434
OLLAMA_MODEL=llama3

# Microsoft TTS
AZURE_TTS_KEY=
AZURE_TTS_REGION=
```

### Task 1.2: Create Configuration &amp; Data Models

- [ ] **Step 1: Create backend/config.py**

```python
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    data_dir: Path = Path("./data")

    comfyui_api_url: str = "http://8.222.174.34:8188"
    comfyui_timeout: int = 300
    comfyui_max_retries: int = 3
    comfyui_concurrent_limit: int = 3

    ollama_api_url: str = "http://8.222.174.34:11434"
    ollama_model: str = "llama3"
    ollama_timeout: int = 120
    ollama_max_retries: int = 2
    ollama_chunk_size: int = 4000

    azure_tts_key: Optional[str] = None
    azure_tts_region: Optional[str] = None
    tts_voice: str = "zh-CN-XiaoxiaoNeural"
    tts_rate: float = 1.0
    tts_pitch: int = 0
    tts_timeout: int = 60
    tts_max_retries: int = 3
    tts_concurrent_limit: int = 5

    jianying_canvas_width: int = 1920
    jianying_canvas_height: int = 1080
    jianying_canvas_ratio: str = "16:9"

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()

def ensure_data_dirs():
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / "projects").mkdir(exist_ok=True)
```

- [ ] **Step 2: Create backend/models/schemas.py**

```python
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime
import uuid

class MotionType(str, Enum):
    NONE = "none"
    PAN_LEFT = "pan_left"
    PAN_RIGHT = "pan_right"
    PAN_UP = "pan_up"
    PAN_DOWN = "pan_down"
    ZOOM_IN = "zoom_in"
    ZOOM_OUT = "zoom_out"

class GenerationStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"

class MotionConfig(BaseModel):
    type: MotionType = MotionType.NONE
    startScale: float = 1.0
    endScale: float = 1.0
    startX: float = 0.0
    endX: float = 0.0
    startY: float = 0.0
    endY: float = 0.0

class Character(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    characterPrompt: str = ""
    negativePrompt: str = ""
    referenceImages: List[str] = Field(default_factory=list)
    loraName: Optional[str] = None
    loraWeight: float = 0.8

class Storyboard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    index: int = 0
    sceneDescription: str = ""
    dialogue: str = ""
    narration: str = ""
    characterIds: List[str] = Field(default_factory=list)
    imagePrompt: str = ""
    negativePrompt: str = ""
    imagePath: Optional[str] = None
    imageStatus: GenerationStatus = GenerationStatus.PENDING
    imageError: Optional[str] = None
    audioPath: Optional[str] = None
    audioDuration: float = 0.0
    audioStatus: GenerationStatus = GenerationStatus.PENDING
    audioError: Optional[str] = None
    motion: MotionConfig = Field(default_factory=MotionConfig)

class GenerationProgress(BaseModel):
    imagesCompleted: int = 0
    imagesTotal: int = 0
    audioCompleted: int = 0
    audioTotal: int = 0
    lastSavedAt: Optional[datetime] = None

class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)
    status: str = "editing"
    sourceText: str = ""
    stylePrompt: str = ""
    negativePrompt: str = "bad anatomy, bad hands, blurry"
    generationProgress: GenerationProgress = Field(default_factory=GenerationProgress)
    characters: List[Character] = Field(default_factory=list)
    storyboards: List[Storyboard] = Field(default_factory=list)

class ComfyUISettings(BaseModel):
    apiUrl: str = "http://8.222.174.34:8188"
    timeout: int = 300
    maxRetries: int = 3
    concurrentLimit: int = 3

class OllamaSettings(BaseModel):
    apiUrl: str = "http://8.222.174.34:11434"
    model: str = "llama3"
    timeout: int = 120
    maxRetries: int = 2
    chunkSize: int = 4000

class TTSSettings(BaseModel):
    azureKey: Optional[str] = None
    azureRegion: Optional[str] = None
    voice: str = "zh-CN-XiaoxiaoNeural"
    rate: float = 1.0
    pitch: int = 0
    timeout: int = 60
    maxRetries: int = 3
    concurrentLimit: int = 5

class JianyingSettings(BaseModel):
    canvasWidth: int = 1920
    canvasHeight: int = 1080
    canvasRatio: str = "16:9"

class GlobalSettings(BaseModel):
    comfyui: ComfyUISettings = Field(default_factory=ComfyUISettings)
    ollama: OllamaSettings = Field(default_factory=OllamaSettings)
    tts: TTSSettings = Field(default_factory=TTSSettings)
    jianying: JianyingSettings = Field(default_factory=JianyingSettings)

# Request schemas
class CreateProjectRequest(BaseModel):
    name: str
    sourceText: Optional[str] = None

class UpdateStoryboardRequest(BaseModel):
    index: Optional[int] = None
    sceneDescription: Optional[str] = None
    dialogue: Optional[str] = None
    narration: Optional[str] = None
    characterIds: Optional[List[str]] = None
    imagePrompt: Optional[str] = None
    negativePrompt: Optional[str] = None
    motion: Optional[MotionConfig] = None

class ReorderStoryboardsRequest(BaseModel):
    storyboardIds: List[str]

class GenerateImagesRequest(BaseModel):
    storyboardIds: Optional[List[str]] = None
    forceRegenerate: bool = False

class GenerateAudiosRequest(BaseModel):
    storyboardIds: Optional[List[str]] = None
    forceRegenerate: bool = False

class ExportJianyingRequest(BaseModel):
    canvasWidth: Optional[int] = None
    canvasHeight: Optional[int] = None
    fps: Optional[int] = None

# Response schemas
class GenerationStatusResponse(BaseModel):
    images: Dict[str, Any]
    audio: Dict[str, Any]

class ExportJianyingResponse(BaseModel):
    exportId: str
    status: str
    downloadUrl: Optional[str] = None
    error: Optional[str] = None
```

### Task 1.3: Create Main FastAPI App

- [ ] **Step 1: Create backend/main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from config import settings, ensure_data_dirs
from api import projects, generation, export

app = FastAPI(title="NovelComic API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ensure_data_dirs()

# Mount static files for data access
data_path = Path(settings.data_dir).absolute()
if data_path.exists():
    app.mount("/data", StaticFiles(directory=str(data_path)), name="data")

# Include routers
app.include_router(projects.router)
app.include_router(generation.router)
app.include_router(export.router)

@app.get("/")
async def root():
    return {"message": "NovelComic API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
```

- [ ] **Step 2: Create empty __init__.py files**

```bash
touch novelcomic/backend/__init__.py
touch novelcomic/backend/api/__init__.py
touch novelcomic/backend/core/__init__.py
touch novelcomic/backend/models/__init__.py
cp novelcomic/.env.example novelcomic/backend/.env
```

---

## Chunk 2: Project &amp; Settings API with Storage

**Files Created:**
- `novelcomic/backend/core/storage.py`
- `novelcomic/backend/api/projects.py`

### Task 2.1: Create Storage Manager

- [ ] **Step 1: Create backend/core/storage.py**

```python
import json
import shutil
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from config import settings
from models.schemas import Project, GlobalSettings

class StorageManager:
    def __init__(self):
        self.data_dir = settings.data_dir
        self.projects_dir = self.data_dir / "projects"
        self.config_path = self.data_dir / "config.json"

    def _get_project_dir(self, project_id: str) -&gt; Path:
        return self.projects_dir / project_id

    def _get_project_path(self, project_id: str) -&gt; Path:
        return self._get_project_dir(project_id) / "project.json"

    def load_global_settings(self) -&gt; GlobalSettings:
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return GlobalSettings(**data)
            except Exception:
                pass
        return GlobalSettings()

    def save_global_settings(self, settings_obj: GlobalSettings):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(settings_obj.model_dump(), f, indent=2, ensure_ascii=False, default=str)

    def list_projects(self) -&gt; List[dict]:
        projects = []
        if not self.projects_dir.exists():
            return projects
        for proj_dir in self.projects_dir.iterdir():
            if proj_dir.is_dir():
                proj_path = proj_dir / "project.json"
                if proj_path.exists():
                    try:
                        with open(proj_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            projects.append({
                                "id": data.get("id"),
                                "name": data.get("name"),
                                "createdAt": data.get("createdAt"),
                                "updatedAt": data.get("updatedAt"),
                                "status": data.get("status")
                            })
                    except Exception:
                        pass
        return sorted(projects, key=lambda p: p.get("createdAt", ""), reverse=True)

    def load_project(self, project_id: str) -&gt; Optional[Project]:
        proj_path = self._get_project_path(project_id)
        if not proj_path.exists():
            return None
        try:
            with open(proj_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if "createdAt" in data and isinstance(data["createdAt"], str):
                    data["createdAt"] = datetime.fromisoformat(data["createdAt"].replace("Z", "+00:00"))
                if "updatedAt" in data and isinstance(data["updatedAt"], str):
                    data["updatedAt"] = datetime.fromisoformat(data["updatedAt"].replace("Z", "+00:00"))
                return Project(**data)
        except Exception:
            return None

    def save_project(self, project: Project):
        proj_dir = self._get_project_dir(project.id)
        proj_dir.mkdir(parents=True, exist_ok=True)
        (proj_dir / "images").mkdir(exist_ok=True)
        (proj_dir / "audio").mkdir(exist_ok=True)
        (proj_dir / "characters").mkdir(exist_ok=True)
        (proj_dir / "export").mkdir(exist_ok=True)

        project.updatedAt = datetime.now()
        with open(self._get_project_path(project.id), 'w', encoding='utf-8') as f:
            json.dump(project.model_dump(), f, indent=2, ensure_ascii=False, default=str)

    def delete_project(self, project_id: str) -&gt; bool:
        proj_dir = self._get_project_dir(project_id)
        if proj_dir.exists():
            shutil.rmtree(proj_dir)
            return True
        return False

storage = StorageManager()
```

### Task 2.2: Create Projects API

- [ ] **Step 1: Create backend/api/projects.py**

```python
from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List
from datetime import datetime
import uuid

from models.schemas import (
    Project, CreateProjectRequest, GlobalSettings,
    Character, Storyboard, UpdateStoryboardRequest,
    ReorderStoryboardsRequest
)
from core.storage import storage

router = APIRouter(prefix="/api", tags=["projects"])

# Settings endpoints
@router.get("/settings", response_model=GlobalSettings)
async def get_settings():
    return storage.load_global_settings()

@router.put("/settings", response_model=GlobalSettings)
async def update_settings(settings: GlobalSettings):
    storage.save_global_settings(settings)
    return settings

# Project endpoints
@router.get("/projects", response_model=List[dict])
async def list_projects():
    return storage.list_projects()

@router.post("/projects", response_model=Project)
async def create_project(request: CreateProjectRequest):
    project = Project(
        id=str(uuid.uuid4()),
        name=request.name,
        sourceText=request.sourceText or ""
    )
    storage.save_project(project)
    return project

@router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.put("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, request: CreateProjectRequest):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.name = request.name
    if request.sourceText is not None:
        project.sourceText = request.sourceText
    storage.save_project(project)
    return project

@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    success = storage.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"success": True}

# Character endpoints
@router.post("/projects/{project_id}/characters", response_model=Character)
async def create_character(project_id: str, character: Character):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.characters.append(character)
    storage.save_project(project)
    return character

@router.put("/projects/{project_id}/characters/{char_id}", response_model=Character)
async def update_character(project_id: str, char_id: str, character: Character):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for i, char in enumerate(project.characters):
        if char.id == char_id:
            character.id = char_id
            project.characters[i] = character
            storage.save_project(project)
            return character
    raise HTTPException(status_code=404, detail="Character not found")

@router.delete("/projects/{project_id}/characters/{char_id}")
async def delete_character(project_id: str, char_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.characters = [c for c in project.characters if c.id != char_id]
    storage.save_project(project)
    return {"success": True}

@router.post("/projects/{project_id}/characters/{char_id}/reference")
async def upload_character_reference(project_id: str, char_id: str, file: UploadFile = File(...)):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    proj_dir = storage._get_project_dir(project_id)
    char_dir = proj_dir / "characters"
    char_dir.mkdir(exist_ok=True)

    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"{char_id}-{uuid.uuid4().hex[:8]}.{ext}"
    filepath = char_dir / filename

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    for char in project.characters:
        if char.id == char_id:
            char.referenceImages.append(f"characters/{filename}")
            storage.save_project(project)
            return {"success": True, "path": f"characters/{filename}"}

    raise HTTPException(status_code=404, detail="Character not found")

# Storyboard endpoints
@router.get("/projects/{project_id}/storyboards", response_model=List[Storyboard])
async def list_storyboards(project_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.storyboards

@router.post("/projects/{project_id}/storyboards", response_model=Storyboard)
async def create_storyboard(project_id: str, storyboard: Storyboard):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    storyboard.index = len(project.storyboards)
    project.storyboards.append(storyboard)
    storage.save_project(project)
    return storyboard

@router.put("/projects/{project_id}/storyboards/{sb_id}", response_model=Storyboard)
async def update_storyboard(project_id: str, sb_id: str, request: UpdateStoryboardRequest):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for i, sb in enumerate(project.storyboards):
        if sb.id == sb_id:
            if request.index is not None:
                project.storyboards[i].index = request.index
            if request.sceneDescription is not None:
                project.storyboards[i].sceneDescription = request.sceneDescription
            if request.dialogue is not None:
                project.storyboards[i].dialogue = request.dialogue
            if request.narration is not None:
                project.storyboards[i].narration = request.narration
            if request.characterIds is not None:
                project.storyboards[i].characterIds = request.characterIds
            if request.imagePrompt is not None:
                project.storyboards[i].imagePrompt = request.imagePrompt
            if request.negativePrompt is not None:
                project.storyboards[i].negativePrompt = request.negativePrompt
            if request.motion is not None:
                project.storyboards[i].motion = request.motion
            storage.save_project(project)
            return project.storyboards[i]
    raise HTTPException(status_code=404, detail="Storyboard not found")

@router.delete("/projects/{project_id}/storyboards/{sb_id}")
async def delete_storyboard(project_id: str, sb_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.storyboards = [s for s in project.storyboards if s.id != sb_id]
    for i, sb in enumerate(project.storyboards):
        sb.index = i
    storage.save_project(project)
    return {"success": True}

@router.put("/projects/{project_id}/storyboards/reorder")
async def reorder_storyboards(project_id: str, request: ReorderStoryboardsRequest):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    sb_map = {sb.id: sb for sb in project.storyboards}
    new_storyboards = []
    for i, sb_id in enumerate(request.storyboardIds):
        if sb_id in sb_map:
            sb = sb_map[sb_id]
            sb.index = i
            new_storyboards.append(sb)
    project.storyboards = new_storyboards
    storage.save_project(project)
    return {"success": True}
```

---

## Chunk 3: AI Clients (Retry, Ollama, ComfyUI)

**Files Created:**
- `novelcomic/backend/core/retry.py`
- `novelcomic/backend/core/ollama.py`
- `novelcomic/backend/core/comfyui.py`

### Task 3.1: Create Retry Utility

- [ ] **Step 1: Create backend/core/retry.py**

```python
import asyncio
import functools
from typing import Callable, Type, Tuple, Optional
import logging

logger = logging.getLogger(__name__)

def async_retry(
    retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,)
):
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            current_delay = delay
            last_exception = None

            for attempt in range(retries + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt &lt; retries:
                        logger.warning(f"Attempt {attempt + 1}/{retries + 1} failed: {e}. Retrying in {current_delay}s...")
                        await asyncio.sleep(current_delay)
                        current_delay *= backoff
                    else:
                        logger.error(f"All {retries + 1} attempts failed")

            raise last_exception
        return wrapper
    return decorator
```

### Task 3.2: Create Ollama Client

- [ ] **Step 1: Create backend/core/ollama.py**

```python
import aiohttp
import json
from typing import List, Optional, Dict, Any
import logging

from config import settings
from core.retry import async_retry

logger = logging.getLogger(__name__)

class OllamaClient:
    def __init__(self, api_url: Optional[str] = None, model: Optional[str] = None):
        self.api_url = api_url or settings.ollama_api_url
        self.model = model or settings.ollama_model
        self.chunk_size = settings.ollama_chunk_size
        self.overlap_size = 500

    async def _generate(self, prompt: str, system_prompt: Optional[str] = None) -&gt; str:
        url = f"{self.api_url}/api/generate"

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "num_predict": 2048
            }
        }

        if system_prompt:
            payload["system"] = system_prompt

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=settings.ollama_timeout) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise Exception(f"Ollama API error: {resp.status} - {text}")
                data = await resp.json()
                return data.get("response", "")

    @async_retry(retries=settings.ollama_max_retries, delay=1.0, backoff=2.0)
    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -&gt; str:
        return await self._generate(prompt, system_prompt)

    def _chunk_text(self, text: str) -&gt; List[str]:
        if len(text) &lt;= self.chunk_size:
            return [text]

        chunks = []
        start = 0
        text_len = len(text)

        while start &lt; text_len:
            end = min(start + self.chunk_size, text_len)
            if start &gt; 0:
                start = max(0, start - self.overlap_size)
            chunk = text[start:end]
            chunks.append(chunk)
            start = end

        return chunks

    async def extract_characters(self, novel_text: str) -&gt; List[Dict[str, Any]]:
        chunks = self._chunk_text(novel_text)
        all_characters = []
        seen_names = set()

        for chunk in chunks:
            system_prompt = "你是一个专业的小说角色提取助手。从小说文本中提取所有主要角色。"

            prompt = f"""从以下小说文本中提取所有主要角色。对每个角色提供：
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
"""

            try:
                response = await self.generate(prompt, system_prompt)
                json_start = response.find("[")
                json_end = response.rfind("]") + 1
                if json_start &gt;= 0 and json_end &gt; json_start:
                    json_str = response[json_start:json_end]
                    chars = json.loads(json_str)
                    for char in chars:
                        name = char.get("name", "")
                        if name and name not in seen_names:
                            seen_names.add(name)
                            all_characters.append(char)
            except Exception as e:
                logger.error(f"Failed to extract characters from chunk: {e}")

        return all_characters

    async def split_storyboard(self, novel_text: str, characters: List[Dict[str, Any]] = None) -&gt; List[Dict[str, Any]]:
        chunks = self._chunk_text(novel_text)
        all_storyboards = []
        current_index = 0

        for chunk_idx, chunk in enumerate(chunks):
            system_prompt = "你是一个专业的漫剧分镜师。将小说拆分为多个分镜。"

            char_info = ""
            if characters:
                char_info = "角色列表：\n" + "\n".join([f"- {c.get('name', '')}: {c.get('description', '')}" for c in characters])

            prompt = f"""{char_info}

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
"""

            try:
                response = await self.generate(prompt, system_prompt)
                json_start = response.find("[")
                json_end = response.rfind("]") + 1
                if json_start &gt;= 0 and json_end &gt; json_start:
                    json_str = response[json_start:json_end]
                    sbs = json.loads(json_str)
                    for sb in sbs:
                        sb["index"] = current_index
                        all_storyboards.append(sb)
                        current_index += 1
            except Exception as e:
                logger.error(f"Failed to split storyboard from chunk: {e}")

        return all_storyboards

    async def generate_image_prompt(self, scene_description: str, characters: List[Dict[str, Any]] = None, style_prompt: str = "") -&gt; str:
        system_prompt = "你是一个专业的AI绘画提示词工程师。将画面描述转换为Stable Diffusion提示词。"

        char_info = ""
        if characters:
            char_info = "角色提示词：\n" + "\n".join([f"- {c.get('name', '')}: {c.get('characterPrompt', '')}" for c in characters])

        prompt = f"""{char_info}
风格提示词：{style_prompt}

将以下画面描述转换为详细的Stable Diffusion英文提示词。要求：
- 详细的视觉描述
- 包含光影、氛围、构图等元素
- 使用英文

画面描述：
{scene_description}

仅返回提示词内容，不要其他说明。
"""

        try:
            return await self.generate(prompt, system_prompt)
        except Exception as e:
            logger.error(f"Failed to generate image prompt: {e}")
            return scene_description
```

### Task 3.3: Create ComfyUI Client

- [ ] **Step 1: Create backend/core/comfyui.py**

```python
import aiohttp
import asyncio
from typing import Optional, Dict, Any, List
import uuid
import logging

from config import settings
from core.retry import async_retry

logger = logging.getLogger(__name__)

class ComfyUIClient:
    def __init__(self, api_url: Optional[str] = None):
        self.api_url = api_url or settings.comfyui_api_url
        self.client_id = str(uuid.uuid4())

    async def check_connection(self) -&gt; bool:
        try:
            url = f"{self.api_url}/system_stats"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as resp:
                    return resp.status == 200
        except Exception as e:
            logger.error(f"ComfyUI connection check failed: {e}")
            return False

    @async_retry(retries=settings.comfyui_max_retries, delay=2.0, backoff=2.0)
    async def _queue_prompt(self, workflow: Dict[str, Any]) -&gt; str:
        url = f"{self.api_url}/prompt"
        payload = {
            "prompt": workflow,
            "client_id": self.client_id
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=settings.comfyui_timeout) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise Exception(f"ComfyUI API error: {resp.status} - {text}")
                data = await resp.json()
                return data.get("prompt_id")

    async def _get_history(self, prompt_id: str) -&gt; Optional[Dict[str, Any]]:
        url = f"{self.api_url}/history/{prompt_id}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=30) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get(prompt_id)
                return None

    async def _get_image(self, filename: str, subfolder: str = "", type: str = "output") -&gt; Optional[bytes]:
        url = f"{self.api_url}/view"
        params = {"filename": filename, "subfolder": subfolder, "type": type}
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=30) as resp:
                if resp.status == 200:
                    return await resp.read()
                return None

    async def generate_image(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 1024,
        height: int = 1024,
        steps: int = 30,
        cfg: float = 7.0,
        sampler_name: str = "dpmpp_2m_sde_karras"
    ) -&gt; Optional[bytes]:
        workflow = self._build_text_to_image_workflow(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            steps=steps,
            cfg=cfg,
            sampler_name=sampler_name
        )

        prompt_id = await self._queue_prompt(workflow)
        logger.info(f"Queued ComfyUI prompt: {prompt_id}")

        max_wait = settings.comfyui_timeout
        poll_interval = 2.0
        waited = 0.0

        while waited &lt; max_wait:
            history = await self._get_history(prompt_id)
            if history and "outputs" in history:
                outputs = history["outputs"]
                for node_id, node_output in outputs.items():
                    if "images" in node_output and node_output["images"]:
                        img_info = node_output["images"][0]
                        img_data = await self._get_image(
                            img_info["filename"],
                            img_info.get("subfolder", ""),
                            img_info.get("type", "output")
                        )
                        if img_data:
                            return img_data

            await asyncio.sleep(poll_interval)
            waited += poll_interval

        raise Exception("Timeout waiting for ComfyUI generation")

    def _build_text_to_image_workflow(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 1024,
        height: int = 1024,
        steps: int = 30,
        cfg: float = 7.0,
        sampler_name: str = "dpmpp_2m_sde_karras"
    ) -&gt; Dict[str, Any]:
        return {
            "3": {
                "inputs": {
                    "seed": 0,
                    "steps": steps,
                    "cfg": cfg,
                    "sampler_name": sampler_name,
                    "scheduler": "karras",
                    "denoise": 1.0,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["5", 0]
                },
                "class_type": "KSampler"
            },
            "4": {
                "inputs": {
                    "ckpt_name": "v1-5-pruned-emaonly.ckpt"
                },
                "class_type": "CheckpointLoaderSimple"
            },
            "5": {
                "inputs": {
                    "width": width,
                    "height": height,
                    "batch_size": 1
                },
                "class_type": "EmptyLatentImage"
            },
            "6": {
                "inputs": {
                    "text": prompt,
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "7": {
                "inputs": {
                    "text": negative_prompt or "bad anatomy, bad hands",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "8": {
                "inputs": {
                    "samples": ["3", 0],
                    "vae": ["4", 2]
                },
                "class_type": "VAEDecode"
            },
            "9": {
                "inputs": {
                    "filename_prefix": "ComfyUI",
                    "images": ["8", 0]
                },
                "class_type": "SaveImage"
            }
        }
```

---

## Chunk 4: TTS Client &amp; Generation API

**Files Created:**
- `novelcomic/backend/core/tts.py`
- `novelcomic/backend/api/generation.py`

### Task 4.1: Create TTS Client

- [ ] **Step 1: Create backend/core/tts.py**

```python
import aiohttp
from typing import Optional
import logging
import struct
import wave
from io import BytesIO

from config import settings
from core.retry import async_retry

logger = logging.getLogger(__name__)

class TTSClient:
    def __init__(self, key: Optional[str] = None, region: Optional[str] = None):
        self.key = key or settings.azure_tts_key
        self.region = region or settings.azure_tts_region
        self.voice = settings.tts_voice
        self.rate = settings.tts_rate
        self.pitch = settings.tts_pitch

    async def _get_access_token(self) -&gt; str:
        if not self.key or not self.region:
            raise Exception("Azure TTS key and region not configured")

        url = f"https://{self.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
        headers = {
            "Ocp-Apim-Subscription-Key": self.key,
            "Content-Type": "application/x-www-form-urlencoded"
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, timeout=10) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise Exception(f"Failed to get TTS token: {resp.status} - {text}")
                return await resp.text()

    def _build_ssml(self, text: str, voice: Optional[str] = None, rate: Optional[float] = None, pitch: Optional[int] = None) -&gt; str:
        voice = voice or self.voice
        rate = rate or self.rate
        pitch = pitch or self.pitch

        prosody_rate = f"{rate * 100:.0f}%"
        prosody_pitch = f"{pitch:+d}Hz" if pitch != 0 else "0Hz"

        return f"""&lt;speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN"&gt;
    &lt;voice name="{voice}"&gt;
        &lt;prosody rate="{prosody_rate}" pitch="{prosody_pitch}"&gt;
            {text}
        &lt;/prosody&gt;
    &lt;/voice&gt;
&lt;/speak&gt;"""

    @async_retry(retries=settings.tts_max_retries, delay=1.0, backoff=2.0)
    async def synthesize(self, text: str, voice: Optional[str] = None, rate: Optional[float] = None, pitch: Optional[int] = None) -&gt; tuple[bytes, float]:
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")

        access_token = await self._get_access_token()
        ssml = self._build_ssml(text, voice, rate, pitch)

        url = f"https://{self.region}.tts.speech.microsoft.com/cognitiveservices/v1"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm"
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, data=ssml.encode("utf-8"), timeout=settings.tts_timeout) as resp:
                if resp.status != 200:
                    text_resp = await resp.text()
                    raise Exception(f"TTS synthesis failed: {resp.status} - {text_resp}")
                audio_data = await resp.read()

        duration = self._calculate_duration(audio_data)
        return audio_data, duration

    def _calculate_duration(self, wav_data: bytes) -&gt; float:
        try:
            with wave.open(BytesIO(wav_data), 'rb') as wav:
                frames = wav.getnframes()
                rate = wav.getframerate()
                return frames / rate
        except Exception:
            return len(wav_data) / 48000
```

### Task 4.2: Create Generation API

- [ ] **Step 1: Create backend/api/generation.py**

```python
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from typing import Dict, Any, Optional, Set
import asyncio
from pathlib import Path
from PIL import Image
from io import BytesIO
import uuid

from models.schemas import (
    Project, GenerateImagesRequest, GenerateAudiosRequest,
    GenerationStatus, GenerationStatusResponse
)
from core.storage import storage
from core.ollama import OllamaClient
from core.comfyui import ComfyUIClient
from core.tts import TTSClient
from config import settings

router = APIRouter(prefix="/api", tags=["generation"])

generation_tasks: Dict[str, Dict[str, Any]] = {}
active_generations: Set[str] = set()

_comfyui_semaphore = asyncio.Semaphore(settings.comfyui_concurrent_limit)
_tts_semaphore = asyncio.Semaphore(settings.tts_concurrent_limit)

async def generate_single_image(project_id: str, sb_id: str):
    key = f"{project_id}:{sb_id}"
    if key in active_generations:
        return
    active_generations.add(key)

    try:
        async with _comfyui_semaphore:
            project = storage.load_project(project_id)
            if not project:
                return

            storyboard = None
            for sb in project.storyboards:
                if sb.id == sb_id:
                    storyboard = sb
                    break

            if not storyboard:
                return

            storyboard.imageStatus = GenerationStatus.GENERATING
            storage.save_project(project)

            char_map = {c.id: c for c in project.characters}
            characters = [char_map[cid] for cid in storyboard.characterIds if cid in char_map]

            if not storyboard.imagePrompt:
                ollama_client = OllamaClient()
                char_dicts = [c.model_dump() for c in characters]
                storyboard.imagePrompt = await ollama_client.generate_image_prompt(
                    storyboard.sceneDescription,
                    char_dicts,
                    project.stylePrompt
                )

            full_prompt = storyboard.imagePrompt
            for char in characters:
                if char.characterPrompt:
                    full_prompt = f"{char.characterPrompt}, {full_prompt}"

            negative_prompt = storyboard.negativePrompt or project.negativePrompt
            for char in characters:
                if char.negativePrompt:
                    negative_prompt = f"{negative_prompt}, {char.negativePrompt}"

            comfy_client = ComfyUIClient()
            img_data = await comfy_client.generate_image(
                prompt=full_prompt,
                negative_prompt=negative_prompt,
                width=1024,
                height=1024
            )

            proj_dir = Path(settings.data_dir) / "projects" / project_id
            img_path = proj_dir / "images" / f"sb-{storyboard.index:03d}.png"

            img = Image.open(BytesIO(img_data))
            img.save(img_path, "PNG")

            storyboard.imagePath = f"images/sb-{storyboard.index:03d}.png"
            storyboard.imageStatus = GenerationStatus.COMPLETED
            storyboard.imageError = None

            project.generationProgress.imagesCompleted += 1
            storage.save_project(project)

    except Exception as e:
        project = storage.load_project(project_id)
        if project:
            for sb in project.storyboards:
                if sb.id == sb_id:
                    sb.imageStatus = GenerationStatus.FAILED
                    sb.imageError = str(e)
            storage.save_project(project)
    finally:
        active_generations.discard(key)

async def generate_single_audio(project_id: str, sb_id: str):
    key = f"{project_id}:{sb_id}:audio"
    if key in active_generations:
        return
    active_generations.add(key)

    try:
        async with _tts_semaphore:
            project = storage.load_project(project_id)
            if not project:
                return

            storyboard = None
            for sb in project.storyboards:
                if sb.id == sb_id:
                    storyboard = sb
                    break

            if not storyboard:
                return

            text = storyboard.narration or storyboard.dialogue
            if not text or not text.strip():
                storyboard.audioStatus = GenerationStatus.COMPLETED
                storyboard.audioDuration = 0
                storage.save_project(project)
                return

            storyboard.audioStatus = GenerationStatus.GENERATING
            storage.save_project(project)

            tts_client = TTSClient()
            audio_data, duration = await tts_client.synthesize(text)

            proj_dir = Path(settings.data_dir) / "projects" / project_id
            audio_path = proj_dir / "audio" / f"sb-{storyboard.index:03d}.wav"

            with open(audio_path, "wb") as f:
                f.write(audio_data)

            storyboard.audioPath = f"audio/sb-{storyboard.index:03d}.wav"
            storyboard.audioDuration = duration
            storyboard.audioStatus = GenerationStatus.COMPLETED
            storyboard.audioError = None

            project.generationProgress.audioCompleted += 1
            storage.save_project(project)

    except Exception as e:
        project = storage.load_project(project_id)
        if project:
            for sb in project.storyboards:
                if sb.id == sb_id:
                    sb.audioStatus = GenerationStatus.FAILED
                    sb.audioError = str(e)
            storage.save_project(project)
    finally:
        active_generations.discard(key)

@router.post("/projects/{project_id}/characters/extract")
async def extract_characters(project_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ollama_client = OllamaClient()
    char_dicts = await ollama_client.extract_characters(project.sourceText)

    from models.schemas import Character
    for char_dict in char_dicts:
        char = Character(
            name=char_dict.get("name", ""),
            description=char_dict.get("description", ""),
            characterPrompt=f"{char_dict.get('description', '')}, {char_dict.get('personality', '')}"
        )
        project.characters.append(char)

    storage.save_project(project)
    return {"characters": project.characters}

@router.post("/projects/{project_id}/storyboards/split")
async def split_storyboard(project_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ollama_client = OllamaClient()
    char_dicts = [c.model_dump() for c in project.characters]
    sb_dicts = await ollama_client.split_storyboard(project.sourceText, char_dicts)

    from models.schemas import Storyboard
    char_map = {c.name: c.id for c in project.characters}

    for sb_dict in sb_dicts:
        char_names = sb_dict.get("characterNames", [])
        char_ids = [char_map[name] for name in char_names if name in char_map]

        storyboard = Storyboard(
            index=sb_dict.get("index", len(project.storyboards)),
            sceneDescription=sb_dict.get("sceneDescription", ""),
            dialogue=sb_dict.get("dialogue", ""),
            narration=sb_dict.get("narration", ""),
            characterIds=char_ids
        )
        project.storyboards.append(storyboard)

    project.generationProgress.imagesTotal = len(project.storyboards)
    project.generationProgress.audioTotal = len(project.storyboards)
    storage.save_project(project)
    return {"storyboards": project.storyboards}

@router.post("/projects/{project_id}/generate/image")
async def generate_image(
    project_id: str,
    storyboard_id: str = Query(..., description="Storyboard ID to generate"),
    background_tasks: BackgroundTasks = None
):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if background_tasks:
        background_tasks.add_task(generate_single_image, project_id, storyboard_id)
    return {"status": "queued"}

@router.post("/projects/{project_id}/generate/images")
async def generate_images(project_id: str, request: GenerateImagesRequest, background_tasks: BackgroundTasks):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    target_sb_ids = request.storyboardIds or [sb.id for sb in project.storyboards]

    to_generate = []
    for sb in project.storyboards:
        if sb.id in target_sb_ids:
            if request.forceRegenerate or sb.imageStatus in [GenerationStatus.PENDING, GenerationStatus.FAILED]:
                to_generate.append(sb.id)

    project.generationProgress.imagesTotal = len(target_sb_ids)
    project.generationProgress.imagesCompleted = len([
        sb for sb in project.storyboards if sb.imageStatus == GenerationStatus.COMPLETED and sb.id not in to_generate
    ])
    storage.save_project(project)

    for sb_id in to_generate:
        background_tasks.add_task(generate_single_image, project_id, sb_id)

    return {"status": "queued", "count": len(to_generate)}

@router.post("/projects/{project_id}/generate/audio")
async def generate_audio(
    project_id: str,
    storyboard_id: str = Query(..., description="Storyboard ID to generate"),
    background_tasks: BackgroundTasks = None
):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if background_tasks:
        background_tasks.add_task(generate_single_audio, project_id, storyboard_id)
    return {"status": "queued"}

@router.post("/projects/{project_id}/generate/audios")
async def generate_audios(project_id: str, request: GenerateAudiosRequest, background_tasks: BackgroundTasks):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    target_sb_ids = request.storyboardIds or [sb.id for sb in project.storyboards]

    to_generate = []
    for sb in project.storyboards:
        if sb.id in target_sb_ids:
            if request.forceRegenerate or sb.audioStatus in [GenerationStatus.PENDING, GenerationStatus.FAILED]:
                to_generate.append(sb.id)

    project.generationProgress.audioTotal = len(target_sb_ids)
    project.generationProgress.audioCompleted = len([
        sb for sb in project.storyboards if sb.audioStatus == GenerationStatus.COMPLETED and sb.id not in to_generate
    ])
    storage.save_project(project)

    for sb_id in to_generate:
        background_tasks.add_task(generate_single_audio, project_id, sb_id)

    return {"status": "queued", "count": len(to_generate)}

@router.get("/projects/{project_id}/generate/status", response_model=GenerationStatusResponse)
async def get_generation_status(project_id: str):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    in_progress_images = [sb.id for sb in project.storyboards if sb.imageStatus == GenerationStatus.GENERATING]
    failed_images = [{"id": sb.id, "error": sb.imageError} for sb in project.storyboards if sb.imageStatus == GenerationStatus.FAILED]

    in_progress_audio = [sb.id for sb in project.storyboards if sb.audioStatus == GenerationStatus.GENERATING]
    failed_audio = [{"id": sb.id, "error": sb.audioError} for sb in project.storyboards if sb.audioStatus == GenerationStatus.FAILED]

    return GenerationStatusResponse(
        images={
            "completed": project.generationProgress.imagesCompleted,
            "total": project.generationProgress.imagesTotal,
            "inProgress": in_progress_images,
            "failed": failed_images
        },
        audio={
            "completed": project.generationProgress.audioCompleted,
            "total": project.generationProgress.audioTotal,
            "inProgress": in_progress_audio,
            "failed": failed_audio
        }
    )
```

---

## Chunk 5: Jianying Export

**Files Created:**
- `novelcomic/backend/core/jianying.py`
- `novelcomic/backend/api/export.py`

### Task 5.1: Create Jianying Generator

- [ ] **Step 1: Create backend/core/jianying.py**

```python
import json
import uuid
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
import zipfile
import logging

from models.schemas import Project, Storyboard, MotionType
from config import settings

logger = logging.getLogger(__name__)

class JianyingGenerator:
    def __init__(self, project: Project, output_dir: Path):
        self.project = project
        self.output_dir = output_dir
        self.draft_id = str(uuid.uuid4()).upper()
        self.now = datetime.now()

    def generate(self) -&gt; Path:
        draft_dir = self.output_dir / f"jianying_draft_{self.project.id[:8]}"
        if draft_dir.exists():
            shutil.rmtree(draft_dir)
        draft_dir.mkdir(parents=True)

        (draft_dir / "video").mkdir()
        (draft_dir / "image").mkdir()
        (draft_dir / "audio").mkdir()

        self._copy_assets(draft_dir)
        draft_content = self._build_draft_content(draft_dir)

        with open(draft_dir / "draft_content.json", "w", encoding="utf-8") as f:
            json.dump(draft_content, f, ensure_ascii=False)

        self._build_draft_meta(draft_dir)

        zip_path = self.output_dir / f"jianying_draft_{self.project.id[:8]}.zip"
        self._zip_directory(draft_dir, zip_path)

        shutil.rmtree(draft_dir)
        return zip_path

    def _copy_assets(self, draft_dir: Path):
        proj_dir = Path(settings.data_dir) / "projects" / self.project.id

        for sb in self.project.storyboards:
            if sb.imagePath:
                src_path = proj_dir / sb.imagePath
                if src_path.exists():
                    dst_name = f"{sb.id}.png"
                    shutil.copy2(src_path, draft_dir / "image" / dst_name)

            if sb.audioPath:
                src_path = proj_dir / sb.audioPath
                if src_path.exists():
                    dst_name = f"{sb.id}.wav"
                    shutil.copy2(src_path, draft_dir / "audio" / dst_name)

    def _build_draft_content(self, draft_dir: Path) -&gt; Dict[str, Any]:
        materials_videos = []
        materials_audios = []
        video_segments = []
        audio_segments = []

        current_time = 0

        for sb in self.project.storyboards:
            sb_material_id = str(uuid.uuid4()).upper()

            if sb.imagePath:
                img_path = Path(sb.imagePath)
                materials_videos.append({
                    "id": sb_material_id,
                    "type": "photo",
                    "file_path": f"image/{sb.id}.png",
                    "width": settings.jianying_canvas_width,
                    "height": settings.jianying_canvas_height,
                    "duration": 10800000000
                })

            duration = int((sb.audioDuration or 3.0) * 1000000)

            start_scale, end_scale, start_x, end_x, start_y, end_y = self._calculate_motion_params(sb, duration)

            motion_type = sb.motion.type if sb.motion else MotionType.NONE

            video_segments.append(self._build_video_segment(
                sb_material_id,
                current_time,
                duration,
                start_scale, end_scale, start_x, end_x, start_y, end_y,
                motion_type
            ))

            if sb.audioPath:
                audio_material_id = str(uuid.uuid4()).upper()
                materials_audios.append({
                    "id": audio_material_id,
                    "file_path": f"audio/{sb.id}.wav",
                    "duration": duration
                })
                audio_segments.append(self._build_audio_segment(
                    audio_material_id,
                    current_time,
                    duration
                ))

            current_time += duration

        return {
            "id": self.draft_id,
            "version": "1.0",
            "name": self.project.name,
            "fps": 30,
            "duration": current_time,
            "canvas_config": {
                "dom_width": 0,
                "dom_height": 0,
                "ratio": settings.jianying_canvas_ratio,
                "width": settings.jianying_canvas_width,
                "height": settings.jianying_canvas_height,
                "background": None
            },
            "materials": {
                "videos": materials_videos,
                "audios": materials_audios,
                "images": [],
                "texts": [],
                "effects": [],
                "stickers": [],
                "transitions": [],
                "audio_effects": []
            },
            "tracks": [
                {
                    "id": str(uuid.uuid4()).upper(),
                    "type": "video",
                    "name": "Screen",
                    "segments": video_segments
                },
                {
                    "id": str(uuid.uuid4()).upper(),
                    "type": "audio",
                    "name": "TTS",
                    "segments": audio_segments
                }
            ],
            "keyframes": {
                "videos": [],
                "audios": [],
                "texts": [],
                "stickers": [],
                "filters": [],
                "adjusts": []
            }
        }

    def _calculate_motion_params(self, sb: Storyboard, duration_us: int):
        if not sb.motion:
            return 1.0, 1.0, 0.0, 0.0, 0.0, 0.0

        motion = sb.motion
        duration_scale = min(1.0, (duration_us / 1000000) / 5.0)

        start_scale = motion.startScale
        end_scale = motion.endScale
        start_x = motion.startX
        end_x = motion.endX * duration_scale
        start_y = motion.startY
        end_y = motion.endY * duration_scale

        return start_scale, end_scale, start_x, end_x, start_y, end_y

    def _build_video_segment(
        self,
        material_id: str,
        start_time: int,
        duration: int,
        start_scale: float, end_scale: float,
        start_x: float, end_x: float,
        start_y: float, end_y: float,
        motion_type: MotionType
    ) -&gt; Dict[str, Any]:
        segment_id = str(uuid.uuid4()).upper()

        common_keyframes = []

        if motion_type == MotionType.PAN_LEFT and end_x != 0:
            common_keyframes.append(self._build_position_keyframe(segment_id, "KFTypePositionX", 0, duration, start_x, end_x))
        elif motion_type == MotionType.PAN_RIGHT and end_x != 0:
            common_keyframes.append(self._build_position_keyframe(segment_id, "KFTypePositionX", 0, duration, start_x, end_x))
        elif motion_type == MotionType.PAN_UP and end_y != 0:
            common_keyframes.append(self._build_position_keyframe(segment_id, "KFTypePositionY", 0, duration, start_y, end_y))
        elif motion_type == MotionType.PAN_DOWN and end_y != 0:
            common_keyframes.append(self._build_position_keyframe(segment_id, "KFTypePositionY", 0, duration, start_y, end_y))
        elif motion_type in [MotionType.ZOOM_IN, MotionType.ZOOM_OUT] and start_scale != end_scale:
            common_keyframes.append(self._build_scale_keyframe(segment_id, 0, duration, start_scale, end_scale))

        return {
            "id": segment_id,
            "material_id": material_id,
            "target_timerange": {
                "start": start_time,
                "duration": duration
            },
            "source_timerange": {
                "start": 0,
                "duration": duration
            },
            "clip": {
                "rotation": 0,
                "alpha": 1,
                "scale": {"x": start_scale, "y": start_scale},
                "transform": {"x": start_x, "y": start_y},
                "flip": {"vertical": False, "horizontal": False}
            },
            "common_keyframes": common_keyframes
        }

    def _build_position_keyframe(self, segment_id: str, property_type: str, start_time: int, duration: int, start_val: float, end_val: float) -&gt; Dict[str, Any]:
        return {
            "id": str(uuid.uuid4()).upper(),
            "material_id": "",
            "property_type": property_type,
            "keyframe_list": [
                {
                    "id": str(uuid.uuid4()).upper(),
                    "curveType": "Line",
                    "time_offset": start_time,
                    "values": [start_val]
                },
                {
                    "id": str(uuid.uuid4()).upper(),
                    "curveType": "Line",
                    "time_offset": duration,
                    "values": [end_val]
                }
            ]
        }

    def _build_scale_keyframe(self, segment_id: str, start_time: int, duration: int, start_val: float, end_val: float) -&gt; Dict[str, Any]:
        return {
            "id": str(uuid.uuid4()).upper(),
            "material_id": "",
            "property_type": "KFTypeScale",
            "keyframe_list": [
                {
                    "id": str(uuid.uuid4()).upper(),
                    "curveType": "Line",
                    "time_offset": start_time,
                    "values": [start_val]
                },
                {
                    "id": str(uuid.uuid4()).upper(),
                    "curveType": "Line",
                    "time_offset": duration,
                    "values": [end_val]
                }
            ]
        }

    def _build_audio_segment(self, material_id: str, start_time: int, duration: int) -&gt; Dict[str, Any]:
        return {
            "id": str(uuid.uuid4()).upper(),
            "material_id": material_id,
            "target_timerange": {
                "start": start_time,
                "duration": duration
            },
            "source_timerange": {
                "start": 0,
                "duration": duration
            }
        }

    def _build_draft_meta(self, draft_dir: Path):
        meta = {
            "draft_id": self.draft_id,
            "draft_name": self.project.name,
            "draft_fold_path": str(draft_dir),
            "tm_draft_create": int(self.now.timestamp() * 1000000),
            "tm_draft_modified": int(self.now.timestamp() * 1000000),
            "tm_duration": 0
        }
        with open(draft_dir / "draft_meta_info.json", "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False)

        with open(draft_dir / "draft.extra", "w", encoding="utf-8") as f:
            f.write("{}")

    def _zip_directory(self, dir_path: Path, zip_path: Path):
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in dir_path.rglob('*'):
                if file_path.is_file():
                    arcname = file_path.relative_to(dir_path)
                    zipf.write(file_path, arcname)
```

### Task 5.2: Create Export API

- [ ] **Step 1: Create backend/api/export.py**

```python
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import uuid

from models.schemas import Project, ExportJianyingRequest, ExportJianyingResponse
from core.storage import storage
from core.jianying import JianyingGenerator
from config import settings

router = APIRouter(prefix="/api", tags=["export"])

export_tasks = {}

@router.post("/projects/{project_id}/export/jianying", response_model=ExportJianyingResponse)
async def export_jianying(project_id: str, request: ExportJianyingRequest):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    export_id = str(uuid.uuid4())

    try:
        proj_dir = Path(settings.data_dir) / "projects" / project_id
        export_dir = proj_dir / "export"
        export_dir.mkdir(exist_ok=True)

        generator = JianyingGenerator(project, export_dir)
        zip_path = generator.generate()

        export_tasks[export_id] = {
            "status": "ready",
            "zip_path": str(zip_path)
        }

        return ExportJianyingResponse(
            exportId=export_id,
            status="ready",
            downloadUrl=f"/api/projects/{project_id}/export/download?export_id={export_id}"
        )

    except Exception as e:
        return ExportJianyingResponse(
            exportId=export_id,
            status="failed",
            error=str(e)
        )

@router.get("/projects/{project_id}/export/download")
async def download_jianying(project_id: str, export_id: str):
    task = export_tasks.get(export_id)
    if not task or task["status"] != "ready":
        raise HTTPException(status_code=404, detail="Export not found")

    zip_path = Path(task["zip_path"])
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Export file not found")

    return FileResponse(
        path=zip_path,
        filename=f"jianying_draft_{project_id[:8]}.zip",
        media_type="application/zip"
    )
```

### Task 5.3: Update Main App to Include Export Router

- [ ] **Step 1: Update backend/main.py imports**

Ensure the routers are included:

```python
from api import projects, generation, export
```

And:

```python
app.include_router(export.router)
```

---

## Chunk 6: Frontend Scaffolding

**Files Created:**
- `novelcomic/frontend/package.json`
- `novelcomic/frontend/vite.config.js`
- `novelcomic/frontend/index.html`
- `novelcomic/frontend/tsconfig.json`
- `novelcomic/frontend/tsconfig.node.json`
- `novelcomic/frontend/tailwind.config.js`
- `novelcomic/frontend/postcss.config.js`
- `novelcomic/frontend/src/main.tsx`
- `novelcomic/frontend/src/index.css`
- `novelcomic/frontend/src/services/api.ts`

### Task 6.1: Create Frontend Configuration Files

- [ ] **Step 1: Create frontend/package.json**

```json
{
  "name": "novelcomic-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc &amp;&amp; vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "axios": "^1.6.5"
  },
  "devDependencies": {
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.11",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16"
  }
}
```

- [ ] **Step 2: Create frontend/vite.config.js**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/data': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
```

- [ ] **Step 3: Create frontend/index.html**

```html
&lt;!DOCTYPE html&gt;
&lt;html lang="zh-CN"&gt;
  &lt;head&gt;
    &lt;meta charset="UTF-8" /&gt;
    &lt;meta name="viewport" content="width=device-width, initial-scale=1.0" /&gt;
    &lt;title&gt;NovelComic - 小说推文 AI漫剧&lt;/title&gt;
  &lt;/head&gt;
  &lt;body&gt;
    &lt;div id="root"&gt;&lt;/div&gt;
    &lt;script type="module" src="/src/main.tsx"&gt;&lt;/script&gt;
  &lt;/body&gt;
&lt;/html&gt;
```

- [ ] **Step 4: Create frontend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: Create frontend/tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.js"]
}
```

- [ ] **Step 6: Create frontend/tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 7: Create frontend/postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### Task 6.2: Create Frontend API Service &amp; Entry Point

- [ ] **Step 1: Create frontend/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 2: Create frontend/src/services/api.ts**

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Character {
  id: string;
  name: string;
  description: string;
  characterPrompt: string;
  negativePrompt: string;
  referenceImages: string[];
  loraName?: string;
  loraWeight: number;
}

export interface MotionConfig {
  type: 'none' | 'pan_left' | 'pan_right' | 'pan_up' | 'pan_down' | 'zoom_in' | 'zoom_out';
  startScale: number;
  endScale: number;
  startX: number;
  endX: number;
  startY: number;
  endY: number;
}

export interface Storyboard {
  id: string;
  index: number;
  sceneDescription: string;
  dialogue: string;
  narration: string;
  characterIds: string[];
  imagePrompt: string;
  negativePrompt: string;
  imagePath?: string;
  imageStatus: 'pending' | 'generating' | 'completed' | 'failed';
  imageError?: string;
  audioPath?: string;
  audioDuration: number;
  audioStatus: 'pending' | 'generating' | 'completed' | 'failed';
  audioError?: string;
  motion: MotionConfig;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  sourceText: string;
  stylePrompt: string;
  negativePrompt: string;
  characters: Character[];
  storyboards: Storyboard[];
}

export interface ComfyUISettings {
  apiUrl: string;
  timeout: number;
  maxRetries: number;
  concurrentLimit: number;
}

export interface OllamaSettings {
  apiUrl: string;
  model: string;
  timeout: number;
  maxRetries: number;
  chunkSize: number;
}

export interface TTSSettings {
  azureKey?: string;
  azureRegion?: string;
  voice: string;
  rate: number;
  pitch: number;
  timeout: number;
  maxRetries: number;
  concurrentLimit: number;
}

export interface JianyingSettings {
  canvasWidth: number;
  canvasHeight: number;
  canvasRatio: string;
}

export interface GlobalSettings {
  comfyui: ComfyUISettings;
  ollama: OllamaSettings;
  tts: TTSSettings;
  jianying: JianyingSettings;
}

export const projectApi = {
  list: () =&gt; api.get&lt;any[]&gt;('/projects'),
  create: (name: string, sourceText?: string) =&gt;
    api.post&lt;Project&gt;('/projects', { name, sourceText }),
  get: (id: string) =&gt; api.get&lt;Project&gt;(`/projects/${id}`),
  update: (id: string, name: string, sourceText?: string) =&gt;
    api.put&lt;Project&gt;(`/projects/${id}`, { name, sourceText }),
  delete: (id: string) =&gt; api.delete(`/projects/${id}`),
};

export const characterApi = {
  extract: (projectId: string) =&gt;
    api.post(`/projects/${projectId}/characters/extract`),
  create: (projectId: string, character: Character) =&gt;
    api.post&lt;Character&gt;(`/projects/${projectId}/characters`, character),
  update: (projectId: string, charId: string, character: Character) =&gt;
    api.put&lt;Character&gt;(`/projects/${projectId}/characters/${charId}`, character),
  delete: (projectId: string, charId: string) =&gt;
    api.delete(`/projects/${projectId}/characters/${charId}`),
  uploadReference: (projectId: string, charId: string, file: File) =&gt; {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/projects/${projectId}/characters/${charId}/reference`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export const storyboardApi = {
  split: (projectId: string) =&gt;
    api.post(`/projects/${projectId}/storyboards/split`),
  list: (projectId: string) =&gt;
    api.get&lt;Storyboard[]&gt;(`/projects/${projectId}/storyboards`),
  update: (projectId: string, sbId: string, data: Partial&lt;Storyboard&gt;) =&gt;
    api.put&lt;Storyboard&gt;(`/projects/${projectId}/storyboards/${sbId}`, data),
  delete: (projectId: string, sbId: string) =&gt;
    api.delete(`/projects/${projectId}/storyboards/${sbId}`),
  reorder: (projectId: string, storyboardIds: string[]) =&gt;
    api.put(`/projects/${projectId}/storyboards/reorder`, { storyboardIds }),
};

export const generationApi = {
  generateImage: (projectId: string, storyboardId: string) =&gt;
    api.post(`/projects/${projectId}/generate/image`, null, {
      params: { storyboard_id: storyboardId }
    }),
  generateImages: (projectId: string, storyboardIds?: string[], forceRegenerate?: boolean) =&gt;
    api.post(`/projects/${projectId}/generate/images`, {
      storyboardIds,
      forceRegenerate
    }),
  generateAudio: (projectId: string, storyboardId: string) =&gt;
    api.post(`/projects/${projectId}/generate/audio`, null, {
      params: { storyboard_id: storyboardId }
    }),
  generateAudios: (projectId: string, storyboardIds?: string[], forceRegenerate?: boolean) =&gt;
    api.post(`/projects/${projectId}/generate/audios`, {
      storyboardIds,
      forceRegenerate
    }),
  getStatus: (projectId: string) =&gt;
    api.get(`/projects/${projectId}/generate/status`),
};

export const exportApi = {
  exportJianying: (projectId: string) =&gt;
    api.post(`/projects/${projectId}/export/jianying`, {}),
};

export const settingsApi = {
  get: () =&gt; api.get&lt;GlobalSettings&gt;('/settings'),
  update: (settings: GlobalSettings) =&gt;
    api.put&lt;GlobalSettings&gt;('/settings', settings),
};

export default api;
```

- [ ] **Step 3: Create frontend/src/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

const Dashboard = React.lazy(() =&gt; import('./pages/Dashboard'));
const ProjectEditor = React.lazy(() =&gt; import('./pages/ProjectEditor'));
const Settings = React.lazy(() =&gt; import('./pages/Settings'));

function App() {
  return (
    &lt;BrowserRouter&gt;
      &lt;div className="min-h-screen bg-gray-100"&gt;
        &lt;nav className="bg-white shadow-sm"&gt;
          &lt;div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"&gt;
            &lt;div className="flex justify-between h-16"&gt;
              &lt;div className="flex items-center"&gt;
                &lt;h1 className="text-xl font-bold text-gray-900"&gt;NovelComic&lt;/h1&gt;
              &lt;/div&gt;
              &lt;div className="flex items-center space-x-4"&gt;
                &lt;a href="/" className="text-gray-600 hover:text-gray-900"&gt;项目&lt;/a&gt;
                &lt;a href="/settings" className="text-gray-600 hover:text-gray-900"&gt;设置&lt;/a&gt;
              &lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        &lt;/nav&gt;
        &lt;main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8"&gt;
          &lt;React.Suspense fallback={&lt;div&gt;Loading...&lt;/div&gt;}&gt;
            &lt;Routes&gt;
              &lt;Route path="/" element={&lt;Dashboard /&gt;} /&gt;
              &lt;Route path="/project/:id" element={&lt;ProjectEditor /&gt;} /&gt;
              &lt;Route path="/settings" element={&lt;Settings /&gt;} /&gt;
            &lt;/Routes&gt;
          &lt;/React.Suspense&gt;
        &lt;/main&gt;
      &lt;/div&gt;
    &lt;/BrowserRouter&gt;
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  &lt;React.StrictMode&gt;
    &lt;App /&gt;
  &lt;/React.StrictMode&gt;
);
```

---

## Chunk 7: Frontend Pages &amp; Components

**Files Created:**
- `novelcomic/frontend/src/pages/Dashboard.tsx`
- `novelcomic/frontend/src/pages/Settings.tsx`
- `novelcomic/frontend/src/pages/ProjectEditor.tsx`

### Task 7.1: Create Dashboard Page

- [ ] **Step 1: Create frontend/src/pages/Dashboard.tsx**

```tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectApi, type Project } from '../services/api';

const Dashboard: React.FC = () =&gt; {
  const navigate = useNavigate();
  const [projects, setProjects] = useState&lt;any[]&gt;([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectText, setNewProjectText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() =&gt; {
    loadProjects();
  }, []);

  const loadProjects = async () =&gt; {
    try {
      const response = await projectApi.list();
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) =&gt; {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const response = await projectApi.create(newProjectName, newProjectText || undefined);
      navigate(`/project/${response.data.id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleDeleteProject = async (id: string) =&gt; {
    if (!confirm('确定要删除这个项目吗？')) return;
    try {
      await projectApi.delete(id);
      loadProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  if (loading) {
    return &lt;div&gt;加载中...&lt;/div&gt;;
  }

  return (
    &lt;div&gt;
      &lt;div className="flex justify-between items-center mb-6"&gt;
        &lt;h2 className="text-2xl font-bold"&gt;我的项目&lt;/h2&gt;
      &lt;/div&gt;

      &lt;div className="bg-white rounded-lg shadow p-6 mb-6"&gt;
        &lt;h3 className="text-lg font-semibold mb-4"&gt;创建新项目&lt;/h3&gt;
        &lt;form onSubmit={handleCreateProject} className="space-y-4"&gt;
          &lt;div&gt;
            &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;项目名称&lt;/label&gt;
            &lt;input
              type="text"
              value={newProjectName}
              onChange={(e) =&gt; setNewProjectName(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              placeholder="输入项目名称"
            /&gt;
          &lt;/div&gt;
          &lt;div&gt;
            &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;小说文本（可选）&lt;/label&gt;
            &lt;textarea
              value={newProjectText}
              onChange={(e) =&gt; setNewProjectText(e.target.value)}
              className="w-full border rounded-md px-3 py-2 h-32"
              placeholder="粘贴小说文本..."
            /&gt;
          &lt;/div&gt;
          &lt;button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          &gt;
            创建项目
          &lt;/button&gt;
        &lt;/form&gt;
      &lt;/div&gt;

      &lt;div className="grid gap-4"&gt;
        {projects.map((project) =&gt; (
          &lt;div key={project.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center"&gt;
            &lt;div&gt;
              &lt;h3 className="font-semibold"&gt;{project.name}&lt;/h3&gt;
              &lt;p className="text-sm text-gray-500"&gt;
                创建于: {new Date(project.createdAt).toLocaleDateString()}
              &lt;/p&gt;
            &lt;/div&gt;
            &lt;div className="flex space-x-2"&gt;
              &lt;button
                onClick={() =&gt; navigate(`/project/${project.id}`)}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
              &gt;
                编辑
              &lt;/button&gt;
              &lt;button
                onClick={() =&gt; handleDeleteProject(project.id)}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
              &gt;
                删除
              &lt;/button&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        ))}
        {projects.length === 0 &amp;&amp; (
          &lt;div className="text-center text-gray-500 py-8"&gt;
            还没有项目，创建一个吧！
          &lt;/div&gt;
        )}
      &lt;/div&gt;
    &lt;/div&gt;
  );
};

export default Dashboard;
```

### Task 7.2: Create Settings Page

- [ ] **Step 1: Create frontend/src/pages/Settings.tsx**

```tsx
import React, { useEffect, useState } from 'react';
import { settingsApi, type GlobalSettings } from '../services/api';

const Settings: React.FC = () =&gt; {
  const [settings, setSettings] = useState&lt;GlobalSettings&gt;({
    comfyui: { apiUrl: '', timeout: 300, maxRetries: 3, concurrentLimit: 3 },
    ollama: { apiUrl: '', model: 'llama3', timeout: 120, maxRetries: 2, chunkSize: 4000 },
    tts: { azureKey: '', azureRegion: '', voice: 'zh-CN-XiaoxiaoNeural', rate: 1.0, pitch: 0, timeout: 60, maxRetries: 3, concurrentLimit: 5 },
    jianying: { canvasWidth: 1920, canvasHeight: 1080, canvasRatio: '16:9' },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() =&gt; {
    loadSettings();
  }, []);

  const loadSettings = async () =&gt; {
    try {
      const response = await settingsApi.get();
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () =&gt; {
    setSaving(true);
    try {
      await settingsApi.update(settings);
      alert('设置已保存');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return &lt;div&gt;加载中...&lt;/div&gt;;
  }

  return (
    &lt;div&gt;
      &lt;div className="flex justify-between items-center mb-6"&gt;
        &lt;h2 className="text-2xl font-bold"&gt;设置&lt;/h2&gt;
        &lt;button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
        &gt;
          {saving ? '保存中...' : '保存设置'}
        &lt;/button&gt;
      &lt;/div&gt;

      &lt;div className="space-y-6"&gt;
        &lt;div className="bg-white rounded-lg shadow p-6"&gt;
          &lt;h3 className="text-lg font-semibold mb-4"&gt;ComfyUI 设置&lt;/h3&gt;
          &lt;div className="space-y-4"&gt;
            &lt;div&gt;
              &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;API 地址&lt;/label&gt;
              &lt;input
                type="text"
                value={settings.comfyui.apiUrl}
                onChange={(e) =&gt; setSettings({...settings, comfyui: {...settings.comfyui, apiUrl: e.target.value}})}
                className="w-full border rounded-md px-3 py-2"
                placeholder="http://localhost:8188"
              /&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        &lt;/div&gt;

        &lt;div className="bg-white rounded-lg shadow p-6"&gt;
          &lt;h3 className="text-lg font-semibold mb-4"&gt;Ollama 设置&lt;/h3&gt;
          &lt;div className="space-y-4"&gt;
            &lt;div&gt;
              &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;API 地址&lt;/label&gt;
              &lt;input
                type="text"
                value={settings.ollama.apiUrl}
                onChange={(e) =&gt; setSettings({...settings, ollama: {...settings.ollama, apiUrl: e.target.value}})}
                className="w-full border rounded-md px-3 py-2"
                placeholder="http://localhost:11434"
              /&gt;
            &lt;/div&gt;
            &lt;div&gt;
              &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;模型&lt;/label&gt;
              &lt;input
                type="text"
                value={settings.ollama.model}
                onChange={(e) =&gt; setSettings({...settings, ollama: {...settings.ollama, model: e.target.value}})}
                className="w-full border rounded-md px-3 py-2"
                placeholder="llama3"
              /&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        &lt;/div&gt;

        &lt;div className="bg-white rounded-lg shadow p-6"&gt;
          &lt;h3 className="text-lg font-semibold mb-4"&gt;微软 TTS 设置&lt;/h3&gt;
          &lt;div className="space-y-4"&gt;
            &lt;div&gt;
              &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;Subscription Key&lt;/label&gt;
              &lt;input
                type="password"
                value={settings.tts.azureKey || ''}
                onChange={(e) =&gt; setSettings({...settings, tts: {...settings.tts, azureKey: e.target.value}})}
                className="w-full border rounded-md px-3 py-2"
              /&gt;
            &lt;/div&gt;
            &lt;div&gt;
              &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;Region&lt;/label&gt;
              &lt;input
                type="text"
                value={settings.tts.azureRegion || ''}
                onChange={(e) =&gt; setSettings({...settings, tts: {...settings.tts, azureRegion: e.target.value}})}
                className="w-full border rounded-md px-3 py-2"
                placeholder="eastasia"
              /&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  );
};

export default Settings;
```

### Task 7.3: Create Project Editor Page

- [ ] **Step 1: Create frontend/src/pages/ProjectEditor.tsx**

```tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  projectApi,
  characterApi,
  storyboardApi,
  generationApi,
  exportApi,
  type Project,
  type Character,
  type Storyboard,
} from '../services/api';

const ProjectEditor: React.FC = () =&gt; {
  const { id } = useParams&lt;{ id: string }&gt;();
  const navigate = useNavigate();
  const [project, setProject] = useState&lt;Project | null&gt;(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  useEffect(() =&gt; {
    if (id) {
      loadProject();
    }
  }, [id]);

  useEffect(() =&gt; {
    if (polling &amp;&amp; id) {
      const interval = setInterval(() =&gt; {
        checkGenerationStatus();
      }, 2000);
      return () =&gt; clearInterval(interval);
    }
  }, [polling, id]);

  const loadProject = async () =&gt; {
    if (!id) return;
    try {
      const response = await projectApi.get(id);
      setProject(response.data);
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkGenerationStatus = async () =&gt; {
    if (!id) return;
    try {
      await loadProject();
    } catch (error) {
      console.error('Failed to check status:', error);
    }
  };

  const handleExtractCharacters = async () =&gt; {
    if (!id) return;
    try {
      await characterApi.extract(id);
      await loadProject();
    } catch (error) {
      console.error('Failed to extract characters:', error);
    }
  };

  const handleSplitStoryboard = async () =&gt; {
    if (!id) return;
    try {
      await storyboardApi.split(id);
      await loadProject();
    } catch (error) {
      console.error('Failed to split storyboard:', error);
    }
  };

  const handleGenerateImages = async () =&gt; {
    if (!id) return;
    try {
      await generationApi.generateImages(id);
      setPolling(true);
    } catch (error) {
      console.error('Failed to generate images:', error);
    }
  };

  const handleGenerateAudios = async () =&gt; {
    if (!id) return;
    try {
      await generationApi.generateAudios(id);
      setPolling(true);
    } catch (error) {
      console.error('Failed to generate audios:', error);
    }
  };

  const handleExportJianying = async () =&gt; {
    if (!id) return;
    try {
      const response = await exportApi.exportJianying(id);
      if (response.data.downloadUrl) {
        window.location.href = response.data.downloadUrl;
      }
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  const steps = [
    { name: '角色管理', onClick: () =&gt; setCurrentStep(0) },
    { name: '剧本拆分', onClick: () =&gt; setCurrentStep(1) },
    { name: '图片生成', onClick: () =&gt; setCurrentStep(2) },
    { name: '配音生成', onClick: () =&gt; setCurrentStep(3) },
    { name: '导出剪映', onClick: () =&gt; setCurrentStep(4) },
  ];

  if (loading) {
    return &lt;div&gt;加载中...&lt;/div&gt;;
  }

  if (!project) {
    return &lt;div&gt;项目未找到&lt;/div&gt;;
  }

  return (
    &lt;div&gt;
      &lt;div className="flex justify-between items-center mb-6"&gt;
        &lt;div&gt;
          &lt;button
            onClick={() =&gt; navigate('/')}
            className="text-blue-500 hover:text-blue-600 mr-4"
          &gt;
            ← 返回
          &lt;/button&gt;
          &lt;h2 className="text-2xl font-bold inline"&gt;{project.name}&lt;/h2&gt;
        &lt;/div&gt;
      &lt;/div&gt;

      &lt;div className="bg-white rounded-lg shadow mb-6"&gt;
        &lt;div className="flex border-b"&gt;
          {steps.map((step, index) =&gt; (
            &lt;button
              key={index}
              onClick={step.onClick}
              className={`px-6 py-4 font-medium ${
                currentStep === index
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            &gt;
              {step.name}
            &lt;/button&gt;
          ))}
        &lt;/div&gt;
      &lt;/div&gt;

      &lt;div className="bg-white rounded-lg shadow p-6"&gt;
        {currentStep === 0 &amp;&amp; (
          &lt;div&gt;
            &lt;div className="flex justify-between items-center mb-4"&gt;
              &lt;h3 className="text-lg font-semibold"&gt;角色列表&lt;/h3&gt;
              &lt;button
                onClick={handleExtractCharacters}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
              &gt;
                自动提取角色
              &lt;/button&gt;
            &lt;/div&gt;
            &lt;div className="space-y-4"&gt;
              {project.characters.map((char) =&gt; (
                &lt;div key={char.id} className="border rounded-lg p-4"&gt;
                  &lt;h4 className="font-semibold"&gt;{char.name}&lt;/h4&gt;
                  &lt;p className="text-sm text-gray-600"&gt;{char.description}&lt;/p&gt;
                &lt;/div&gt;
              ))}
              {project.characters.length === 0 &amp;&amp; (
                &lt;p className="text-gray-500"&gt;还没有角色，点击上方按钮自动提取&lt;/p&gt;
              )}
            &lt;/div&gt;
          &lt;/div&gt;
        )}

        {currentStep === 1 &amp;&amp; (
          &lt;div&gt;
            &lt;div className="flex justify-between items-center mb-4"&gt;
              &lt;h3 className="text-lg font-semibold"&gt;分镜列表 ({project.storyboards.length})&lt;/h3&gt;
              &lt;button
                onClick={handleSplitStoryboard}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
              &gt;
                自动拆分剧本
              &lt;/button&gt;
            &lt;/div&gt;
            &lt;div className="space-y-4 max-h-96 overflow-y-auto"&gt;
              {project.storyboards.map((sb) =&gt; (
                &lt;div key={sb.id} className="border rounded-lg p-4"&gt;
                  &lt;div className="flex justify-between"&gt;
                    &lt;span className="font-semibold"&gt;分镜 {sb.index + 1}&lt;/span&gt;
                  &lt;/div&gt;
                  &lt;p className="text-sm text-gray-600 mt-2"&gt;{sb.sceneDescription}&lt;/p&gt;
                  {sb.dialogue &amp;&amp; (
                    &lt;p className="text-sm text-blue-600 mt-1"&gt;台词: {sb.dialogue}&lt;/p&gt;
                  )}
                  {sb.narration &amp;&amp; (
                    &lt;p className="text-sm text-green-600 mt-1"&gt;旁白: {sb.narration}&lt;/p&gt;
                  )}
                &lt;/div&gt;
              ))}
              {project.storyboards.length === 0 &amp;&amp; (
                &lt;p className="text-gray-500"&gt;还没有分镜，点击上方按钮自动拆分&lt;/p&gt;
              )}
            &lt;/div&gt;
          &lt;/div&gt;
        )}

        {currentStep === 2 &amp;&amp; (
          &lt;div&gt;
            &lt;div className="flex justify-between items-center mb-4"&gt;
              &lt;h3 className="text-lg font-semibold"&gt;图片生成&lt;/h3&gt;
              &lt;button
                onClick={handleGenerateImages}
                disabled={polling}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
              &gt;
                {polling ? '生成中...' : '批量生成图片'}
              &lt;/button&gt;
            &lt;/div&gt;
            &lt;div className="grid grid-cols-4 gap-4"&gt;
              {project.storyboards.map((sb) =&gt; (
                &lt;div key={sb.id} className="border rounded-lg p-2"&gt;
                  &lt;div className="text-xs text-gray-500 mb-1"&gt;分镜 {sb.index + 1}&lt;/div&gt;
                  {sb.imageStatus === 'completed' &amp;&amp; sb.imagePath ? (
                    &lt;img
                      src={`/data/projects/${id}/${sb.imagePath}`}
                      alt=""
                      className="w-full h-32 object-cover rounded"
                    /&gt;
                  ) : (
                    &lt;div className="w-full h-32 bg-gray-100 rounded flex items-center justify-center"&gt;
                      &lt;span className="text-sm text-gray-400"&gt;
                        {sb.imageStatus === 'generating' ? '生成中...' :
                         sb.imageStatus === 'failed' ? '失败' : '待生成'}
                      &lt;/span&gt;
                    &lt;/div&gt;
                  )}
                &lt;/div&gt;
              ))}
            &lt;/div&gt;
          &lt;/div&gt;
        )}

        {currentStep === 3 &amp;&amp; (
          &lt;div&gt;
            &lt;div className="flex justify-between items-center mb-4"&gt;
              &lt;h3 className="text-lg font-semibold"&gt;配音生成&lt;/h3&gt;
              &lt;button
                onClick={handleGenerateAudios}
                disabled={polling}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
              &gt;
                {polling ? '生成中...' : '批量生成配音'}
              &lt;/button&gt;
            &lt;/div&gt;
            &lt;div className="space-y-2"&gt;
              {project.storyboards.map((sb) =&gt; (
                &lt;div key={sb.id} className="border rounded-lg p-3 flex justify-between items-center"&gt;
                  &lt;div&gt;
                    &lt;span className="font-medium"&gt;分镜 {sb.index + 1}&lt;/span&gt;
                    {sb.audioDuration &gt; 0 &amp;&amp; (
                      &lt;span className="text-sm text-gray-500 ml-2"&gt;
                        ({sb.audioDuration.toFixed(1)}秒)
                      &lt;/span&gt;
                    )}
                  &lt;/div&gt;
                  &lt;div&gt;
                    {sb.audioStatus === 'completed' &amp;&amp; sb.audioPath ? (
                      &lt;audio controls className="h-8"&gt;
                        &lt;source src={`/data/projects/${id}/${sb.audioPath}`} /&gt;
                      &lt;/audio&gt;
                    ) : (
                      &lt;span className="text-sm text-gray-400"&gt;
                        {sb.audioStatus === 'generating' ? '生成中...' :
                         sb.audioStatus === 'failed' ? '失败' : '待生成'}
                      &lt;/span&gt;
                    )}
                  &lt;/div&gt;
                &lt;/div&gt;
              ))}
            &lt;/div&gt;
          &lt;/div&gt;
        )}

        {currentStep === 4 &amp;&amp; (
          &lt;div&gt;
            &lt;h3 className="text-lg font-semibold mb-4"&gt;导出剪映草稿&lt;/h3&gt;
            &lt;p className="text-gray-600 mb-6"&gt;
              点击下方按钮导出剪映草稿 ZIP 文件，解压后用剪映打开即可编辑。
            &lt;/p&gt;
            &lt;button
              onClick={handleExportJianying}
              className="bg-green-500 text-white px-6 py-3 rounded-md hover:bg-green-600 text-lg"
            &gt;
              📥 导出剪映草稿
            &lt;/button&gt;
          &lt;/div&gt;
        )}
      &lt;/div&gt;
    &lt;/div&gt;
  );
};

export default ProjectEditor;
```

---

## Chunk 8: README &amp; Final Setup

**Files Created:**
- `novelcomic/README.md`
- `novelcomic/backend/.gitignore`

### Task 8.1: Create Project Documentation

- [ ] **Step 1: Create novelcomic/README.md**

```markdown
# NovelComic

小说推文 AI漫剧生成工具

## 功能特点

- 🎭 自动提取小说角色
- 📝 智能拆分剧本分镜
- 🎨 AI 图片生成 (ComfyUI)
- 🔊 AI 配音生成 (Microsoft TTS)
- ✂️ 一键导出剪映草稿

## 快速开始

### 前置要求

- Python 3.10+
- Node.js 18+
- ComfyUI (运行中)
- Ollama (运行中)
- Microsoft Azure TTS API Key (可选)

### 后端启动

```bash
cd novelcomic/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 配置 API 地址
python main.py
```

### 前端启动

```bash
cd novelcomic/frontend
npm install
npm run dev
```

### 访问应用

- 前端: http://localhost:5173
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs

## 配置说明

在运行前，请先配置以下 API 服务：

### ComfyUI

默认地址: `http://8.222.174.34:8188`

可以在应用的"设置"页面修改。

### Ollama

默认地址: `http://8.222.174.34:11434`

默认模型: `llama3`

可以在应用的"设置"页面修改。

### Microsoft TTS

需要配置:
- Subscription Key
- Region

可以在应用的"设置"页面配置。

## 使用流程

1. **创建项目** - 输入项目名称，粘贴小说文本
2. **角色管理** - 自动提取或手动添加角色
3. **剧本拆分** - 将小说拆分为多个分镜
4. **图片生成** - 批量生成漫剧画面
5. **配音生成** - 批量生成配音
6. **导出剪映** - 下载剪映草稿 ZIP 文件

## 项目结构

```
novelcomic/
├── backend/           # FastAPI 后端
│   ├── api/          # API 路由
│   ├── core/         # 核心业务逻辑
│   └── models/       # 数据模型
├── frontend/         # React 前端
│   ├── src/
│   │   ├── pages/    # 页面组件
│   │   └── services/ # API 客户端
└── data/             # 数据存储目录
    ├── config.json   # 全局设置
    └── projects/     # 项目数据
```

## 技术栈

**后端:**
- FastAPI
- Pydantic
- aiohttp

**前端:**
- React 18
- TypeScript
- Tailwind CSS
- Vite

**AI 服务:**
- ComfyUI (图片生成)
- Ollama (文本处理)
- Microsoft TTS (语音合成)

## 许可证

MIT
```

- [ ] **Step 2: Create novelcomic/backend/.gitignore**

```
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
ENV/
*.so
*.egg
*.egg-info/
dist/
build/
.env
data/
```

### Task 8.2: Final Setup Commands

- [ ] **Step 1: Run final setup**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
cp .env.example backend/.env
```

---

## Summary

This plan creates a complete NovelComic application with:

- **Chunk 1**: Backend foundation (config, models, FastAPI app with static file serving)
- **Chunk 2**: Project &amp; Settings API with file storage and character reference upload
- **Chunk 3**: AI clients (Ollama with long-text chunking, ComfyUI)
- **Chunk 4**: TTS client &amp; Generation API with concurrency control (semaphores)
- **Chunk 5**: Jianying draft export with corrected ZIP structure
- **Chunk 6**: Frontend scaffolding &amp; API service
- **Chunk 7**: Frontend pages (Dashboard, Settings, ProjectEditor with 5-step workflow)
- **Chunk 8**: Documentation &amp; setup files

All known issues from the review have been addressed:
- ✅ Static file serving for image/audio preview
- ✅ Concurrency control with semaphores
- ✅ Proper settings model with typed fields
- ✅ Long text chunking with overlap in Ollama client
- ✅ API endpoint parameter matching (query params)
- ✅ All imports fixed (BytesIO, etc.)
- ✅ Settings page properly loads/saves typed settings
- ✅ Correct ZIP structure (relative paths)
- ✅ Character reference image upload endpoints
- ✅ Storyboard motion check handles default case

