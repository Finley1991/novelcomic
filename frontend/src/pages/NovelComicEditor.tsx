import React, { useEffect, useState } from 'react';
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
import { WizardSteps, wizardStepDefinitions, type WizardStep } from '../components/project/WizardSteps';
import { ProjectPromptManager } from '../components/ProjectPromptManager';
import { StoryboardPromptInference } from '../components/StoryboardPromptInference';
import { StoryboardImageGeneration } from '../components/StoryboardImageGeneration';
import { CharacterManager } from '../components/project/CharacterManager';
import { SceneManager } from '../components/project/SceneManager';
import { StoryboardSplitter } from '../components/project/StoryboardSplitter';
import { ProjectSettings } from '../components/project/ProjectSettings';
import { CharacterTestImageModal } from '../components/project/CharacterTestImageModal';
import { AudioGenerator } from '../components/project/AudioGenerator';
import { JianyingExporter } from '../components/project/JianyingExporter';
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
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [savingProjectSettings, setSavingProjectSettings] = useState(false);
  const [imagePromptTemplates, setImagePromptTemplates] = useState<ImagePromptTemplate[]>([]);
  const [exportingJianying, setExportingJianying] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savingCharacterTts, setSavingCharacterTts] = useState<string | null>(null);
  const [tempCharacterTts, setTempCharacterTts] = useState<{ [charId: string]: Character['ttsConfig'] }>({});
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
  const [uploadingSubtitle, setUploadingSubtitle] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [localSourceText, setLocalSourceText] = useState('');
  const [showProjectPromptManager, setShowProjectPromptManager] = useState(false);
  const [projectPromptManagerType, setProjectPromptManagerType] = useState<PromptType>('character_extraction');
  const [tempCharacter, setTempCharacter] = useState<{ [charId: string]: Partial<Character> }>({});
  const [savingCharacter, setSavingCharacter] = useState<string | null>(null);
  const [showCharacterTestImage, setShowCharacterTestImage] = useState<string | null>(null);
  const [characterTestImagePrompt, setCharacterTestImagePrompt] = useState('');
  const [characterTestImageUrl, setCharacterTestImageUrl] = useState<string | null>(null);
  const [characterTestImageLoading, setCharacterTestImageLoading] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<{ [key: string]: string }>({});
  const [savingPrompt, setSavingPrompt] = useState<string | null>(null);

  useEffect(() => {
    setProject(initialProject);
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
      const originalData = response.data || {};
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
        subtitleSegments: originalData.subtitleSegments ?? [],
        uploadedAudioFiles: originalData.uploadedAudioFiles ?? [],
        projectLocalPromptTemplates: originalData.projectLocalPromptTemplates ?? [],
      };
      setProject(projectData);
      onProjectUpdate(projectData);
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

  const handleUploadSubtitle = async (file: File) => {
    if (!id) return;
    setUploadingSubtitle(true);
    try {
      const response = await generationApi.uploadSubtitle(id, file);
      setLocalSourceText(response.data.textSegments.map((t: any) => t.text).join('\n'));
      await loadProject();
      addToast({
        type: 'success',
        message: `字幕上传成功！共 ${response.data.textSegments.length} 个片段`,
      });
    } catch (error: any) {
      console.error('字幕上传失败:', error);
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

  const handleUploadAudio = async (file: File) => {
    if (!id) return;
    setUploadingAudio(true);
    try {
      const response = await generationApi.uploadAudio(id, file);
      await loadProject();
      addToast({
        type: 'success',
        message: `音频上传成功：${file.name}`,
      });
    } catch (error: any) {
      console.error('音频上传失败:', error);
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
    try {
      const fileArray = Array.from(files);
      const response = await generationApi.uploadAudios(id, fileArray);
      await loadProject();
      addToast({
        type: 'success',
        message: `成功上传 ${fileArray.length} 个音频文件`,
      });
    } catch (error: any) {
      console.error('批量上传音频失败:', error);
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

      const { images, audio } = response.data;
      const imagesDone = !images || images.completed >= images.total;
      const audioDone = !audio || audio.completed >= audio.total;
      const hasGeneratingImages = project.storyboards.some(sb => sb.imageStatus === 'generating');
      const hasGeneratingAudio = project.storyboards.some(sb => sb.audioStatus === 'generating');

      if (imagesDone && audioDone && !hasGeneratingImages && !hasGeneratingAudio) {
        console.log('All generation completed, stopping polling');
        setPolling(false);
        setLoading(false);
      }
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

    const currentCharData = tempCharacter[charId] || {};
    const characterPrompt = currentCharData.characterPrompt ?? char.characterPrompt;
    const negativePrompt = currentCharData.negativePrompt ?? char.negativePrompt;

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
    setSplittingStoryboards(true);
    setSplitProgress(0);
    setSplitStatusText('正在拆分剧本...');
    try {
      await storyboardApi.split(id, {
        split_mode: 'fixed',
        lines_per_storyboard: 1,
        auto_match_characters: true,
        auto_match_scenes: true,
      });
      setSplitProgress(100);
      setSplitStatusText('完成！');
      setTimeout(() => {
        setSplittingStoryboards(false);
        setSplitProgress(0);
        setSplitStatusText('');
      }, 1000);
      await loadProject();
    } catch (error) {
      console.error('Failed to split storyboard:', error);
      alert('拆分分镜失败，请检查控制台');
      setSplittingStoryboards(false);
      setSplitProgress(0);
      setSplitStatusText('');
    }
  };

  const handleInferenceGeneratePrompts = async (storyboardIds?: string[]) => {
    if (!id || !project) return;
    setGeneratingPrompts(true);
    try {
      await storyboardApi.generatePrompts(id, storyboardIds);
      await loadProject();
    } catch (error) {
      console.error('Failed to generate prompts:', error);
      alert('生成提示词失败，请检查控制台');
    } finally {
      setGeneratingPrompts(false);
    }
  };

  const handleUpdatePrompt = async (storyboardId: string, prompt: string) => {
    if (!id) return;
    setSavingPrompt(storyboardId);
    try {
      await storyboardApi.update(id, storyboardId, { imagePrompt: prompt });
      await loadProject();
    } catch (error) {
      console.error('Failed to update prompt:', error);
    } finally {
      setSavingPrompt(null);
    }
  };

  const handleEditPromptChange = (storyboardId: string, prompt: string) => {
    setEditingPrompt(prev => ({ ...prev, [storyboardId]: prompt }));
  };

  const handleGenerateImages = async (storyboardIds?: string[], forceRegenerate?: boolean) => {
    if (!id) return;
    setLoading(true);
    try {
      await generationApi.resetCancel(id);
      await generationApi.generateImages(id, storyboardIds, forceRegenerate);
      setPolling(true);
      await loadProject();
    } catch (error) {
      console.error('Failed to generate images:', error);
      alert('生成图片失败，请检查控制台');
      setLoading(false);
    }
  };

  const handleGenerateSingleImage = async (storyboardId: string) => {
    if (!id || !project) return;
    try {
      const storyboard = project.storyboards.find(sb => sb.id === storyboardId);
      const forceRegenerate = storyboard?.imageStatus === 'completed';
      await generationApi.generateImage(id, storyboardId, forceRegenerate);
      if (!polling) {
        setPolling(true);
      }
    } catch (error) {
      console.error('Failed to generate image:', error);
      alert('生成图片失败，请检查控制台');
    }
  };

  const handleImageUseTemplate = async (storyboardId: string, templateId: string) => {
    if (!id || !project) return;
    const storyboard = project.storyboards.find(sb => sb.id === storyboardId);
    if (!storyboard) return;

    try {
      const characterPrompts = storyboard.characterIds
        .map(charId => project.characters.find(c => c.id === charId)?.characterPrompt)
        .filter(Boolean)
        .join(', ');

      const response = await imagePromptApi.renderTemplate(templateId, {
        scene: storyboard.sceneDescription,
        characterPrompts,
        stylePrompt: project.stylePrompt,
      });

      const newValue = response.data.renderedPrompt;
      setEditingPrompt(prev => ({ ...prev, [storyboardId]: newValue }));
      await handleUpdatePrompt(storyboardId, newValue);
    } catch (error) {
      console.error('Failed to use template:', error);
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

      <WizardSteps
        steps={getWizardSteps()}
        currentStep={currentStep}
        onStepClick={(stepId) => setCurrentStep(stepId)}
      />

      <div className="card p-6">
        {currentStep === 0 && (
          <ProjectSettings
            projectId={id || ''}
            projectName={project.name}
            projectPromptTemplates={project.projectPromptTemplates}
            subtitleFilePath={project.subtitleFilePath}
            subtitleSegments={project.subtitleSegments || []}
            uploadedAudioFiles={project.uploadedAudioFiles || []}
            promptTemplates={promptTemplates}
            savingProjectSettings={savingProjectSettings}
            uploadingSubtitle={uploadingSubtitle}
            uploadingAudio={uploadingAudio}
            onUpdateProjectPromptTemplate={handleUpdateProjectPromptTemplate}
            onUploadSubtitle={handleUploadSubtitle}
            onDeleteSubtitle={handleDeleteSubtitle}
            onUploadAudio={handleUploadAudio}
            onUploadAudios={handleUploadAudios}
            onDeleteUploadedAudios={handleDeleteUploadedAudios}
          />
        )}

        {currentStep === 1 && (
          <CharacterManager
            projectId={id || ''}
            characters={project.characters}
            onExtractCharacters={handleExtractCharacters}
            extractingCharacters={extractingCharacters}
            onOpenPromptManager={(type) => {
              setProjectPromptManagerType(type);
              setShowProjectPromptManager(true);
            }}
            onUpdateCharacter={() => Promise.resolve()}
            onSaveCharacter={handleSaveCharacter}
            savingCharacter={savingCharacter}
            tempCharacter={tempCharacter}
            onTempCharacterChange={handleTempCharacterChange}
            onCharacterTestImage={handleCharacterTestImage}
            onSaveCharacterTts={handleSaveCharacterTts}
            savingCharacterTts={savingCharacterTts}
            tempCharacterTts={tempCharacterTts}
            onTempCharacterTtsChange={handleTempCharacterTtsChange}
          />
        )}

        {currentStep === 2 && (
          <SceneManager
            projectId={id || ''}
            scenes={project.scenes || []}
            onExtractScenes={handleExtractScenes}
            extractingScenes={extractingScenes}
            onOpenPromptManager={(type) => {
              setProjectPromptManagerType(type);
              setShowProjectPromptManager(true);
            }}
            onSaveScene={handleSaveScene}
            savingScene={savingScene}
            tempScene={tempScene}
            onTempSceneChange={handleTempSceneChange}
            onDeleteScene={handleDeleteScene}
          />
        )}

        {currentStep === 3 && (
          <StoryboardSplitter
            projectId={id || ''}
            storyboards={project.storyboards}
            characters={project.characters}
            scenes={project.scenes || []}
            onSplitStoryboard={handleSplitStoryboard}
            splittingStoryboards={splittingStoryboards}
            splitProgress={splitProgress}
            splitStatusText={splitStatusText}
            onStoryboardSceneChange={handleStoryboardSceneChange}
            onStoryboardCharactersChange={handleStoryboardCharactersChange}
          />
        )}

        {currentStep === 4 && (
          <StoryboardPromptInference
            projectId={id || ''}
            storyboards={project.storyboards}
            characters={project.characters}
            scenes={project.scenes || []}
            onGeneratePrompts={handleInferenceGeneratePrompts}
            generatingPrompts={generatingPrompts}
            onUpdatePrompt={handleUpdatePrompt}
            savingPrompt={savingPrompt}
            editingPrompt={editingPrompt}
            onEditPromptChange={handleEditPromptChange}
          />
        )}

        {currentStep === 5 && (
          <StoryboardImageGeneration
            projectId={id || ''}
            storyboards={project.storyboards}
            characters={project.characters}
            scenes={project.scenes || []}
            imagePromptTemplates={imagePromptTemplates}
            onGenerateImages={handleGenerateImages}
            onGenerateSingleImage={handleGenerateSingleImage}
            onUseTemplate={handleImageUseTemplate}
            generating={loading || polling}
            generationStatus={generationStatus?.images}
            polling={polling}
            stylePrompt={project.stylePrompt || ''}
          />
        )}

        {currentStep === 6 && (
          <div>
            <AudioGenerator
              projectId={id || ''}
              storyboards={project.storyboards}
              characters={project.characters}
              polling={polling}
              generationStatus={generationStatus?.audio}
              onGenerateAudios={handleGenerateAudios}
              onGenerateSingleAudio={handleGenerateSingleAudio}
              onStoryboardVoiceChange={handleStoryboardVoiceChange}
            />
            <JianyingExporter
              projectId={id || ''}
              storyboards={project.storyboards}
              exportingJianying={exportingJianying}
              exportResult={exportResult}
              onExportJianying={handleExportJianying}
            />
          </div>
        )}
      </div>

      <CharacterTestImageModal
        isOpen={!!showCharacterTestImage}
        onClose={() => {
          setShowCharacterTestImage(null);
          setCharacterTestImageUrl(null);
        }}
        characterTestImagePrompt={characterTestImagePrompt}
        onCharacterTestImagePromptChange={setCharacterTestImagePrompt}
        characterTestImageUrl={characterTestImageUrl}
        characterTestImageLoading={characterTestImageLoading}
        onGenerateCharacterTestImage={handleGenerateCharacterTestImage}
        onCharacterTestImageError={handleCharacterTestImageError}
      />

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
