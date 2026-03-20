import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  projectApi,
  characterApi,
  storyboardApi,
  generationApi,
  promptApi,
  type Project,
  type PromptTemplate,
  type PromptType,
} from '../services/api';

const ProjectEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [savingProjectSettings, setSavingProjectSettings] = useState(false);
  const [linesPerStoryboard, setLinesPerStoryboard] = useState(1);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<{ [key: string]: string }>({});
  const [savingPrompt, setSavingPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadProject();
      loadPromptTemplates();
    }
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
      setProject(response.data);
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
    } catch (error) {
      console.error('Failed to check status:', error);
    }
  };

  const handleExtractCharacters = async () => {
    if (!id) return;
    try {
      await characterApi.extract(id);
      await loadProject();
    } catch (error) {
      console.error('Failed to extract characters:', error);
    }
  };

  const handleSplitStoryboard = async () => {
    if (!id) return;
    try {
      await storyboardApi.split(id, linesPerStoryboard);
      await loadProject();
    } catch (error) {
      console.error('Failed to split storyboard:', error);
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

  const steps = [
    { name: '角色管理', onClick: () => setCurrentStep(0) },
    { name: '剧本拆分', onClick: () => setCurrentStep(1) },
    { name: '图片生成', onClick: () => setCurrentStep(2) },
    { name: '配音生成', onClick: () => setCurrentStep(3) },
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
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
              >
                自动提取角色
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
                      <h5 className="font-medium text-sm">声音配置</h5>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">声音</label>
                        <select
                          value={char.ttsConfig?.voice || 'zh-CN-XiaoxiaoNeural'}
                          onChange={(e) => {
                            const newTtsConfig = {
                              voice: e.target.value,
                              rate: char.ttsConfig?.rate || 1.0,
                              pitch: char.ttsConfig?.pitch || 0
                            };
                            setProject({
                              ...project,
                              characters: project.characters.map(c =>
                                c.id === char.id
                                  ? { ...c, ttsConfig: newTtsConfig }
                                  : c
                              )
                            });
                          }}
                          className="w-full border rounded-md px-3 py-2"
                        >
                          <option value="zh-CN-XiaoxiaoNeural">zh-CN-XiaoxiaoNeural (女声)</option>
                          <option value="zh-CN-YunxiNeural">zh-CN-YunxiNeural (男声)</option>
                          <option value="zh-CN-YunyangNeural">zh-CN-YunyangNeural (男声)</option>
                          <option value="zh-CN-XiaoyouNeural">zh-CN-XiaoyouNeural (童声)</option>
                          <option value="zh-CN-XiaohanNeural">zh-CN-XiaohanNeural (女声)</option>
                          <option value="zh-CN-YunjianNeural">zh-CN-YunjianNeural (男声)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          语速: {(char.ttsConfig?.rate || 1.0).toFixed(1)}x
                        </label>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={char.ttsConfig?.rate || 1.0}
                          onChange={(e) => {
                            const newTtsConfig = {
                              voice: char.ttsConfig?.voice || 'zh-CN-XiaoxiaoNeural',
                              rate: parseFloat(e.target.value),
                              pitch: char.ttsConfig?.pitch || 0
                            };
                            setProject({
                              ...project,
                              characters: project.characters.map(c =>
                                c.id === char.id
                                  ? { ...c, ttsConfig: newTtsConfig }
                                  : c
                              )
                            });
                          }}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          音调: {char.ttsConfig?.pitch || 0}Hz
                        </label>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          step="1"
                          value={char.ttsConfig?.pitch || 0}
                          onChange={(e) => {
                            const newTtsConfig = {
                              voice: char.ttsConfig?.voice || 'zh-CN-XiaoxiaoNeural',
                              rate: char.ttsConfig?.rate || 1.0,
                              pitch: parseInt(e.target.value)
                            };
                            setProject({
                              ...project,
                              characters: project.characters.map(c =>
                                c.id === char.id
                                  ? { ...c, ttsConfig: newTtsConfig }
                                  : c
                              )
                            });
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
              <h3 className="text-lg font-semibold">分镜列表 ({project.storyboards.length})</h3>
              <div className="flex items-center gap-2">
                <select
                  value={linesPerStoryboard}
                  onChange={(e) => setLinesPerStoryboard(parseInt(e.target.value))}
                  className="border rounded-md px-3 py-2 text-sm"
                >
                  <option value={1}>1行/分镜</option>
                  <option value={2}>2行/分镜</option>
                  <option value={3}>3行/分镜</option>
                </select>
                <button
                  onClick={handleSplitStoryboard}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  自动拆分剧本
                </button>
              </div>
            </div>
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
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium text-gray-700">画图提示词</label>
                      <div className="flex items-center gap-2">
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

        {currentStep === 2 && (
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

        {currentStep === 3 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">配音生成</h3>
              <button
                onClick={handleGenerateAudios}
                disabled={polling}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {polling ? '生成中...' : '批量生成配音'}
              </button>
            </div>
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
                    {sb.audioStatus === 'completed' && sb.audioPath ? (
                      <audio controls className="h-8 flex-1">
                        <source src={`/data/projects/${id}/${sb.audioPath}`} />
                      </audio>
                    ) : (
                      <div className="flex-1" />
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
      </div>
    </div>
  );
};

export default ProjectEditor;
