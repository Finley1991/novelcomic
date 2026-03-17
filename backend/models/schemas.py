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

class ComfyUINodeMappings(BaseModel):
    # 提示词相关
    positivePromptNodeId: Optional[str] = None
    positivePromptField: str = "text"

    negativePromptNodeId: Optional[str] = None
    negativePromptField: str = "text"

    # 尺寸相关
    widthNodeId: Optional[str] = None
    widthField: str = "width"

    heightNodeId: Optional[str] = None
    heightField: str = "height"

    # 采样相关
    samplerNodeId: Optional[str] = None
    samplerField: str = "sampler_name"
    stepsField: str = "steps"
    cfgField: str = "cfg"
    seedField: str = "seed"

    # 批次相关
    batchNodeId: Optional[str] = None
    batchSizeField: str = "batch_size"

class ComfyUIWorkflow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    workflowJson: Dict[str, Any]
    nodeMappings: ComfyUINodeMappings = Field(default_factory=ComfyUINodeMappings)
    createdAt: datetime = Field(default_factory=datetime.now)

class ComfyUINodeInfo(BaseModel):
    id: str
    classType: str
    title: Optional[str]
    fields: List[str]

class ComfyUISettings(BaseModel):
    apiUrl: str = "http://8.222.174.34:8188"
    timeout: int = 300
    maxRetries: int = 3
    concurrentLimit: int = 3
    activeWorkflowId: Optional[str] = None

class LLMProvider(str, Enum):
    OLLAMA = "ollama"
    OPENAI = "openai"

class OllamaSettings(BaseModel):
    apiUrl: str = "http://8.222.174.34:11434"
    model: str = "llama3"
    timeout: int = 120
    maxRetries: int = 2
    chunkSize: int = 4000

class OpenAISettings(BaseModel):
    apiKey: str = ""
    baseUrl: str = "https://api.openai.com/v1"
    model: str = "gpt-4o"
    timeout: int = 120
    maxRetries: int = 2
    chunkSize: int = 4000
    proxy: str = ""

class LLMSettings(BaseModel):
    provider: LLMProvider = LLMProvider.OLLAMA
    ollama: OllamaSettings = Field(default_factory=OllamaSettings)
    openai: OpenAISettings = Field(default_factory=OpenAISettings)

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
    llm: LLMSettings = Field(default_factory=LLMSettings)
    ollama: OllamaSettings = Field(default_factory=OllamaSettings)  # Keep for backwards compatibility
    tts: TTSSettings = Field(default_factory=TTSSettings)
    jianying: JianyingSettings = Field(default_factory=JianyingSettings)

# Request schemas
class CreateComfyUIWorkflowRequest(BaseModel):
    name: str
    workflowJson: Dict[str, Any]

class UpdateComfyUIWorkflowRequest(BaseModel):
    name: Optional[str] = None
    nodeMappings: Optional[ComfyUINodeMappings] = None

class SetActiveWorkflowRequest(BaseModel):
    workflowId: str

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
