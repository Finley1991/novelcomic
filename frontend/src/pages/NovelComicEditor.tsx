import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  projectApi,
  characterApi,
  storyboardApi,
  generationApi,
  promptApi,
  imagePromptApi,
  exportApi,
  sceneApi,
  stylePromptsApi,
  type Project,
  type PromptTemplate,
  type PromptType,
  type ImagePromptTemplate,
  type Character,
  type Scene,
} from '../services/api';
import { TTS_VOICES } from '../constants/ttsVoices';
import { WizardSteps, wizardStepDefinitions, type WizardStep } from '../components/project/WizardSteps';
import { ProjectPromptManager } from '../components/ProjectPromptManager';
import { useToast } from '../hooks/useToast';

interface NovelComicEditorProps {
  project: Project;
  onProjectUpdate: (project: Project) => void;
}

const NovelComicEditor: React.FC<NovelComicEditorProps> = ({ project: initialProject, onProjectUpdate }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [project, setProject] = useState<Project>(initialProject);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [savingProjectSettings, setSavingProjectSettings] = useState(false);
  const [linesPerStoryboard, setLinesPerStoryboard] = useState(1);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<{ [key: string]: string }>({});
  const [savingPrompt, setSavingPrompt] = useState<string | null>(null);
  const [imagePromptTemplates, setImagePromptTemplates] = useState<ImagePromptTemplate[]>([]);
  const [exportingJianying, setExportingJianying] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savingCharacterTts, setSavingCharacterTts] = useState<string | null>(null);
  const [tempCharacterTts, setTempCharacterTts] = useState<{ [charId: string]: Character['ttsConfig'] }>({});
  const [bulkVoice, setBulkVoice] = useState<string>('');
  const [extractingCharacters, setExtractingCharacters] = useState(false);
  const [extractingScenes, setExtractingScenes] = useState(false);
  const [tempScene, setTempScene] = useState<{ [sceneId: string]: Partial<Scene> }>({});
  const [savingScene, setSavingScene] = useState<string | null>(null);
  const [splittingStoryboards, setSplittingStoryboards] = useState(false);
  const [splitProgress, setSplitProgress] = useState(0);
  const [splitStatusText, setSplitStatusText] = useState('');
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<{
    images?: { completed: number; total: number };
    audio?: { completed: number; total: number };
  } | null>(null);
  // 上传相关状态
  const [uploadingSubtitle, setUploadingSubtitle] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const subtitleFileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  // 本地文本状态，避免每次输入都调用 API
  const [localSourceText, setLocalSourceText] = useState('');
  // 项目提示词管理状态
  const [showProjectPromptManager, setShowProjectPromptManager] = useState(false);
  const [projectPromptManagerType, setProjectPromptManagerType] = useState<PromptType>('character_extraction');
  // 角色编辑状态
  const [tempCharacter, setTempCharacter] = useState<{ [charId: string]: Partial<Character> }>({});
  const [savingCharacter, setSavingCharacter] = useState<string | null>(null);
  // 角色测试生图状态
  const [showCharacterTestImage, setShowCharacterTestImage] = useState<string | null>(null);
  const [characterTestImagePrompt, setCharacterTestImagePrompt] = useState('');
  const [characterTestImageUrl, setCharacterTestImageUrl] = useState<string | null>(null);
  const [characterTestImageLoading, setCharacterTestImageLoading] = useState(false);

  useEffect(() => {
    setProject(initialProject);
    // 初始化本地文本状态
    setLocalSourceText(initialProject.sourceText || '');
  }, [initialProject]);

  useEffect(() => {
    loadPromptTemplates();
    loadImagePromptTemplates();
  }, []);

  useEffect(() => {
    if (polling && id) {
      const interval = setInterval(() => {
        checkGenerationStatus();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [polling, id]);

  const loadProject = async () => {
    if (!id) return;
    try {
      const response = await projectApi.get(id);
      // 向后兼容：确保 scenes 和其他必需字段存在
      const originalData = response.data || {};
      // 创建一个新对象，避免直接修改 response.data
      const projectData: any = {
        ...originalData,
        scenes: originalData.scenes || [],
        characters: originalData.characters || [],
        generationProgress: originalData.generationProgress || {
          imagesCompleted: 0,
          imagesTotal: 0,
          audioCompleted: 0,
          audioTotal: 0
        },
        storyboards: (originalData.storyboards || []).map((sb: any) => ({
          ...sb,
          sceneId: sb.sceneId ?? null,
          characterIds: sb.characterIds ?? []
        })),
        // 确保新字段有默认值
        subtitleSegments: originalData.subtitleSegments ?? [],
        uploadedAudioFiles: originalData.uploadedAudioFiles ?? [],
        projectLocalPromptTemplates: originalData.projectLocalPromptTemplates ?? [],
      };
      setProject(projectData);
      onProjectUpdate(projectData);
      // 更新本地文本
      setLocalSourceText(projectData.sourceText || '');
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const loadPromptTemplates = async () => {
    try {
      const response = await promptApi.listTemplates();
      setPromptTemplates(response.data);
    } catch (error) {
      console.error('Failed to load prompt templates:', error);
    }
  };

  const loadImagePromptTemplates = async () => {
    try {
      const response = await imagePromptApi.listTemplates();
      setImagePromptTemplates(response.data);
    } catch (error) {
      console.error('Failed to load image prompt templates:', error);
    }
  };

  // 字幕上传处理
  const handleUploadSubtitle = async (file: File) => {
    if (!id) return;
    setUploadingSubtitle(true);
    console.log('开始上传字幕文件:', file.name, file.size, file.type);
    try {
      const response = await generationApi.uploadSubtitle(id, file);
      console.log('上传成功，响应数据:', response.data);
      setLocalSourceText(response.data.textSegments.map((t: any) => t.text).join('\n'));
      await loadProject();
      addToast({
        type: 'success',
        message: `字幕上传成功！共 ${response.data.textSegments.length} 个片段`,
      });
    } catch (error: any) {
      console.error('字幕上传失败 - 详细错误:', error);
      console.error('错误响应:', error?.response);
      console.error('错误消息:', error?.message);
      const errorMsg = error?.response?.data?.detail || error?.message || '字幕上传失败，请重试';
      addToast({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setUploadingSubtitle(false);
    }
  };

  const handleDeleteSubtitle = async () => {
    if (!id) return;
    try {
      await generationApi.deleteSubtitle(id);
      await loadProject();
      addToast({
        type: 'success',
        message: '字幕已删除',
      });
    } catch (error: any) {
      console.error('删除字幕失败:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || '删除字幕失败';
      addToast({
        type: 'error',
        message: errorMsg,
      });
    }
  };

  // 音频上传处理
  const handleUploadAudio = async (file: File) => {
    if (!id) return;
    setUploadingAudio(true);
    console.log('开始上传音频文件:', file.name, file.size, file.type);
    try {
      const response = await generationApi.uploadAudio(id, file);
      console.log('音频上传成功，响应数据:', response.data);
      await loadProject();
      addToast({
        type: 'success',
        message: `音频上传成功：${file.name}`,
      });
    } catch (error: any) {
      console.error('音频上传失败 - 详细错误:', error);
      console.error('错误响应:', error?.response);
      const errorMsg = error?.response?.data?.detail || error?.message || '音频上传失败，请重试';
      addToast({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleUploadAudios = async (files: FileList) => {
    if (!id) return;
    setUploadingAudio(true);
    console.log('开始批量上传音频文件，数量:', files.length);
    try {
      const fileArray = Array.from(files);
      const response = await generationApi.uploadAudios(id, fileArray);
      console.log('批量上传成功，响应数据:', response.data);
      await loadProject();
      addToast({
        type: 'success',
        message: `成功上传 ${fileArray.length} 个音频文件`,
      });
    } catch (error: any) {
      console.error('批量上传音频失败 - 详细错误:', error);
      console.error('错误响应:', error?.response);
      const errorMsg = error?.response?.data?.detail || error?.message || '音频上传失败，请重试';
      addToast({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleDeleteUploadedAudios = async () => {
    if (!id) return;
    try {
      await generationApi.deleteUploadedAudios(id);
      await loadProject();
      addToast({
        type: 'success',
        message: '已清空上传的音频',
      });
    } catch (error: any) {
      console.error('清空音频失败:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || '清空音频失败';
      addToast({
        type: 'error',
        message: errorMsg,
      });
    }
  };

  const handleUseTemplate = async (storyboardId: string, templateId: string) => {
    if (!id || !project) return;
    const storyboard = project.storyboards.find(sb => sb.id === storyboardId);
    if (!storyboard) return;

    try {
      // Get character prompts for this storyboard
      const characterPrompts = storyboard.characterIds
        .map(charId => project.characters.find(c => c.id === charId)?.characterPrompt)
        .filter(Boolean)
        .join(', ');

      const response = await imagePromptApi.renderTemplate(templateId, {
        scene: storyboard.sceneDescription,
        characterPrompts,
        stylePrompt: project.stylePrompt,
      });

      // Update the prompt
      const newValue = response.data.renderedPrompt;
      setEditingPrompt(prev => ({ ...prev, [storyboardId]: newValue }));

      // Save immediately
      setSavingPrompt(storyboardId);
      try {
        await storyboardApi.update(id, storyboardId, { imagePrompt: newValue });
        await loadProject();
      } finally {
        setSavingPrompt(null);
        setEditingPrompt(prev => {
          const next = { ...prev };
          delete next[storyboardId];
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to use template:', error);
    }
  };

  const handleUpdateProjectPromptTemplate = async (type: PromptType, templateId: string) => {
    if (!id || !project) return;
    setSavingProjectSettings(true);
    try {
      const newTemplates = {
        ...project.projectPromptTemplates,
        [type]: templateId
      };
      const response = await projectApi.update(id, { projectPromptTemplates: newTemplates });
      setProject(response.data);
      onProjectUpdate(response.data);
    } catch (error) {
      console.error('Failed to update project prompt template:', error);
    } finally {
      setSavingProjectSettings(false);
    }
  };

  const checkGenerationStatus = async () => {
    if (!id) return;
    try {
      await loadProject();
      const response = await generationApi.getStatus(id);
      setGenerationStatus({
        images: response.data.images,
        audio: response.data.audio
      });
    } catch (error) {
      console.error('Failed to check status:', error);
    }
  };

  const handleExtractCharacters = async () => {
    if (!id) return;
    setExtractingCharacters(true);
    try {
      await characterApi.extract(id);
      await loadProject();
    } catch (error) {
      console.error('Failed to extract characters:', error);
      alert('提取角色失败，请检查控制台');
    } finally {
      setExtractingCharacters(false);
    }
  };

  const handleExtractScenes = async () => {
    if (!id) return;
    setExtractingScenes(true);
    try {
      await sceneApi.extract(id);
      await loadProject();
    } catch (error) {
      console.error('Failed to extract scenes:', error);
      alert('提取场景失败，请检查控制台');
    } finally {
      setExtractingScenes(false);
    }
  };

  const handleTempSceneChange = (sceneId: string, field: 'name' | 'description', value: string) => {
    setTempScene(prev => ({
      ...prev,
      [sceneId]: {
        ...prev[sceneId],
        [field]: value
      }
    }));
  };

  const handleSaveScene = async (sceneId: string) => {
    if (!id || !project) return;
    const sceneData = tempScene[sceneId];
    if (!sceneData) return;

    setSavingScene(sceneId);
    try {
      const scene = project.scenes.find(s => s.id === sceneId);
      if (scene) {
        await sceneApi.update(id, sceneId, {
          ...scene,
          ...sceneData
        });
        await loadProject();
        setTempScene(prev => {
          const next = { ...prev };
          delete next[sceneId];
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to save scene:', error);
    } finally {
      setSavingScene(null);
    }
  };

  const handleDeleteScene = async (sceneId: string) => {
    if (!id) return;
    try {
      await sceneApi.delete(id, sceneId);
      await loadProject();
    } catch (error) {
      console.error('Failed to delete scene:', error);
    }
  };

  const handleTempCharacterChange = (charId: string, field: keyof Character, value: string) => {
    setTempCharacter(prev => ({
      ...prev,
      [charId]: {
        ...prev[charId],
        [field]: value
      }
    }));
  };

  const handleSaveCharacter = async (charId: string) => {
    if (!id || !project) return;
    const charData = tempCharacter[charId];
    if (!charData) return;

    setSavingCharacter(charId);
    try {
      const char = project.characters.find(c => c.id === charId);
      if (char) {
        await characterApi.update(id, charId, {
          ...char,
          ...charData
        });
        await loadProject();
        setTempCharacter(prev => {
          const next = { ...prev };
          delete next[charId];
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to save character:', error);
    } finally {
      setSavingCharacter(null);
    }
  };

  const handleCharacterTestImage = async (charId: string) => {
    const char = project.characters.find(c => c.id === charId);
    if (!char) return;

    // 使用 tempCharacter 中的值（如果正在编辑）或者 char 中的值
    const currentCharData = tempCharacter[charId] || {};
    const characterPrompt = currentCharData.characterPrompt ?? char.characterPrompt;
    const negativePrompt = currentCharData.negativePrompt ?? char.negativePrompt;

    // 组合提示词
    let fullPrompt = characterPrompt || '';
    if (project.stylePrompt) {
      fullPrompt = fullPrompt ? `${fullPrompt}, ${project.stylePrompt}` : project.stylePrompt;
    }

    setCharacterTestImagePrompt(fullPrompt);
    setCharacterTestImageUrl(null);
    setShowCharacterTestImage(charId);
  };

  const handleGenerateCharacterTestImage = async () => {
    if (!characterTestImagePrompt) return;
    try {
      setCharacterTestImageLoading(true);
      setCharacterTestImageUrl(null);
      const response = await stylePromptsApi.testImage(characterTestImagePrompt);
      const url = stylePromptsApi.getTestImageUrl(response.data.filename);
      setCharacterTestImageUrl(url);
    } catch (error) {
      console.error('Failed to generate test image:', error);
      alert('生成图片失败: ' + (error as any)?.response?.data?.detail || (error as any)?.message);
    } finally {
      setCharacterTestImageLoading(false);
    }
  };

  const handleCharacterTestImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('Image failed to load:', e);
    alert('图片加载失败，请检查后端日志');
  };

  const handleStoryboardSceneChange = async (storyboardId: string, sceneId: string | null) => {
    if (!id) return;
    try {
      await storyboardApi.update(id, storyboardId, { sceneId: sceneId || undefined });
      await loadProject();
    } catch (error) {
      console.error('Failed to update storyboard scene:', error);
    }
  };

  const handleStoryboardCharactersChange = async (storyboardId: string, characterIds: string[]) => {
    if (!id) return;
    try {
      await storyboardApi.update(id, storyboardId, { characterIds });
      await loadProject();
    } catch (error) {
      console.error('Failed to update storyboard characters:', error);
    }
  };

  const handleSplitStoryboard = async () => {
    if (!id || !project) return;

    const initialStoryboardCount = project.storyboards.length;
    setSplittingStoryboards(true);
    setSplitProgress(0);
    setSplitStatusText('正在拆分剧本...');

    let progressInterval: number | null = null;

    try {
      // 先调用拆分 API
      await storyboardApi.split(id, linesPerStoryboard);

      // 开始轮询获取进度
      let pollCount = 0;
      const maxPolls = 300; // 最多轮询 5 分钟 (300 * 1秒)

      progressInterval = window.setInterval(async () => {
        pollCount++;
        try {
          const response = await projectApi.get(id);
          const currentProject = response.data;
          setProject(currentProject);
          onProjectUpdate(currentProject);

          const totalStoryboards = currentProject.storyboards.length;
          const newStoryboards = totalStoryboards - initialStoryboardCount;

          if (newStoryboards > 0) {
            const storyboardsWithPrompts = currentProject.storyboards.filter(
              (sb: any) => sb.imagePrompt && sb.imagePrompt.length > 0
            ).length;

            const promptsToGenerate = totalStoryboards - initialStoryboardCount;
            const promptsGenerated = storyboardsWithPrompts - initialStoryboardCount;

            if (promptsToGenerate > 0) {
              const promptProgress = Math.min(100, Math.round((promptsGenerated / promptsToGenerate) * 80));
              const splitProgress = Math.min(20, Math.round((newStoryboards / promptsToGenerate) * 20));

              if (promptsGenerated > 0) {
                setSplitStatusText(`正在生成提示词... (${promptsGenerated}/${promptsToGenerate})`);
              } else {
                setSplitStatusText(`正在拆分剧本... (${newStoryboards}/${promptsToGenerate})`);
              }

              setSplitProgress(splitProgress + promptProgress);

              if (promptsGenerated >= promptsToGenerate) {
                // 完成！
                if (progressInterval) clearInterval(progressInterval);
                setSplitProgress(100);
                setSplitStatusText('完成！');
                setTimeout(() => {
                  setSplittingStoryboards(false);
                  setSplitProgress(0);
                  setSplitStatusText('');
                }, 1000);
              }
            }
          }

          if (pollCount >= maxPolls) {
            if (progressInterval) clearInterval(progressInterval);
            setSplittingStoryboards(false);
            setSplitProgress(0);
            setSplitStatusText('');
            alert('拆分超时，请稍后重试');
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 1000);

    } catch (error) {
      console.error('Failed to split storyboard:', error);
      alert('拆分分镜失败，请检查控制台');
      setSplittingStoryboards(false);
      setSplitProgress(0);
      setSplitStatusText('');
      if (progressInterval) clearInterval(progressInterval);
    }
  };

  const handleGeneratePrompts = async () => {
    if (!id || !project) return;

    const storyboardsWithoutPrompts = project.storyboards.filter(sb => !sb.imagePrompt || sb.imagePrompt.length === 0);
    if (storyboardsWithoutPrompts.length === 0) {
      alert('所有分镜都已有提示词');
      return;
    }

    setGeneratingPrompts(true);
    setSplitProgress(0);
    setSplitStatusText('正在生成提示词...');

    let progressInterval: number | null = null;

    try {
      await storyboardApi.generatePrompts(id);

      // 开始轮询获取进度
      let pollCount = 0;
      const maxPolls = 300;

      progressInterval = window.setInterval(async () => {
        pollCount++;
        try {
          const response = await projectApi.get(id);
          const currentProject = response.data;
          setProject(currentProject);
          onProjectUpdate(currentProject);

          const totalToGenerate = storyboardsWithoutPrompts.length;
          const generated = currentProject.storyboards.filter(
            (sb: any) => sb.imagePrompt && sb.imagePrompt.length > 0
          ).length - (project.storyboards.length - totalToGenerate);

          if (generated > 0) {
            setSplitProgress(Math.min(100, Math.round((generated / totalToGenerate) * 100)));
            setSplitStatusText(`正在生成提示词... (${generated}/${totalToGenerate})`);
          }

          if (generated >= totalToGenerate) {
            if (progressInterval) clearInterval(progressInterval);
            setSplitProgress(100);
            setSplitStatusText('完成！');
            setTimeout(() => {
              setGeneratingPrompts(false);
              setSplitProgress(0);
              setSplitStatusText('');
            }, 1000);
          }

          if (pollCount >= maxPolls) {
            if (progressInterval) clearInterval(progressInterval);
            setGeneratingPrompts(false);
            setSplitProgress(0);
            setSplitStatusText('');
            alert('生成超时，请稍后重试');
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 1000);

    } catch (error) {
      console.error('Failed to generate prompts:', error);
      alert('生成提示词失败，请检查控制台');
      setGeneratingPrompts(false);
      setSplitProgress(0);
      setSplitStatusText('');
      if (progressInterval) clearInterval(progressInterval);
    }
  };

  const handlePromptChange = (storyboardId: string, value: string) => {
    setEditingPrompt(prev => ({ ...prev, [storyboardId]: value }));
  };

  const handlePromptSave = async (storyboardId: string) => {
    if (!id) return;
    const newValue = editingPrompt[storyboardId];
    if (newValue === undefined) return;

    setSavingPrompt(storyboardId);
    try {
      await storyboardApi.update(id, storyboardId, { imagePrompt: newValue });
      await loadProject();
    } catch (error) {
      console.error('Failed to save prompt:', error);
    } finally {
      setSavingPrompt(null);
      setEditingPrompt(prev => {
        const next = { ...prev };
        delete next[storyboardId];
        return next;
      });
    }
  };

  const handleGenerateImages = async () => {
    if (!id) return;
    try {
      await generationApi.generateImages(id);
      setPolling(true);
    } catch (error) {
      console.error('Failed to generate images:', error);
    }
  };

  const handleGenerateAudios = async () => {
    if (!id) return;
    try {
      await generationApi.generateAudios(id);
      setPolling(true);
    } catch (error) {
      console.error('Failed to generate audios:', error);
    }
  };

  const handleGenerateSingleAudio = async (storyboardId: string) => {
    if (!id) return;
    try {
      await generationApi.generateAudio(id, storyboardId);
      setPolling(true);
    } catch (error) {
      console.error('Failed to generate audio:', error);
    }
  };

  const handleExportJianying = async () => {
    if (!id) return;
    setExportingJianying(true);
    setExportResult(null);
    try {
      const response = await exportApi.exportJianying(id);
      if (response.data.status === 'success') {
        setExportResult({
          success: true,
          message: `导出成功！\n草稿ID: ${response.data.exportId}\n保存路径: ${response.data.draftPath}`
        });
      } else {
        setExportResult({
          success: false,
          message: `导出失败: ${response.data.error || '未知错误'}`
        });
      }
    } catch (error: any) {
      console.error('Failed to export jianying:', error);
      let errorMsg = '导出失败';
      if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.message) {
        errorMsg = error.message;
      }
      setExportResult({
        success: false,
        message: errorMsg
      });
    } finally {
      setExportingJianying(false);
    }
  };

  const handleSaveCharacterTts = async (charId: string) => {
    if (!id || !project) return;
    const ttsConfig = tempCharacterTts[charId];
    if (!ttsConfig) return;

    setSavingCharacterTts(charId);
    try {
      const char = project.characters.find(c => c.id === charId);
      if (char) {
        await characterApi.update(id, charId, {
          ...char,
          ttsConfig
        });
        await loadProject();
        setTempCharacterTts(prev => {
          const next = { ...prev };
          delete next[charId];
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to save character TTS config:', error);
    } finally {
      setSavingCharacterTts(null);
    }
  };

  const handleTempCharacterTtsChange = (charId: string, field: 'voice' | 'rate' | 'pitch', value: any) => {
    setTempCharacterTts(prev => {
      const current = prev[charId] || {
        voice: 'zh-CN-XiaoxiaoNeural',
        rate: 1.0,
        pitch: 0
      };
      return {
        ...prev,
        [charId]: {
          ...current,
          [field]: value
        }
      };
    });
  };

  const handleApplyBulkVoiceToStoryboards = async (voice: string) => {
    if (!id || !project) return;
    try {
      // 为所有分镜应用相同的声音
      await Promise.all(
        project.storyboards.map(sb =>
          storyboardApi.update(id, sb.id, {
            ttsConfig: {
              voice,
              rate: 1.0,
              pitch: 0
            }
          })
        )
      );
      await loadProject();
      setBulkVoice('');
    } catch (error) {
      console.error('Failed to apply bulk voice:', error);
    }
  };

  const handleStoryboardVoiceChange = async (storyboardId: string, voice: string) => {
    if (!id) return;
    try {
      await storyboardApi.update(id, storyboardId, {
        ttsConfig: {
          voice,
          rate: 1.0,
          pitch: 0
        }
      });
      await loadProject();
    } catch (error) {
      console.error('Failed to update storyboard voice:', error);
    }
  };

  // Map wizard steps to internal content display
  // Wizard steps: 0=项目设置, 1=角色管理, 2=场景管理, 3=分镜编辑, 4=导出交付
  const getWizardSteps = (): WizardStep[] => {
    return wizardStepDefinitions.map((step, index) => ({
      ...step,
      status: index < currentStep ? 'completed' : index === currentStep ? 'current' : 'pending',
    }));
  };


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <button
            onClick={() => navigate('/')}
            className="text-primary-500 hover:text-primary-600 mr-4"
          >
            ← 返回
          </button>
          <h2 className="text-2xl font-bold inline text-light-text-primary dark:text-dark-text-primary">{project.name}</h2>
        </div>
      </div>

      {/* Wizard Steps Navigation */}
      <WizardSteps
        steps={getWizardSteps()}
        currentStep={currentStep}
        onStepClick={(stepId) => setCurrentStep(stepId)}
      />

      <div className="card p-6">
        {/* Step 0: 项目设置 */}
        {currentStep === 0 && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">项目设置</h3>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                  项目名称
                </label>
                <input
                  type="text"
                  value={project.name}
                  className="input-field w-full"
                  readOnly
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                    项目 Prompt 模板
                  </label>
                  <a
                    href="/templates"
                    className="text-primary-500 hover:text-primary-600 text-sm"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    管理模板 →
                  </a>
                </div>
                <div className="space-y-4">
                  {[
                    { key: 'character_extraction' as const, label: '角色提取' },
                    { key: 'scene_extraction' as const, label: '场景提取' },
                    { key: 'storyboard_split' as const, label: '分镜拆分' },
                    { key: 'image_prompt' as const, label: '图像生成' },
                  ].map(({ key: type, label }) => {
                    const templatesByType = promptTemplates.filter(t => t.type === type);
                    return (
                      <div key={type}>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                          {label}
                        </label>
                        <select
                          value={project.projectPromptTemplates?.[type] || ''}
                          onChange={(e) => handleUpdateProjectPromptTemplate(type, e.target.value)}
                          disabled={savingProjectSettings}
                          className="input-field w-full"
                        >
                          <option value="">-- 使用全局默认 --</option>
                          {templatesByType.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name} {template.isPreset ? '(预设)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 字幕上传 */}
              <div className="border-t border-light-divider dark:border-dark-divider pt-6">
                <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                  上传字幕
                </label>
                <div className="space-y-3">
                  <input
                    ref={subtitleFileRef}
                    type="file"
                    accept=".srt,.vtt,.lrc,.txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleUploadSubtitle(e.target.files[0]);
                      }
                    }}
                  />
                  {project.subtitleFilePath ? (
                    <div className="flex items-center gap-2 p-3 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-500/20">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-success-600 dark:text-success-400">✓</span>
                          <span className="font-medium text-light-text-primary dark:text-dark-text-primary">
                            已上传字幕
                          </span>
                        </div>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                          {project.subtitleSegments?.length || 0} 个字幕片段
                        </p>
                      </div>
                      <button
                        onClick={handleDeleteSubtitle}
                        className="btn-secondary text-red-500 hover:text-red-600 hover:border-red-300 dark:hover:border-red-700"
                      >
                        删除字幕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => subtitleFileRef.current?.click()}
                      disabled={uploadingSubtitle}
                      className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed w-full"
                    >
                      {uploadingSubtitle ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="animate-spin">⟳</span> 上传中...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <span>📝</span> 上传字幕文件（支持 .srt, .vtt, .lrc, .txt）
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* 音频上传 */}
              <div className="border-t border-light-divider dark:border-dark-divider pt-6">
                <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                  上传音频
                </label>
                <div className="space-y-3">
                  <input
                    ref={audioFileRef}
                    type="file"
                    accept=".wav,.mp3,.m4a"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        if (e.target.files.length === 1) {
                          handleUploadAudio(e.target.files[0]);
                        } else {
                          handleUploadAudios(e.target.files);
                        }
                      }
                    }}
                  />
                  {project.uploadedAudioFiles?.length > 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-500/20">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-success-600 dark:text-success-400">✓</span>
                          <span className="font-medium text-light-text-primary dark:text-dark-text-primary">
                            已上传音频
                          </span>
                        </div>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                          {project.uploadedAudioFiles.length} 个音频文件
                        </p>
                      </div>
                      <button
                        onClick={handleDeleteUploadedAudios}
                        className="btn-secondary text-red-500 hover:text-red-600 hover:border-red-300 dark:hover:border-red-700"
                      >
                        清空上传
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => audioFileRef.current?.click()}
                      disabled={uploadingAudio}
                      className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed w-full"
                    >
                      {uploadingAudio ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="animate-spin">⟳</span> 上传中...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <span>🎵</span> 上传音频文件（支持 .wav, .mp3, .m4a，可多选）
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* 提示 */}
              <div className="bg-secondary-50 dark:bg-secondary-500/10 rounded-xl p-4 border border-secondary-200 dark:border-secondary-500/20">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary-100 dark:bg-secondary-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-secondary-600 dark:text-secondary-400">💡</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
                      支持两种方式输入文本和音频
                    </h4>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      方式1：后续在分镜编辑步骤中自动拆分文本并生成配音
                    </p>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                      方式2：点击上方按钮上传字幕文件和音频文件
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: 角色管理 */}
        {currentStep === 1 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">角色列表</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setProjectPromptManagerType('character_extraction');
                    setShowProjectPromptManager(true);
                  }}
                  className="btn-secondary"
                >
                  管理提示词
                </button>
                <button
                  onClick={handleExtractCharacters}
                  disabled={extractingCharacters}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {extractingCharacters ? '提取中...' : '自动提取角色'}
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {project.characters.map((char) => (
                <div key={char.id} className="border border-light-border dark:border-dark-borderborder-light-border dark:border-dark-border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">{char.name}</h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingCharacterId(
                          editingCharacterId === char.id ? null : char.id
                        )}
                        className="text-primary-500 text-sm hover:text-primary-600"
                      >
                        {editingCharacterId === char.id ? '收起' : '编辑'}
                      </button>
                    </div>
                  </div>

                  {editingCharacterId === char.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">角色描述</label>
                        <textarea
                          value={tempCharacter[char.id]?.description ?? char.description}
                          onChange={(e) => handleTempCharacterChange(char.id, 'description', e.target.value)}
                          className="input-field w-full"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">角色提示词 (英文)</label>
                        <textarea
                          value={tempCharacter[char.id]?.characterPrompt ?? char.characterPrompt}
                          onChange={(e) => handleTempCharacterChange(char.id, 'characterPrompt', e.target.value)}
                          className="input-field w-full font-mono text-sm"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">负面提示词 (英文)</label>
                        <textarea
                          value={tempCharacter[char.id]?.negativePrompt ?? char.negativePrompt}
                          onChange={(e) => handleTempCharacterChange(char.id, 'negativePrompt', e.target.value)}
                          className="input-field w-full font-mono text-sm"
                          rows={2}
                        />
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-light-border dark:border-dark-border">
                        <button
                          onClick={() => handleCharacterTestImage(char.id)}
                          className="btn-secondary text-sm"
                        >
                          🎨 测试生图
                        </button>
                        <button
                          onClick={() => handleSaveCharacter(char.id)}
                          disabled={savingCharacter === char.id}
                          className={`btn-primary ${savingCharacter === char.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {savingCharacter === char.id ? '保存中...' : '保存'}
                        </button>
                      </div>
                      {/* 声音配置 - 在编辑模式下也显示 */}
                      <div className="pt-4 border-t border-light-border dark:border-dark-border space-y-4">
                        <h5 className="font-medium text-sm text-light-text-primary dark:text-dark-text-primary">声音配置</h5>
                        <div>
                          <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">声音</label>
                          <select
                            value={tempCharacterTts[char.id]?.voice || char.ttsConfig?.voice || 'zh-CN-XiaoxiaoNeural'}
                            onChange={(e) => {
                              handleTempCharacterTtsChange(char.id, 'voice', e.target.value);
                            }}
                            className="input-field w-full"
                          >
                            {TTS_VOICES.map((voice) => (
                              <option key={voice.value} value={voice.value}>
                                {voice.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                            语速: {(tempCharacterTts[char.id]?.rate || char.ttsConfig?.rate || 1.0).toFixed(1)}x
                          </label>
                          <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={tempCharacterTts[char.id]?.rate || char.ttsConfig?.rate || 1.0}
                            onChange={(e) => {
                              handleTempCharacterTtsChange(char.id, 'rate', parseFloat(e.target.value));
                            }}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                            音调: {(tempCharacterTts[char.id]?.pitch ?? char.ttsConfig?.pitch ?? 0)}Hz
                          </label>
                          <input
                            type="range"
                            min="-100"
                            max="100"
                            step="1"
                            value={tempCharacterTts[char.id]?.pitch ?? char.ttsConfig?.pitch ?? 0}
                            onChange={(e) => {
                              handleTempCharacterTtsChange(char.id, 'pitch', parseInt(e.target.value));
                            }}
                            className="w-full"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleSaveCharacterTts(char.id)}
                            disabled={savingCharacterTts === char.id || !tempCharacterTts[char.id]}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {savingCharacterTts === char.id ? '保存声音...' : '保存声音'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{char.description}</p>
                      {char.characterPrompt && (
                        <div className="mt-2">
                          <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary font-mono truncate">
                            提示词: {char.characterPrompt}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              {project.characters.length === 0 && (
                <p className="text-light-text-secondary dark:text-dark-text-secondary">还没有角色，点击上方按钮自动提取</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: 场景管理 */}
        {currentStep === 2 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">场景列表</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setProjectPromptManagerType('scene_extraction');
                    setShowProjectPromptManager(true);
                  }}
                  className="btn-secondary"
                >
                  管理提示词
                </button>
                <button
                  onClick={handleExtractScenes}
                  disabled={extractingScenes}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {extractingScenes ? '提取中...' : '自动提取场景'}
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {(project.scenes || []).map((scene) => (
                <div key={scene.id} className="border border-light-border dark:border-dark-borderborder-light-border dark:border-dark-border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">{scene.name}</h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingSceneId(
                          editingSceneId === scene.id ? null : scene.id
                        )}
                        className="text-primary-500 text-sm hover:text-primary-600"
                      >
                        {editingSceneId === scene.id ? '收起' : '编辑'}
                      </button>
                      <button
                        onClick={() => handleDeleteScene(scene.id)}
                        className="text-error-500 text-sm hover:text-error-600"
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  {editingSceneId === scene.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">场景名称</label>
                        <input
                          type="text"
                          value={tempScene[scene.id]?.name ?? scene.name}
                          onChange={(e) => handleTempSceneChange(scene.id, 'name', e.target.value)}
                          className="input-field w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">场景描述</label>
                        <textarea
                          value={tempScene[scene.id]?.description ?? scene.description}
                          onChange={(e) => handleTempSceneChange(scene.id, 'description', e.target.value)}
                          className="input-field w-full"
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleSaveScene(scene.id)}
                          disabled={savingScene === scene.id}
                          className={`btn-primary ${
                            savingScene === scene.id
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                          }`}
                        >
                          {savingScene === scene.id ? '保存中...' : '保存'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{scene.description}</p>
                  )}
                </div>
              ))}
              {(!project.scenes || project.scenes.length === 0) && (
                <p className="text-light-text-secondary dark:text-dark-text-secondary">还没有场景，点击上方按钮自动提取</p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: 分镜编辑 (剧本拆分 + 图片生成 + 配音生成) */}
        {currentStep === 3 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">分镜列表 ({project.storyboards.length})</h3>
              <div className="flex items-center gap-2">
                <select
                  value={linesPerStoryboard}
                  onChange={(e) => setLinesPerStoryboard(parseInt(e.target.value))}
                  disabled={splittingStoryboards || generatingPrompts}
                  className="input-field text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value={1}>1行/分镜</option>
                  <option value={2}>2行/分镜</option>
                  <option value={3}>3行/分镜</option>
                </select>
                <button
                  onClick={handleSplitStoryboard}
                  disabled={splittingStoryboards || generatingPrompts}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {splittingStoryboards ? '正在拆分分镜...' : '自动拆分剧本'}
                </button>
                {project.storyboards.length > 0 && (
                  <button
                    onClick={handleGeneratePrompts}
                    disabled={splittingStoryboards || generatingPrompts}
                    className="bg-success-500 hover:bg-success-600 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingPrompts ? '生成中...' : '批量生成提示词'}
                  </button>
                )}
              </div>
            </div>
            {(splittingStoryboards || generatingPrompts) && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                  <span>{splitStatusText || '进度'}</span>
                  <span>{splitProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${generatingPrompts ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${splitProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {project.storyboards.map((sb) => (
                <div key={sb.id} className="border border-light-border dark:border-dark-borderrounded-lg p-4">
                  <div className="flex justify-between">
                    <span className="font-semibold">分镜 {sb.index + 1}</span>
                  </div>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-2">{sb.sceneDescription}</p>
                  {sb.dialogue && (
                    <p className="text-sm text-blue-600 mt-1">台词: {sb.dialogue}</p>
                  )}
                  {sb.narration && (
                    <p className="text-sm text-green-600 mt-1">旁白: {sb.narration}</p>
                  )}

                  {/* 场景选择 */}
                  <div className="mt-3">
                    <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1 block">关联场景</label>
                    <select
                      value={sb.sceneId || ''}
                      onChange={(e) => handleStoryboardSceneChange(sb.id, e.target.value || null)}
                      className="input-field w-full text-sm"
                    >
                      <option value="">-- 无场景 --</option>
                      {(project.scenes || []).map((scene) => (
                        <option key={scene.id} value={scene.id}>
                          {scene.name}
                        </option>
                      ))}
                    </select>
                    {sb.sceneId && (
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        {(project.scenes || []).find(s => s.id === sb.sceneId)?.description}
                      </p>
                    )}
                  </div>

                  {/* 角色选择 */}
                  <div className="mt-3">
                    <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1 block">关联角色</label>
                    <div className="flex flex-wrap gap-2">
                      {project.characters.map((char) => {
                        const isSelected = sb.characterIds?.includes(char.id) || false;
                        return (
                          <button
                            key={char.id}
                            onClick={() => {
                              const newCharIds = isSelected
                                ? (sb.characterIds || []).filter(id => id !== char.id)
                                : [...(sb.characterIds || []), char.id];
                              handleStoryboardCharactersChange(sb.id, newCharIds);
                            }}
                            className={`px-3 py-1 rounded-full text-sm ${
                              isSelected
                                ? 'bg-blue-500 text-white'
                                : 'bg-light-divider dark:bg-dark-divider text-light-text-secondary dark:text-dark-text-secondary hover:bg-gray-200'
                            }`}
                          >
                            {char.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">画图提示词</label>
                      <div className="flex items-center gap-2">
                        {imagePromptTemplates.length > 0 && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleUseTemplate(sb.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            value=""
                            className="text-xs border rounded px-2 py-1"
                          >
                            <option value="">使用模板...</option>
                            {imagePromptTemplates.map((tpl) => (
                              <option key={tpl.id} value={tpl.id}>
                                {tpl.name} {tpl.isPreset ? '(预设)' : ''}
                              </option>
                            ))}
                          </select>
                        )}
                        {savingPrompt === sb.id && (
                          <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">保存中...</span>
                        )}
                        <button
                          onClick={() => setExpandedPrompt(
                            expandedPrompt === sb.id ? null : sb.id
                          )}
                          className="text-xs text-blue-500 hover:text-blue-600"
                        >
                          {expandedPrompt === sb.id ? '收起' : '展开'}
                        </button>
                      </div>
                    </div>
                    {expandedPrompt === sb.id ? (
                      <textarea
                        value={editingPrompt[sb.id] ?? sb.imagePrompt ?? ''}
                        onChange={(e) => handlePromptChange(sb.id, e.target.value)}
                        onBlur={() => handlePromptSave(sb.id)}
                        placeholder="AI 生成的画图提示词将显示在这里..."
                        className="input-field w-full text-sm font-mono disabled:opacity-50"
                        rows={4}
                        disabled={savingPrompt === sb.id}
                      />
                    ) : (
                      sb.imagePrompt && (
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">{sb.imagePrompt}</p>
                      )
                    )}
                  </div>
                </div>
              ))}
              {project.storyboards.length === 0 && (
                <p className="text-light-text-secondary dark:text-dark-text-secondary">还没有分镜，点击上方按钮自动拆分</p>
              )}
            </div>

            {/* 图片生成部分 */}
            {project.storyboards.length > 0 && (
              <div className="mt-8 pt-8 border-t border-light-border dark:border-dark-border">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">图片生成</h3>
                  <button
                    onClick={handleGenerateImages}
                    disabled={polling}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {polling ? '生成中...' : '批量生成图片'}
                  </button>
                </div>
                {polling && generationStatus?.images && generationStatus.images.total > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      <span>图片生成进度</span>
                      <span>{generationStatus.images.completed}/{generationStatus.images.total}</span>
                    </div>
                    <div className="w-full bg-light-divider dark:bg-dark-divider rounded-full h-3">
                      <div
                        className="bg-primary-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${Math.round((generationStatus.images.completed / generationStatus.images.total) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {project.storyboards.map((sb) => (
                    <div key={sb.id} className="border border-light-border dark:border-dark-borderborder-light-border dark:border-dark-border rounded-lg p-2">
                      <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">分镜 {sb.index + 1}</div>
                      {sb.imageStatus === 'completed' && sb.imagePath ? (
                        <img
                          src={`/data/projects/${id}/${sb.imagePath}`}
                          alt=""
                          className="w-full h-24 sm:h-32 object-cover rounded"
                        />
                      ) : (
                        <div className="w-full h-24 sm:h-32 bg-light-divider dark:bg-dark-divider rounded flex items-center justify-center">
                          <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {sb.imageStatus === 'generating' ? '生成中...' :
                             sb.imageStatus === 'failed' ? '失败' : '待生成'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 配音生成部分 */}
            {project.storyboards.length > 0 && (
              <div className="mt-8 pt-8 border-t border-light-border dark:border-dark-border">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                  <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">配音生成</h3>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">批量设置音色:</label>
                      <select
                        value={bulkVoice}
                        onChange={(e) => setBulkVoice(e.target.value)}
                        className="input-field text-sm"
                      >
                        <option value="">-- 选择音色 --</option>
                        {TTS_VOICES.map((voice) => (
                          <option key={voice.value} value={voice.value}>
                            {voice.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => handleApplyBulkVoiceToStoryboards(bulkVoice)}
                      disabled={!bulkVoice}
                      className="bg-warning-500 hover:bg-warning-600 text-white px-4 py-2 rounded-md disabled:opacity-50 text-sm"
                    >
                      应用到所有分镜
                    </button>
                    <button
                      onClick={handleGenerateAudios}
                      disabled={polling}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {polling ? '生成中...' : '批量生成配音'}
                    </button>
                  </div>
                </div>
                {polling && generationStatus?.audio && generationStatus.audio.total > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      <span>配音生成进度</span>
                      <span>{generationStatus.audio.completed}/{generationStatus.audio.total}</span>
                    </div>
                    <div className="w-full bg-light-divider dark:bg-dark-divider rounded-full h-3">
                      <div
                        className="bg-success-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${Math.round((generationStatus.audio.completed / generationStatus.audio.total) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {project.storyboards.map((sb) => (
                    <div key={sb.id} className="border border-light-border dark:border-dark-borderborder-light-border dark:border-dark-border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">分镜 {sb.index + 1}</span>
                        <div className="flex items-center gap-2">
                          {sb.audioDuration > 0 && (
                            <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                              ({sb.audioDuration.toFixed(1)}秒)
                            </span>
                          )}
                          <span className={`text-sm px-2 py-1 rounded ${
                            sb.audioStatus === 'completed' ? 'bg-success-100 text-success-700 dark:bg-success-500/10 dark:text-success-300' :
                            sb.audioStatus === 'generating' ? 'bg-secondary-100 text-secondary-700 dark:bg-secondary-500/10 dark:text-secondary-300' :
                            sb.audioStatus === 'failed' ? 'bg-error-100 text-error-700 dark:bg-error-500/10 dark:text-error-300' :
                            'bg-light-divider text-light-text-secondary dark:bg-dark-divider dark:text-dark-text-secondary'
                          }`}>
                            {sb.audioStatus === 'completed' ? '已完成' :
                             sb.audioStatus === 'generating' ? '生成中' :
                             sb.audioStatus === 'failed' ? '失败' : '待生成'}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">{sb.sceneDescription}</p>
                      {sb.narration && (
                        <p className="text-sm text-success-600 dark:text-success-400 mb-1">
                          <span className="font-medium">旁白:</span> {sb.narration}
                        </p>
                      )}
                      {sb.dialogue && (
                        <p className="text-sm text-primary-600 dark:text-primary-400 mb-2">
                          <span className="font-medium">台词:</span> {sb.dialogue}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-light-border dark:border-dark-border">
                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                          <label className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">音色:</label>
                          <select
                            value={sb.ttsConfig?.voice || ''}
                            onChange={(e) => handleStoryboardVoiceChange(sb.id, e.target.value)}
                            className="input-field text-xs flex-1"
                          >
                            <option value="">-- 使用角色配置 --</option>
                            {TTS_VOICES.map((voice) => (
                              <option key={voice.value} value={voice.value}>
                                {voice.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {sb.audioStatus === 'completed' && sb.audioPath ? (
                          <audio controls className="h-10 w-48 sm:w-64">
                            <source src={`/data/projects/${id}/${sb.audioPath}`} />
                          </audio>
                        ) : (
                          <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary w-32 sm:w-48">
                            状态: {sb.audioStatus}
                          </div>
                        )}
                        {sb.audioStatus !== 'generating' && (
                          <button
                            onClick={() => handleGenerateSingleAudio(sb.id)}
                            className="bg-success-500 hover:bg-success-600 text-white px-3 py-1 rounded text-sm"
                          >
                            {sb.audioStatus === 'completed' ? '重新生成' : '生成配音'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: 导出交付 */}
        {currentStep === 4 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">导出剪映草稿</h3>
              <button
                onClick={handleExportJianying}
                disabled={exportingJianying}
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingJianying ? '导出中...' : '导出到剪映'}
              </button>
            </div>

            {exportResult && (
              <div className={`mb-6 p-4 rounded-md ${exportResult.success ? 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300' : 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300'}`}>
                <pre className="whitespace-pre-wrap text-sm">{exportResult.message}</pre>
              </div>
            )}

            <div className="bg-light-divider dark:bg-dark-divider rounded-lg p-6">
              <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-4">导出说明</h4>
              <ul className="space-y-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <li>• 将项目中的所有图片和音频导出为剪映草稿</li>
                <li>• 图片和音频会自动放置在对应的轨道上</li>
                <li>• 每个分镜的时长根据音频长度自动设置</li>
                <li>• 导出前请确保已配置剪映草稿保存路径（在设置页面）</li>
                <li>• 导出后可以在剪映中打开草稿进行进一步编辑</li>
              </ul>
            </div>

            <div className="mt-6">
              <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-4">项目预览 ({project.storyboards.length} 个分镜)</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {project.storyboards.map((sb) => (
                  <div key={sb.id} className="flex items-center gap-4 border border-light-border dark:border-dark-border rounded-lg p-3">
                    <div className="w-24 h-16 bg-light-divider dark:bg-dark-divider rounded flex items-center justify-center flex-shrink-0">
                      {sb.imageStatus === 'completed' && sb.imagePath ? (
                        <img
                          src={`/data/projects/${id}/${sb.imagePath}`}
                          alt=""
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          {sb.imageStatus === 'generating' ? '生成中' :
                           sb.imageStatus === 'failed' ? '失败' : '无图'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-light-text-primary dark:text-dark-text-primary">分镜 {sb.index + 1}</div>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">{sb.sceneDescription}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {sb.audioStatus === 'completed' && sb.audioDuration > 0 && (
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          {sb.audioDuration.toFixed(1)}s
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded ${
                        sb.audioStatus === 'completed' && sb.imageStatus === 'completed'
                          ? 'bg-success-100 text-success-700 dark:bg-success-500/10 dark:text-success-300'
                          : 'bg-warning-100 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300'
                      }`}>
                        {sb.audioStatus === 'completed' && sb.imageStatus === 'completed' ? '就绪' : '需完成'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 角色测试生图弹窗 */}
      {showCharacterTestImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-light-divider dark:border-dark-divider flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg text-light-text-primary dark:text-dark-text-primary">
                  角色测试生图
                </h3>
                <button
                  onClick={() => {
                    setShowCharacterTestImage(null);
                    setCharacterTestImageUrl(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="mb-4">
                <label className="input-label">提示词</label>
                <textarea
                  value={characterTestImagePrompt}
                  onChange={(e) => setCharacterTestImagePrompt(e.target.value)}
                  className="input-field w-full h-24 resize-none"
                />
              </div>
              {characterTestImageUrl && (
                <div className="mb-4">
                  <label className="input-label">生成结果</label>
                  <div className="flex justify-center">
                    <img
                      src={characterTestImageUrl}
                      alt="Test"
                      className="max-w-full max-h-[60vh] w-auto h-auto rounded-lg"
                      onError={handleCharacterTestImageError}
                      key={characterTestImageUrl}
                    />
                  </div>
                </div>
              )}
              {characterTestImageLoading && (
                <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
                  生成中...
                </div>
              )}
            </div>
            <div className="p-4 border-t border-light-divider dark:border-dark-divider flex gap-2 justify-end flex-shrink-0">
              <button
                onClick={() => {
                  setShowCharacterTestImage(null);
                  setCharacterTestImageUrl(null);
                }}
                className="btn-secondary"
              >
                关闭
              </button>
              <button
                onClick={handleGenerateCharacterTestImage}
                disabled={characterTestImageLoading || !characterTestImagePrompt.trim()}
                className="btn-primary"
              >
                {characterTestImageLoading ? '生成中...' : '生成图片'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 项目提示词管理弹窗 */}
      <ProjectPromptManager
        isOpen={showProjectPromptManager}
        onClose={() => setShowProjectPromptManager(false)}
        projectId={id || ''}
        initialType={projectPromptManagerType}
      />
    </div>
  );
};

export default NovelComicEditor;
