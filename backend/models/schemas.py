from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime
import uuid


class ProjectType(str, Enum):
    """项目类型"""
    NOVEL_COMIC = "novel_comic"
    DECOMPRESSION_VIDEO = "decompression_video"


class MotionType(str, Enum):
    NONE = "none"
    PAN_LEFT = "pan_left"
    PAN_RIGHT = "pan_right"
    PAN_UP = "pan_up"
    PAN_DOWN = "pan_down"
    ZOOM_IN = "zoom_in"
    ZOOM_OUT = "zoom_out"


class MotionConfig(BaseModel):
    type: MotionType = MotionType.NONE
    startScale: float = 1.0
    endScale: float = 1.0
    startX: float = 0.0
    endX: float = 0.0
    startY: float = 0.0
    endY: float = 0.0


class PromptType(str, Enum):
    CHARACTER_EXTRACTION = "character_extraction"
    STORYBOARD_SPLIT = "storyboard_split"
    IMAGE_PROMPT = "image_prompt"
    SCENE_EXTRACTION = "scene_extraction"


class PromptSnippetCategory(str, Enum):
    STYLE = "style"
    QUALITY = "quality"
    LIGHTING = "lighting"
    COMPOSITION = "composition"
    CUSTOM = "custom"


class GenerationStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SubtitleSegment(BaseModel):
    """字幕片段"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    index: int
    text: str
    startTime: float = 0.0
    endTime: float = 0.0


class TextSegment(BaseModel):
    """按行拆分的文本片段"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    index: int
    text: str


