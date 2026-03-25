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
  type Project,
  type PromptTemplate,
  type PromptType,
  type ImagePromptTemplate,
  type Character,
  type Scene,
} from '../services/api';
import { TTS_VOICES } from '../constants/ttsVoices';

const ProjectEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (id) {
      loadProject();
      loadPromptTemplates();
      loadImagePromptTemplates();
    } else {
      setLoading(false);
    }
    // 最终安全措施：3秒后强制关闭 loading
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(safetyTimer);
  }, [id]);

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
        }))
      };
      setProject(projectData);
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
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

  const steps = [
    { name: '角色管理', onClick: () => setCurrentStep(0) },
    { name: '场景管理', onClick: () => setCurrentStep(1) },
    { name: '剧本拆分', onClick: () => setCurrentStep(2) },
    { name: '图片生成', onClick: () => setCurrentStep(3) },
    { name: '配音生成', onClick: () => setCurrentStep(4) },
    { name: '导出剪映', onClick: () => setCurrentStep(5) },
  ];

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!project) {
    return <div>项目未找到</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <button
            onClick={() => navigate('/')}
            className="text-blue-500 hover:text-blue-600 mr-4"
          >
            ← 返回
          </button>
          <h2 className="text-2xl font-bold inline">{project.name}</h2>
        </div>
        <button
          onClick={() => setShowProjectSettings(!showProjectSettings)}
          className="text-gray-600 hover:text-gray-800 text-sm"
        >
          {showProjectSettings ? '收起设置' : '项目设置'}
        </button>
      </div>

      {showProjectSettings && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">项目 Prompt 模板</h3>
            <a
              href="/prompts"
              className="text-blue-500 hover:text-blue-600 text-sm"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                  </label>
                  <select
                    value={project.projectPromptTemplates?.[type] || ''}
                    onChange={(e) => handleUpdateProjectPromptTemplate(type, e.target.value)}
                    disabled={savingProjectSettings}
                    className="w-full border rounded-md px-3 py-2 disabled:opacity-50"
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
      )}

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="flex border-b">
          {steps.map((step, index) => (
            <button
              key={index}
              onClick={step.onClick}
              className={`px-6 py-4 font-medium ${
                currentStep === index
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {step.name}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {currentStep === 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">角色列表</h3>
              <button
                onClick={handleExtractCharacters}
                disabled={extractingCharacters}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {extractingCharacters ? '提取中...' : '自动提取角色'}
              </button>
            </div>
            <div className="space-y-4">
              {project.characters.map((char) => (
                <div key={char.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">{char.name}</h4>
                    <button
                      onClick={() => setEditingCharacterId(
                        editingCharacterId === char.id ? null : char.id
                      )}
                      className="text-blue-500 text-sm hover:text-blue-600"
                    >
                      {editingCharacterId === char.id ? '收起' : '编辑声音'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">{char.description}</p>

                  {editingCharacterId === char.id && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      <div className="flex justify-between items-center">
                        <h5 className="font-medium text-sm">声音配置</h5>
                        <button
                          onClick={() => handleSaveCharacterTts(char.id)}
                          disabled={savingCharacterTts === char.id || !tempCharacterTts[char.id]}
                          className={`px-4 py-2 rounded-md text-sm font-medium ${
                            savingCharacterTts === char.id || !tempCharacterTts[char.id]
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-blue-500 text-white hover:bg-blue-600'
                          }`}
                        >
                          {savingCharacterTts === char.id ? '保存中...' : '保存'}
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">声音</label>
                        <select
                          value={tempCharacterTts[char.id]?.voice || char.ttsConfig?.voice || 'zh-CN-XiaoxiaoNeural'}
                          onChange={(e) => {
                            handleTempCharacterTtsChange(char.id, 'voice', e.target.value);
                          }}
                          className="w-full border rounded-md px-3 py-2"
                        >
                          {TTS_VOICES.map((voice) => (
                            <option key={voice.value} value={voice.value}>
                              {voice.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    </div>
                  )}
                </div>
              ))}
              {project.characters.length === 0 && (
                <p className="text-gray-500">还没有角色，点击上方按钮自动提取</p>
              )}
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">场景列表</h3>
              <button
                onClick={handleExtractScenes}
                disabled={extractingScenes}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {extractingScenes ? '提取中...' : '自动提取场景'}
              </button>
            </div>
            <div className="space-y-4">
              {(project.scenes || []).map((scene) => (
                <div key={scene.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">{scene.name}</h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingSceneId(
                          editingSceneId === scene.id ? null : scene.id
                        )}
                        className="text-blue-500 text-sm hover:text-blue-600"
                      >
                        {editingSceneId === scene.id ? '收起' : '编辑'}
                      </button>
                      <button
                        onClick={() => handleDeleteScene(scene.id)}
                        className="text-red-500 text-sm hover:text-red-600"
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  {editingSceneId === scene.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">场景名称</label>
                        <input
                          type="text"
                          value={tempScene[scene.id]?.name ?? scene.name}
                          onChange={(e) => handleTempSceneChange(scene.id, 'name', e.target.value)}
                          className="w-full border rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">场景描述</label>
                        <textarea
                          value={tempScene[scene.id]?.description ?? scene.description}
                          onChange={(e) => handleTempSceneChange(scene.id, 'description', e.target.value)}
                          className="w-full border rounded-md px-3 py-2"
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleSaveScene(scene.id)}
                          disabled={savingScene === scene.id}
                          className={`px-4 py-2 rounded-md text-sm font-medium ${
                            savingScene === scene.id
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-blue-500 text-white hover:bg-blue-600'
                          }`}
                        >
                          {savingScene === scene.id ? '保存中...' : '保存'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">{scene.description}</p>
                  )}
                </div>
              ))}
              {(!project.scenes || project.scenes.length === 0) && (
                <p className="text-gray-500">还没有场景，点击上方按钮自动提取</p>
              )}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">分镜列表 ({project.storyboards.length})</h3>
              <div className="flex items-center gap-2">
                <select
                  value={linesPerStoryboard}
                  onChange={(e) => setLinesPerStoryboard(parseInt(e.target.value))}
                  disabled={splittingStoryboards || generatingPrompts}
                  className="border rounded-md px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value={1}>1行/分镜</option>
                  <option value={2}>2行/分镜</option>
                  <option value={3}>3行/分镜</option>
                </select>
                <button
                  onClick={handleSplitStoryboard}
                  disabled={splittingStoryboards || generatingPrompts}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {splittingStoryboards ? '正在拆分分镜...' : '自动拆分剧本'}
                </button>
                {project.storyboards.length > 0 && (
                  <button
                    onClick={handleGeneratePrompts}
                    disabled={splittingStoryboards || generatingPrompts}
                    className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingPrompts ? '生成中...' : '批量生成提示词'}
                  </button>
                )}
              </div>
            </div>
            {(splittingStoryboards || generatingPrompts) && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
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
                <div key={sb.id} className="border rounded-lg p-4">
                  <div className="flex justify-between">
                    <span className="font-semibold">分镜 {sb.index + 1}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{sb.sceneDescription}</p>
                  {sb.dialogue && (
                    <p className="text-sm text-blue-600 mt-1">台词: {sb.dialogue}</p>
                  )}
                  {sb.narration && (
                    <p className="text-sm text-green-600 mt-1">旁白: {sb.narration}</p>
                  )}

                  {/* 场景选择 */}
                  <div className="mt-3">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">关联场景</label>
                    <select
                      value={sb.sceneId || ''}
                      onChange={(e) => handleStoryboardSceneChange(sb.id, e.target.value || null)}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">-- 无场景 --</option>
                      {(project.scenes || []).map((scene) => (
                        <option key={scene.id} value={scene.id}>
                          {scene.name}
                        </option>
                      ))}
                    </select>
                    {sb.sceneId && (
                      <p className="text-xs text-gray-500 mt-1">
                        {(project.scenes || []).find(s => s.id === sb.sceneId)?.description}
                      </p>
                    )}
                  </div>

                  {/* 角色选择 */}
                  <div className="mt-3">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">关联角色</label>
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
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                      <label className="text-sm font-medium text-gray-700">画图提示词</label>
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
                          <span className="text-xs text-gray-400">保存中...</span>
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
                        className="w-full border rounded-md px-3 py-2 text-sm font-mono disabled:opacity-50"
                        rows={4}
                        disabled={savingPrompt === sb.id}
                      />
                    ) : (
                      sb.imagePrompt && (
                        <p className="text-xs text-gray-500 truncate">{sb.imagePrompt}</p>
                      )
                    )}
                  </div>
                </div>
              ))}
              {project.storyboards.length === 0 && (
                <p className="text-gray-500">还没有分镜，点击上方按钮自动拆分</p>
              )}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">图片生成</h3>
              <button
                onClick={handleGenerateImages}
                disabled={polling}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {polling ? '生成中...' : '批量生成图片'}
              </button>
            </div>
            {polling && generationStatus?.images && generationStatus.images.total > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>图片生成进度</span>
                  <span>{generationStatus.images.completed}/{generationStatus.images.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((generationStatus.images.completed / generationStatus.images.total) * 100)}%` }}
                  ></div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-4 gap-4">
              {project.storyboards.map((sb) => (
                <div key={sb.id} className="border rounded-lg p-2">
                  <div className="text-xs text-gray-500 mb-1">分镜 {sb.index + 1}</div>
                  {sb.imageStatus === 'completed' && sb.imagePath ? (
                    <img
                      src={`/data/projects/${id}/${sb.imagePath}`}
                      alt=""
                      className="w-full h-32 object-cover rounded"
                    />
                  ) : (
                    <div className="w-full h-32 bg-gray-100 rounded flex items-center justify-center">
                      <span className="text-sm text-gray-400">
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

        {currentStep === 4 && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <h3 className="text-lg font-semibold">配音生成</h3>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">批量设置音色:</label>
                  <select
                    value={bulkVoice}
                    onChange={(e) => setBulkVoice(e.target.value)}
                    className="border rounded-md px-3 py-2 text-sm"
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
                  className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 disabled:opacity-50 text-sm"
                >
                  应用到所有分镜
                </button>
                <button
                  onClick={handleGenerateAudios}
                  disabled={polling}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {polling ? '生成中...' : '批量生成配音'}
                </button>
              </div>
            </div>
            {polling && generationStatus?.audio && generationStatus.audio.total > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>配音生成进度</span>
                  <span>{generationStatus.audio.completed}/{generationStatus.audio.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((generationStatus.audio.completed / generationStatus.audio.total) * 100)}%` }}
                  ></div>
                </div>
              </div>
            )}
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {project.storyboards.map((sb) => (
                <div key={sb.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold">分镜 {sb.index + 1}</span>
                    <div className="flex items-center gap-2">
                      {sb.audioDuration > 0 && (
                        <span className="text-sm text-gray-500">
                          ({sb.audioDuration.toFixed(1)}秒)
                        </span>
                      )}
                      <span className={`text-sm px-2 py-1 rounded ${
                        sb.audioStatus === 'completed' ? 'bg-green-100 text-green-700' :
                        sb.audioStatus === 'generating' ? 'bg-blue-100 text-blue-700' :
                        sb.audioStatus === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {sb.audioStatus === 'completed' ? '已完成' :
                         sb.audioStatus === 'generating' ? '生成中' :
                         sb.audioStatus === 'failed' ? '失败' : '待生成'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{sb.sceneDescription}</p>
                  {sb.narration && (
                    <p className="text-sm text-green-600 mb-1">
                      <span className="font-medium">旁白:</span> {sb.narration}
                    </p>
                  )}
                  {sb.dialogue && (
                    <p className="text-sm text-blue-600 mb-2">
                      <span className="font-medium">台词:</span> {sb.dialogue}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 flex-1">
                      <label className="text-xs font-medium text-gray-600">音色:</label>
                      <select
                        value={sb.ttsConfig?.voice || ''}
                        onChange={(e) => handleStoryboardVoiceChange(sb.id, e.target.value)}
                        className="border rounded px-2 py-1 text-xs flex-1"
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
                      <audio controls className="h-12 w-64">
                        <source src={`/data/projects/${id}/${sb.audioPath}`} />
                      </audio>
                    ) : (
                      <div className="text-xs text-gray-400 w-48">
                        状态: {sb.audioStatus}
                      </div>
                    )}
                    {sb.audioStatus !== 'generating' && (
                      <button
                        onClick={() => handleGenerateSingleAudio(sb.id)}
                        className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
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

        {currentStep === 5 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">导出剪映草稿</h3>
              <button
                onClick={handleExportJianying}
                disabled={exportingJianying}
                className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 disabled:opacity-50"
              >
                {exportingJianying ? '导出中...' : '导出到剪映'}
              </button>
            </div>

            {exportResult && (
              <div className={`mb-6 p-4 rounded-md ${exportResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <pre className="whitespace-pre-wrap text-sm">{exportResult.message}</pre>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="font-medium mb-4">导出说明</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• 将项目中的所有图片和音频导出为剪映草稿</li>
                <li>• 图片和音频会自动放置在对应的轨道上</li>
                <li>• 每个分镜的时长根据音频长度自动设置</li>
                <li>• 导出前请确保已配置剪映草稿保存路径（在设置页面）</li>
                <li>• 导出后可以在剪映中打开草稿进行进一步编辑</li>
              </ul>
            </div>

            <div className="mt-6">
              <h4 className="font-medium mb-4">项目预览 ({project.storyboards.length} 个分镜)</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {project.storyboards.map((sb) => (
                  <div key={sb.id} className="flex items-center gap-4 border rounded-lg p-3">
                    <div className="w-24 h-16 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                      {sb.imageStatus === 'completed' && sb.imagePath ? (
                        <img
                          src={`/data/projects/${id}/${sb.imagePath}`}
                          alt=""
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <span className="text-xs text-gray-400">
                          {sb.imageStatus === 'generating' ? '生成中' :
                           sb.imageStatus === 'failed' ? '失败' : '无图'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">分镜 {sb.index + 1}</div>
                      <p className="text-xs text-gray-500 truncate">{sb.sceneDescription}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {sb.audioStatus === 'completed' && sb.audioDuration > 0 && (
                        <span className="text-xs text-gray-500">
                          {sb.audioDuration.toFixed(1)}s
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded ${
                        sb.audioStatus === 'completed' && sb.imageStatus === 'completed' ? 'bg-green-100 text-green-700' :
                        'bg-yellow-100 text-yellow-700'
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
    </div>
  );
};

export default ProjectEditor;
