import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Scene {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  characterPrompt: string;
  negativePrompt: string;
  referenceImages: string[];
  loraName?: string;
  loraWeight: number;
  ttsConfig?: TTSConfig;
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

export interface TTSConfig {
  voice: string;
  rate: number;
  pitch: number;
}

export interface Storyboard {
  id: string;
  index: number;
  sceneDescription: string;
  dialogue: string;
  narration: string;
  characterIds: string[];
  sceneId?: string;
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
  ttsConfig?: TTSConfig;  // 分镜独立音色配置
}

export type PromptType = 'character_extraction' | 'storyboard_split' | 'image_prompt' | 'scene_extraction';

export type PromptSnippetCategory = 'style' | 'quality' | 'lighting' | 'composition' | 'custom';

export type ProjectType = 'novel_comic' | 'decompression_video';

export type GenerationStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface SubtitleSegment {
  id: string;
  index: number;
  text: string;
  startTime: number;
  endTime: number;
}

export interface TextSegment {
  id: string;
  index: number;
  text: string;
}

export interface AudioClip {
  id: string;
  index: number;
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
  subtitleFilePath?: string;
  subtitleSegments: SubtitleSegment[];
  uploadedAudioFiles: string[];
}

export interface PromptSnippet {
  id: string;
  name: string;
  description: string;
  category: PromptSnippetCategory;
  content: string;
  isPreset: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ImagePromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  snippetIds: string[];
  isPreset: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RenderImagePromptRequest {
  scene?: string;
  characterPrompts?: string;
  stylePrompt?: string;
  custom?: string;
  additionalSnippets?: string[];
}

export interface RenderImagePromptResponse {
  renderedPrompt: string;
}

export interface PromptVariable {
  name: string;
  description: string;
  example: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  type: PromptType;
  systemPrompt: string;
  userPrompt: string;
  isPreset: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationProgress {
  imagesCompleted: number;
  imagesTotal: number;
  audioCompleted: number;
  audioTotal: number;
  lastSavedAt?: string;
}

export interface GenerationStatusItem {
  completed: number;
  total: number;
  inProgress: string[];
  failed: Array<{ id: string; error?: string }>;
}

export interface GenerationStatusResponse {
  images: GenerationStatusItem;
  audio: GenerationStatusItem;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  type: ProjectType;
  sourceText: string;
  stylePrompt: string;
  negativePrompt: string;
  useCustomPrompts: boolean;
  projectPromptTemplates: Partial<Record<PromptType, string>>;
  generationProgress: GenerationProgress;
  characters: Character[];
  scenes: Scene[];
  storyboards: Storyboard[];
  decompressionData?: DecompressionProjectData;
}

export interface ComfyUINodeInfo {
  id: string;
  classType: string;
  title?: string;
  fields: string[];
}

export interface ComfyUINodeMappings {
  positivePromptNodeId?: string;
  positivePromptField: string;
  negativePromptNodeId?: string;
  negativePromptField: string;
  widthNodeId?: string;
  widthField: string;
  heightNodeId?: string;
  heightField: string;
  samplerNodeId?: string;
  samplerField: string;
  stepsField: string;
  cfgField: string;
  seedField: string;
  batchNodeId?: string;
  batchSizeField: string;
}

export interface ComfyUIWorkflowParams {
  width: number;
  height: number;
  steps: number;
  cfg: number;
  samplerName?: string | null;
  seed: number;
  batchSize: number;
  positivePromptPrefix: string;
  positivePromptSuffix: string;
  negativePromptOverride?: string | null;
}

export interface ComfyUIWorkflow {
  id: string;
  name: string;
  workflowJson: Record<string, any>;
  nodeMappings: ComfyUINodeMappings;
  defaultParams: ComfyUIWorkflowParams;
  createdAt: string;
}

export interface ComfyUISettings {
  apiUrl: string;
  timeout: number;
  maxRetries: number;
  concurrentLimit: number;
  activeWorkflowId?: string;
}

export interface OllamaSettings {
  apiUrl: string;
  model: string;
  timeout: number;
  maxRetries: number;
  chunkSize: number;
}

export interface OpenAISettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeout: number;
  maxRetries: number;
  chunkSize: number;
  proxy: string;
}

export interface LLMSettings {
  provider: 'ollama' | 'openai';
  ollama: OllamaSettings;
  openai: OpenAISettings;
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
  draftPath: string;
}

export interface GlobalSettings {
  defaultPromptTemplates: Partial<Record<PromptType, string>>;
  comfyui: ComfyUISettings;
  llm: LLMSettings;
  ollama: OllamaSettings;
  tts: TTSSettings;
  jianying: JianyingSettings;
  decompressionVideoPath?: string;
  stylePromptsPath?: string;
}

export interface ExportJianyingRequest {
  canvasWidth?: number;
  canvasHeight?: number;
  fps?: number;
}

export interface ExportJianyingResponse {
  exportId: string;
  status: string;
  draftPath?: string;
  error?: string;
}

export interface SplitStoryboardRequest {
  lines_per_storyboard: number;
}

export interface GeneratePromptsRequest {
  storyboardIds?: string[];
}

export interface GeneratePromptsResponse {
  success: boolean;
  updated: number;
}

export interface CreateProjectRequest {
  name: string;
  sourceText?: string;
  type?: ProjectType;
}

export interface UpdateProjectRequest {
  name?: string;
  sourceText?: string;
  stylePrompt?: string;
  negativePrompt?: string;
  projectPromptTemplates?: Partial<Record<PromptType, string>>;
}

export const projectApi = {
  list: () => api.get<any[]>('/projects'),
  create: (name: string, sourceText?: string, type?: ProjectType) =>
    api.post<Project>('/projects', { name, sourceText, type }),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  update: (id: string, data: UpdateProjectRequest) =>
    api.put<Project>(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

export const characterApi = {
  extract: (projectId: string) =>
    api.post(`/projects/${projectId}/characters/extract`),
  create: (projectId: string, character: Character) =>
    api.post<Character>(`/projects/${projectId}/characters`, character),
  update: (projectId: string, charId: string, character: Character) =>
    api.put<Character>(`/projects/${projectId}/characters/${charId}`, character),
  delete: (projectId: string, charId: string) =>
    api.delete(`/projects/${projectId}/characters/${charId}`),
  uploadReference: (projectId: string, charId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/projects/${projectId}/characters/${charId}/reference`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export const sceneApi = {
  extract: (projectId: string) =>
    api.post(`/projects/${projectId}/scenes/extract`),
  list: (projectId: string) =>
    api.get<Scene[]>(`/projects/${projectId}/scenes`),
  update: (projectId: string, sceneId: string, data: Partial<Scene>) =>
    api.put<Scene>(`/projects/${projectId}/scenes/${sceneId}`, data),
  delete: (projectId: string, sceneId: string) =>
    api.delete(`/projects/${projectId}/scenes/${sceneId}`),
};

export const storyboardApi = {
  split: (projectId: string, linesPerStoryboard?: number) =>
    api.post(`/projects/${projectId}/storyboards/split`, {
      lines_per_storyboard: linesPerStoryboard || 1
    }),
  list: (projectId: string) =>
    api.get<Storyboard[]>(`/projects/${projectId}/storyboards`),
  update: (projectId: string, sbId: string, data: Partial<Storyboard>) =>
    api.put<Storyboard>(`/projects/${projectId}/storyboards/${sbId}`, data),
  delete: (projectId: string, sbId: string) =>
    api.delete(`/projects/${projectId}/storyboards/${sbId}`),
  reorder: (projectId: string, storyboardIds: string[]) =>
    api.put(`/projects/${projectId}/storyboards/reorder`, { storyboardIds }),
  generatePrompts: (projectId: string, storyboardIds?: string[]) =>
    api.post<GeneratePromptsResponse>(`/projects/${projectId}/storyboards/generate-prompts`, {
      storyboardIds
    }),
};

export const generationApi = {
  generateImage: (projectId: string, storyboardId: string) =>
    api.post(`/projects/${projectId}/generate/image`, null, {
      params: { storyboard_id: storyboardId }
    }),
  generateImages: (projectId: string, storyboardIds?: string[], forceRegenerate?: boolean) =>
    api.post(`/projects/${projectId}/generate/images`, {
      storyboardIds,
      forceRegenerate
    }),
  generateAudio: (projectId: string, storyboardId: string) =>
    api.post(`/projects/${projectId}/generate/audio`, null, {
      params: { storyboard_id: storyboardId }
    }),
  generateAudios: (projectId: string, storyboardIds?: string[], forceRegenerate?: boolean) =>
    api.post(`/projects/${projectId}/generate/audios`, {
      storyboardIds,
      forceRegenerate
    }),
  getStatus: (projectId: string) =>
    api.get(`/projects/${projectId}/generate/status`),
};

export const exportApi = {
  exportJianying: (projectId: string, request?: ExportJianyingRequest) =>
    api.post<ExportJianyingResponse>(`/projects/${projectId}/export/jianying`, request || {}),
};

export const settingsApi = {
  get: () => api.get<GlobalSettings>('/settings'),
  update: (settings: GlobalSettings) =>
    api.put<GlobalSettings>('/settings', settings),
  testLLM: () => api.post('/settings/llm/test'),
  testTTS: () => api.post('/settings/tts/test'),
};

export const comfyuiWorkflowApi = {
  list: () => api.get<ComfyUIWorkflow[]>('/comfyui/workflows'),
  create: (name: string, workflowJson: Record<string, any>) =>
    api.post<ComfyUIWorkflow>('/comfyui/workflows', { name, workflowJson }),
  get: (id: string) => api.get<ComfyUIWorkflow>(`/comfyui/workflows/${id}`),
  update: (id: string, data: { name?: string; nodeMappings?: Partial<ComfyUINodeMappings>; defaultParams?: Partial<ComfyUIWorkflowParams> }) =>
    api.put<ComfyUIWorkflow>(`/comfyui/workflows/${id}`, data),
  delete: (id: string) => api.delete(`/comfyui/workflows/${id}`),
  parse: (id: string) => api.post<{ nodes: ComfyUINodeInfo[] }>(`/comfyui/workflows/${id}/parse`),
  setActive: (workflowId: string) => api.put<GlobalSettings>('/comfyui/active-workflow', { workflowId }),
};

export const promptApi = {
  listTemplates: (type?: PromptType) => api.get<PromptTemplate[]>(
    `/prompts/templates${type ? `?type=${type}` : ''}`
  ),
  getTemplate: (id: string) => api.get<PromptTemplate>(`/prompts/templates/${id}`),
  createTemplate: (data: Partial<PromptTemplate>) => api.post<PromptTemplate>('/prompts/templates', data),
  updateTemplate: (id: string, data: Partial<PromptTemplate>) => api.put<PromptTemplate>(`/prompts/templates/${id}`, data),
  deleteTemplate: (id: string, cascade?: boolean) => api.delete(
    `/prompts/templates/${id}${cascade ? '?cascade=true' : ''}`
  ),
  duplicateTemplate: (id: string, newName: string) => api.post<PromptTemplate>(
    `/prompts/templates/${id}/duplicate`,
    { newName }
  ),
  getVariables: (type: PromptType) => api.get<PromptVariable[]>(`/prompts/variables?type=${type}`),
};

export const imagePromptApi = {
  // Snippet APIs
  listSnippets: (category?: PromptSnippetCategory) => api.get<PromptSnippet[]>(
    `/image-prompts/snippets${category ? `?category=${category}` : ''}`
  ),
  getSnippet: (id: string) => api.get<PromptSnippet>(`/image-prompts/snippets/${id}`),
  createSnippet: (data: { name: string; description: string; category: PromptSnippetCategory; content: string }) =>
    api.post<PromptSnippet>('/image-prompts/snippets', data),
  updateSnippet: (id: string, data: Partial<PromptSnippet>) =>
    api.put<PromptSnippet>(`/image-prompts/snippets/${id}`, data),
  deleteSnippet: (id: string) => api.delete(`/image-prompts/snippets/${id}`),
  duplicateSnippet: (id: string, newName: string) =>
    api.post<PromptSnippet>(`/image-prompts/snippets/${id}/duplicate`, { newName }),

  // Template APIs
  listTemplates: () => api.get<ImagePromptTemplate[]>('/image-prompts/templates'),
  getTemplate: (id: string) => api.get<ImagePromptTemplate>(`/image-prompts/templates/${id}`),
  createTemplate: (data: { name: string; description: string; template: string; snippetIds: string[] }) =>
    api.post<ImagePromptTemplate>('/image-prompts/templates', data),
  updateTemplate: (id: string, data: Partial<ImagePromptTemplate>) =>
    api.put<ImagePromptTemplate>(`/image-prompts/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/image-prompts/templates/${id}`),
  duplicateTemplate: (id: string, newName: string) =>
    api.post<ImagePromptTemplate>(`/image-prompts/templates/${id}/duplicate`, { newName }),
  renderTemplate: (id: string, data: RenderImagePromptRequest) =>
    api.post<RenderImagePromptResponse>(`/image-prompts/templates/${id}/render`, data),
};

// 解压视频 API
export const decompressionApi = {
  listVideos: () => api.get<{ filePath: string; fileName: string; duration: number }[]>('/decompression/videos'),
  scanVideos: () => api.post<{ filePath: string; fileName: string; duration: number }[]>('/decompression/videos/scan'),
  listStyles: () => api.get<string[]>('/decompression/styles'),
  getStylePrompts: (styleName: string) => api.get<string[]>(`/decompression/styles/${styleName}/prompts`),
  scanStyles: () => api.post<string[]>('/decompression/styles/scan'),
  updateData: (projectId: string, data: { selectedStyle?: string }) =>
    api.put<Project>(`/decompression/projects/${projectId}/data`, data),
  splitText: (projectId: string) => api.post(`/decompression/projects/${projectId}/split-text`, {}),
  generateAudio: (projectId: string) => api.post(`/decompression/projects/${projectId}/generate-audio`, {}),
  selectVideos: (projectId: string) => api.post(`/decompression/projects/${projectId}/select-videos`, {}),
  generateImages: (projectId: string, forceRegenerate?: boolean) => api.post(`/decompression/projects/${projectId}/generate-images`, { forceRegenerate }),
  exportJianying: (projectId: string, params?: { canvasWidth?: number; canvasHeight?: number; fps?: number }) =>
    api.post(`/decompression/projects/${projectId}/export-jianying`, params || {}),
  // 上传字幕
  uploadSubtitle: (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/decompression/projects/${projectId}/upload-subtitle`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  deleteSubtitle: (projectId: string) => api.delete(`/decompression/projects/${projectId}/subtitle`),
  // 上传音频
  uploadAudio: (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/decompression/projects/${projectId}/upload-audio`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  uploadAudios: (projectId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return api.post(`/decompression/projects/${projectId}/upload-audios`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  deleteUploadedAudios: (projectId: string) => api.delete(`/decompression/projects/${projectId}/audios`),
};

export default api;