class AudioClip(BaseModel):
    """音频片段"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    index: int = 0
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
    # 上传的字幕文件
    subtitleFilePath: Optional[str] = None
    subtitleSegments: List[SubtitleSegment] = Field(default_factory=list)
    # 上传的音频文件（单文件或多个文件）
    uploadedAudioFiles: List[str] = Field(default_factory=list)
    # 图片生成取消标志
    imageGenerationCancelled: bool = False


class PromptVariable(BaseModel):
    name: str
    description: str
    example: str


class PromptTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    type: PromptType
    systemPrompt: str = ""
    userPrompt: str = ""
    isPreset: bool = False
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)


class PromptSnippet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    category: PromptSnippetCategory
    content: str
    isPreset: bool = False
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)


class ImagePromptTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    template: str
    snippetIds: List[str] = Field(default_factory=list)
    isPreset: bool = False
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)


class TTSConfig(BaseModel):
    """角色 TTS 配置"""
    voice: str = "zh-CN-XiaoxiaoNeural"
    rate: float = 1.0
    pitch: int = 0


class Character(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    characterPrompt: str = ""
    negativePrompt: str = ""
    referenceImages: List[str] = Field(default_factory=list)
    loraName: Optional[str] = None
    loraWeight: float = 0.8
    ttsConfig: Optional[TTSConfig] = None


class Scene(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)


class Storyboard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    index: int = 0
    sceneDescription: str = ""
    dialogue: str = ""
    narration: str = ""
    characterIds: List[str] = Field(default_factory=list)
    sceneId: Optional[str] = None
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
    ttsConfig: Optional[TTSConfig] = None  # 分镜独立音色配置


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
    type: ProjectType = ProjectType.NOVEL_COMIC
    sourceText: str = ""
    stylePrompt: str = ""
    negativePrompt: str = "bad anatomy, bad hands, blurry"
    useCustomPrompts: bool = False
    projectPromptTemplates: Dict[PromptType, str] = Field(default_factory=dict)
    generationProgress: GenerationProgress = Field(default_factory=GenerationProgress)
    characters: List[Character] = Field(default_factory=list)
    scenes: List[Scene] = Field(default_factory=list)
    storyboards: List[Storyboard] = Field(default_factory=list)
    decompressionData: Optional[DecompressionProjectData] = None
    # AI漫画项目的字幕和音频上传数据
    subtitleFilePath: Optional[str] = None
    subtitleSegments: List[SubtitleSegment] = Field(default_factory=list)
    uploadedAudioFiles: List[str] = Field(default_factory=list)


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


class ComfyUIWorkflowParams(BaseModel):
    """工作流默认参数配置"""
    # 尺寸参数
    width: int = 1280
    height: int = 960

    # 采样参数
    steps: int = 30
    cfg: float = 7.0
    samplerName: Optional[str] = None  # None = 使用工作流原值
    seed: int = 0  # 0 = 随机

    # 批次参数
    batchSize: int = 1

    # 提示词参数
    positivePromptPrefix: str = ""
    positivePromptSuffix: str = ""
    negativePromptOverride: Optional[str] = None  # None = 不覆盖


class ComfyUIWorkflow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    workflowJson: Dict[str, Any]
    nodeMappings: ComfyUINodeMappings = Field(default_factory=ComfyUINodeMappings)
    defaultParams: ComfyUIWorkflowParams = Field(default_factory=ComfyUIWorkflowParams)
    createdAt: datetime = Field(default_factory=datetime.now)


class ComfyUINodeInfo(BaseModel):
    id: str
    classType: str
    title: Optional[str] = None
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
    draftPath: str = ""
    capcutMatePath: str = ""


class GlobalSettings(BaseModel):
    defaultPromptTemplates: Dict[PromptType, str] = Field(default_factory=dict)
    comfyui: ComfyUISettings = Field(default_factory=ComfyUISettings)
    llm: LLMSettings = Field(default_factory=LLMSettings)
    ollama: OllamaSettings = Field(default_factory=OllamaSettings)  # Keep for backwards compatibility
    tts: TTSSettings = Field(default_factory=TTSSettings)
    jianying: JianyingSettings = Field(default_factory=JianyingSettings)
    decompressionVideoPath: str = "/Users/wyf-mac/Documents/小说推文/视频"
    stylePromptsPath: str = ""


# Request schemas
class CreateComfyUIWorkflowRequest(BaseModel):
    name: str
    workflowJson: Dict[str, Any]


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    sourceText: Optional[str] = None
    stylePrompt: Optional[str] = None
    negativePrompt: Optional[str] = None
    projectPromptTemplates: Optional[Dict[PromptType, str]] = None


class UpdateComfyUIWorkflowRequest(BaseModel):
    name: Optional[str] = None
    nodeMappings: Optional[ComfyUINodeMappings] = None
    defaultParams: Optional[ComfyUIWorkflowParams] = None


class SetActiveWorkflowRequest(BaseModel):
    workflowId: str


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


class UpdateDecompressionDataRequest(BaseModel):
    selectedStyle: Optional[str] = None


class UpdateStoryboardRequest(BaseModel):
    index: Optional[int] = None
    sceneDescription: Optional[str] = None
    dialogue: Optional[str] = None
    narration: Optional[str] = None
    characterIds: Optional[List[str]] = None
    sceneId: Optional[str] = None
    imagePrompt: Optional[str] = None
    negativePrompt: Optional[str] = None
    motion: Optional[MotionConfig] = None
    ttsConfig: Optional[TTSConfig] = None


class ReorderStoryboardsRequest(BaseModel):
    storyboardIds: List[str]


class GenerateImagesRequest(BaseModel):
    storyboardIds: Optional[List[str]] = None
    forceRegenerate: bool = False


class GenerateAudiosRequest(BaseModel):
    storyboardIds: Optional[List[str]] = None
    forceRegenerate: bool = False


class SplitStoryboardRequest(BaseModel):
    lines_per_storyboard: int = Field(1, ge=1, le=3, description="每个分镜包含的行数(1-3)")


class GeneratePromptsRequest(BaseModel):
    storyboardIds: Optional[List[str]] = None


class GeneratePromptsResponse(BaseModel):
    success: bool
    updated: int


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
    draftPath: Optional[str] = None
    error: Optional[str] = None


# ===== Image Prompt Request/Response Schemas =====
class CreatePromptSnippetRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    category: PromptSnippetCategory
    content: str


class UpdatePromptSnippetRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    category: Optional[PromptSnippetCategory] = None
    content: Optional[str] = None


class CreateImagePromptTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    template: str
    snippetIds: List[str] = Field(default_factory=list)


class UpdateImagePromptTemplateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    template: Optional[str] = None
    snippetIds: Optional[List[str]] = None


class DuplicateRequest(BaseModel):
    newName: str = Field(..., min_length=1, max_length=100)


class RenderImagePromptRequest(BaseModel):
    scene: Optional[str] = None
    characterPrompts: Optional[str] = None
    stylePrompt: Optional[str] = None
    custom: Optional[str] = None
    additionalSnippets: Optional[List[str]] = None


class RenderImagePromptResponse(BaseModel):
    renderedPrompt: str


# ===== Style Prompt Request/Response Schemas =====
class StylePromptList(BaseModel):
    styleName: str
    fileName: str
    prompts: List[str]


class CreateStyleRequest(BaseModel):
    styleName: str = Field(..., min_length=1, max_length=100)


class RenameStyleRequest(BaseModel):
    newStyleName: str = Field(..., min_length=1, max_length=100)


class AddPromptRequest(BaseModel):
    prompt: str = Field(..., min_length=1)


class UpdatePromptRequest(BaseModel):
    prompt: str = Field(..., min_length=1)


class BatchAppendPromptsRequest(BaseModel):
    prompts: List[str]


class ParaphraseRequest(BaseModel):
    originalPrompt: str = Field(..., min_length=1)
    count: int = Field(..., ge=1, le=20)
    requirement: str = ""


class ParaphraseResponse(BaseModel):
    generatedPrompts: List[str]


class TestImageRequest(BaseModel):
    prompt: str = Field(..., min_length=1)


class TestImageResponse(BaseModel):
    filename: str


# ===== Draft Adjustment Schemas =====
class TextStyleConfig(BaseModel):
    """文本样式配置"""
    fontSize: float = 24.0
    fontFamily: str = "新青年体"
    fontColor: str = "#ffd9e8"
    strokeColor: Optional[str] = "#ff619d"
    strokeWidth: float = 0.08
    alpha: float = 1.0
    positionX: float = 0.0
    positionY: float = 0.87
    align: int = 1  # 0=左, 1=中, 2=右


class WatermarkStyleConfig(TextStyleConfig):
    """水印样式配置（继承自文本样式）"""
    fontSize: float = 15.0
    fontColor: str = "#ffffff"
    strokeColor: Optional[str] = None
    strokeWidth: float = 0.0
    alpha: float = 0.2078
    # 关键帧起始位置
    startPositionX: float = -0.552795
    startPositionY: float = 0.874126
    # 关键帧结束位置
    endPositionX: float = 0.596435
    endPositionY: float = -0.930708


class DraftAdjustmentConfig(BaseModel):
    """草稿调整配置"""
    # 封面
    coverImagePath: Optional[str] = None
    coverDuration: float = 3.0  # 秒

    # 封面标题
    coverTitleEnabled: bool = False
    coverTitle: str = ""
    coverTitleStyle: TextStyleConfig = Field(default_factory=TextStyleConfig)

    # 文本
    textEnabled: bool = False
    textContent: str = ""
    textStyle: TextStyleConfig = Field(default_factory=lambda: TextStyleConfig(
        fontSize=15.0,
        fontColor="#ffffff",
        strokeColor=None,
        strokeWidth=0.0,
        positionY=0.0
    ))

    # 水印
    watermarkEnabled: bool = False
    watermarkText: str = ""
    watermarkStyle: WatermarkStyleConfig = Field(default_factory=WatermarkStyleConfig)

    # 配乐
    bgMusicEnabled: bool = False
    bgMusicPath: Optional[str] = None
    bgMusicVolume: float = 0.03162277660168379  # -30dB
    bgMusicFadeInDuration: float = 1.0  # 秒
    bgMusicFadeOutDuration: float = 1.0  # 秒


class LoadDraftRequest(BaseModel):
    draftPath: str


class LoadDraftResponse(BaseModel):
    success: bool
    draftName: str
    duration: float  # 秒
    trackCount: int
    error: Optional[str] = None


class ApplyDraftAdjustmentRequest(BaseModel):
    draftPath: str
    config: DraftAdjustmentConfig


class ApplyDraftAdjustmentResponse(BaseModel):
    success: bool
    message: str
    error: Optional[str] = None
