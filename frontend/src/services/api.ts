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

export interface ComfyUIWorkflow {
  id: string;
  name: string;
  workflowJson: Record<string, any>;
  nodeMappings: ComfyUINodeMappings;
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
}

export interface GlobalSettings {
  comfyui: ComfyUISettings;
  llm: LLMSettings;
  ollama: OllamaSettings;
  tts: TTSSettings;
  jianying: JianyingSettings;
}

export const projectApi = {
  list: () => api.get<any[]>('/projects'),
  create: (name: string, sourceText?: string) =>
    api.post<Project>('/projects', { name, sourceText }),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  update: (id: string, name: string, sourceText?: string) =>
    api.put<Project>(`/projects/${id}`, { name, sourceText }),
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

export const storyboardApi = {
  split: (projectId: string) =>
    api.post(`/projects/${projectId}/storyboards/split`),
  list: (projectId: string) =>
    api.get<Storyboard[]>(`/projects/${projectId}/storyboards`),
  update: (projectId: string, sbId: string, data: Partial<Storyboard>) =>
    api.put<Storyboard>(`/projects/${projectId}/storyboards/${sbId}`, data),
  delete: (projectId: string, sbId: string) =>
    api.delete(`/projects/${projectId}/storyboards/${sbId}`),
  reorder: (projectId: string, storyboardIds: string[]) =>
    api.put(`/projects/${projectId}/storyboards/reorder`, { storyboardIds }),
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
  exportJianying: (projectId: string) =>
    api.post(`/projects/${projectId}/export/jianying`, {}),
};

export const settingsApi = {
  get: () => api.get<GlobalSettings>('/settings'),
  update: (settings: GlobalSettings) =>
    api.put<GlobalSettings>('/settings', settings),
  testLLM: () => api.post('/settings/llm/test'),
};

export const comfyuiWorkflowApi = {
  list: () => api.get<ComfyUIWorkflow[]>('/comfyui/workflows'),
  create: (name: string, workflowJson: Record<string, any>) =>
    api.post<ComfyUIWorkflow>('/comfyui/workflows', { name, workflowJson }),
  get: (id: string) => api.get<ComfyUIWorkflow>(`/comfyui/workflows/${id}`),
  update: (id: string, data: { name?: string; nodeMappings?: Partial<ComfyUINodeMappings> }) =>
    api.put<ComfyUIWorkflow>(`/comfyui/workflows/${id}`, data),
  delete: (id: string) => api.delete(`/comfyui/workflows/${id}`),
  parse: (id: string) => api.post<{ nodes: ComfyUINodeInfo[] }>(`/comfyui/workflows/${id}/parse`),
  setActive: (workflowId: string) => api.put<GlobalSettings>('/comfyui/active-workflow', { workflowId }),
};

export default api;
