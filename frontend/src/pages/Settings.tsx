import React, { useEffect, useState } from 'react';
import { settingsApi, comfyuiWorkflowApi, promptApi, type GlobalSettings, type ComfyUIWorkflow, type ComfyUINodeInfo, type ComfyUINodeMappings, type ComfyUIWorkflowParams, type PromptTemplate } from '../services/api';

function NodeMappingField({
  label,
  nodeId,
  fieldName,
  nodes,
  onNodeChange,
  onFieldChange,
  extraFields,
}: {
  label: string;
  nodeId?: string;
  fieldName: string;
  nodes: ComfyUINodeInfo[];
  onNodeChange: (id: string) => void;
  onFieldChange: (field: string) => void;
  extraFields?: Array<{ label: string; value: string; onChange: (v: string) => void }>;
}) {
  const selectedNode = nodes.find((n) => n.id === nodeId);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={nodeId || ''}
          onChange={(e) => onNodeChange(e.target.value)}
          className="border rounded-md px-3 py-2"
        >
          <option value="">-- 选择节点 --</option>
          {nodes.map((node) => {
            let displayText = node.classType + ' (' + node.id + ')';
            if (node.title) {
              displayText = node.title + ' - ' + displayText;
            }
            return (
              <option key={node.id} value={node.id}>
                {displayText}
              </option>
            );
          })}
        </select>
        <select
          value={fieldName}
          onChange={(e) => onFieldChange(e.target.value)}
          disabled={!selectedNode}
          className="border rounded-md px-3 py-2 disabled:opacity-50"
        >
          <option value="">-- 选择字段 --</option>
          {selectedNode?.fields.map((field) => (
            <option key={field} value={field}>
              {field}
            </option>
          ))}
        </select>
      </div>
      {extraFields && selectedNode && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {extraFields.map((ef) => (
            <div key={ef.label}>
              <label className="block text-xs text-gray-500 mb-1">{ef.label}</label>
              <select
                value={ef.value}
                onChange={(e) => ef.onChange(e.target.value)}
                className="w-full border rounded-md px-2 py-1 text-sm"
              >
                {selectedNode.fields.map((field) => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<GlobalSettings>({
    defaultPromptTemplates: {},
    comfyui: { apiUrl: '', timeout: 300, maxRetries: 3, concurrentLimit: 3 },
    llm: {
      provider: 'ollama',
      ollama: { apiUrl: '', model: 'llama3', timeout: 120, maxRetries: 2, chunkSize: 4000 },
      openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', timeout: 120, maxRetries: 2, chunkSize: 4000, proxy: '' }
    },
    ollama: { apiUrl: '', model: 'llama3', timeout: 120, maxRetries: 2, chunkSize: 4000 },
    tts: { azureKey: '', azureRegion: '', voice: 'zh-CN-XiaoxiaoNeural', rate: 1.0, pitch: 0, timeout: 60, maxRetries: 3, concurrentLimit: 5 },
    // jianying: { canvasWidth: 1920, canvasHeight: 1080, canvasRatio: '16:9' },
  });
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingTTS, setTestingTTS] = useState(false);
  const [ttsTestResult, setTtsTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [workflows, setWorkflows] = useState<ComfyUIWorkflow[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<ComfyUIWorkflow | null>(null);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowFile, setWorkflowFile] = useState<File | null>(null);
  const [workflowJson, setWorkflowJson] = useState<Record<string, any> | null>(null);
  const [parsedNodes, setParsedNodes] = useState<ComfyUINodeInfo[]>([]);
  const [nodeMappings, setNodeMappings] = useState<ComfyUINodeMappings>({
    positivePromptField: 'text',
    negativePromptField: 'text',
    widthField: 'width',
    heightField: 'height',
    samplerField: 'sampler_name',
    stepsField: 'steps',
    cfgField: 'cfg',
    seedField: 'seed',
    batchSizeField: 'batch_size',
  });
  const [defaultParams, setDefaultParams] = useState<ComfyUIWorkflowParams>({
    width: 1280,
    height: 960,
    steps: 30,
    cfg: 7.0,
    samplerName: null,
    seed: 0,
    batchSize: 1,
    positivePromptPrefix: '',
    positivePromptSuffix: '',
    negativePromptOverride: null,
  });

  useEffect(() => {
    loadSettings();
    loadWorkflows();
    loadPromptTemplates();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await settingsApi.get();
      const loadedSettings = response.data;
      if (!loadedSettings.llm) {
        loadedSettings.llm = {
          provider: 'ollama',
          ollama: loadedSettings.ollama || { apiUrl: '', model: 'llama3', timeout: 120, maxRetries: 2, chunkSize: 4000 },
          openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', timeout: 120, maxRetries: 2, chunkSize: 4000, proxy: '' }
        };
      }
      if (!loadedSettings.defaultPromptTemplates) {
        loadedSettings.defaultPromptTemplates = {};
      }
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
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

  const loadWorkflows = async () => {
    try {
      const response = await comfyuiWorkflowApi.list();
      setWorkflows(response.data);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  };

  const handleSave = async () => {
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

  const handleTestLLM = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await settingsApi.testLLM();

      clearTimeout(timeoutId);

      if (response.data.success) {
        setTestResult({
          success: true,
          message: `连接成功！\n提供商: ${response.data.provider}\n回复: ${response.data.response}`
        });
      } else {
        setTestResult({
          success: false,
          message: `连接失败！\n提供商: ${response.data.provider}\n错误: ${response.data.error || '未知错误'}`
        });
      }
    } catch (error: any) {
      console.error('Test error:', error);
      let errorMsg = '测试失败';
      if (error.code === 'ERR_CANCELED') {
        errorMsg = '请求超时，请检查网络连接和 API 配置';
      } else if (error.message) {
        errorMsg = error.message;
      } else if (error.response) {
        errorMsg = `服务器错误: ${error.response.status}`;
      }
      setTestResult({
        success: false,
        message: errorMsg
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestTTS = async () => {
    setTestingTTS(true);
    setTtsTestResult(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await settingsApi.testTTS();

      clearTimeout(timeoutId);

      if (response.data.success) {
        setTtsTestResult({
          success: true,
          message: `连接成功！\n声音: ${response.data.voice}\n时长: ${response.data.duration.toFixed(2)}秒\n音频大小: ${response.data.audioSize}字节`
        });
      } else {
        setTtsTestResult({
          success: false,
          message: `连接失败！\n声音: ${response.data.voice}\n错误: ${response.data.error || '未知错误'}`
        });
      }
    } catch (error: any) {
      console.error('Test error:', error);
      let errorMsg = '测试失败';
      if (error.code === 'ERR_CANCELED') {
        errorMsg = '请求超时，请检查网络连接和 API 配置';
      } else if (error.message) {
        errorMsg = error.message;
      } else if (error.response) {
        errorMsg = `服务器错误: ${error.response.status}`;
      }
      setTtsTestResult({
        success: false,
        message: errorMsg
      });
    } finally {
      setTestingTTS(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setWorkflowFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          setWorkflowJson(json);
        } catch (err) {
          alert('无效的 JSON 文件');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSetActive = async (workflowId: string) => {
    try {
      const response = await comfyuiWorkflowApi.setActive(workflowId);
      setSettings(response.data);
      await loadWorkflows();
    } catch (error) {
      console.error('Failed to set active workflow:', error);
      alert('设置激活工作流失败');
    }
  };

  const handleEditWorkflow = (workflow: ComfyUIWorkflow) => {
    setEditingWorkflow(workflow);
    setWorkflowName(workflow.name);
    setNodeMappings(workflow.nodeMappings);
    setDefaultParams(workflow.defaultParams || {
      width: 1280,
      height: 960,
      steps: 30,
      cfg: 7.0,
      samplerName: null,
      seed: 0,
      batchSize: 1,
      positivePromptPrefix: '',
      positivePromptSuffix: '',
      negativePromptOverride: null,
    });
    parseAndSetNodes(workflow);
    setShowUploadModal(true);
  };

  const parseAndSetNodes = async (workflow: ComfyUIWorkflow) => {
    try {
      const response = await comfyuiWorkflowApi.parse(workflow.id);
      setParsedNodes(response.data.nodes);
    } catch (error) {
      console.error('Failed to parse workflow:', error);
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm('确定要删除这个工作流吗？')) return;
    try {
      await comfyuiWorkflowApi.delete(workflowId);
      await loadWorkflows();
      await loadSettings();
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      alert('删除工作流失败');
    }
  };

  const handleSaveWorkflow = async () => {
    try {
      if (editingWorkflow) {
        await comfyuiWorkflowApi.update(editingWorkflow.id, {
          name: workflowName,
          nodeMappings,
          defaultParams,
        });
      } else if (workflowJson) {
        const newWorkflow = await comfyuiWorkflowApi.create(workflowName || '未命名工作流', workflowJson);
        await comfyuiWorkflowApi.update(newWorkflow.data.id, { nodeMappings, defaultParams });
        await parseAndSetNodes(newWorkflow.data);
      }
      await loadWorkflows();
      setShowUploadModal(false);
      resetUploadForm();
    } catch (error) {
      console.error('Failed to save workflow:', error);
      alert('保存工作流失败');
    }
  };

  const resetUploadForm = () => {
    setEditingWorkflow(null);
    setWorkflowName('');
    setWorkflowFile(null);
    setWorkflowJson(null);
    setParsedNodes([]);
    setNodeMappings({
      positivePromptField: 'text',
      negativePromptField: 'text',
      widthField: 'width',
      heightField: 'height',
      samplerField: 'sampler_name',
      stepsField: 'steps',
      cfgField: 'cfg',
      seedField: 'seed',
      batchSizeField: 'batch_size',
    });
    setDefaultParams({
      width: 1280,
      height: 960,
      steps: 30,
      cfg: 7.0,
      samplerName: null,
      seed: 0,
      batchSize: 1,
      positivePromptPrefix: '',
      positivePromptSuffix: '',
      negativePromptOverride: null,
    });
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">设置</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">大模型设置</h3>
            <button
              onClick={handleTestLLM}
              disabled={testing}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50 text-sm"
            >
              {testing ? '测试中...' : '测试连接'}
            </button>
          </div>
          {testResult && (
            <div className={`mb-4 p-4 rounded-md ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <pre className="whitespace-pre-wrap text-sm">{testResult.message}</pre>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LLM 提供商</label>
              <select
                value={settings.llm.provider}
                onChange={(e) => setSettings({
                  ...settings,
                  llm: { ...settings.llm, provider: e.target.value as 'ollama' | 'openai' }
                })}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="ollama">Ollama (本地/云端)</option>
                <option value="openai">OpenAI / 兼容 API</option>
              </select>
            </div>
          </div>
        </div>

        {settings.llm.provider === 'ollama' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Ollama 设置</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API 地址</label>
                <input
                  type="text"
                  value={settings.llm.ollama.apiUrl}
                  onChange={(e) => setSettings({
                    ...settings,
                    llm: { ...settings.llm, ollama: { ...settings.llm.ollama, apiUrl: e.target.value } }
                  })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="http://localhost:11434"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模型</label>
                <input
                  type="text"
                  value={settings.llm.ollama.model}
                  onChange={(e) => setSettings({
                    ...settings,
                    llm: { ...settings.llm, ollama: { ...settings.llm.ollama, model: e.target.value } }
                  })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="llama3"
                />
              </div>
            </div>
          </div>
        )}

        {settings.llm.provider === 'openai' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">OpenAI / 兼容 API 设置</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={settings.llm.openai.apiKey}
                  onChange={(e) => setSettings({
                    ...settings,
                    llm: { ...settings.llm, openai: { ...settings.llm.openai, apiKey: e.target.value } }
                  })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
                <input
                  type="text"
                  value={settings.llm.openai.baseUrl}
                  onChange={(e) => setSettings({
                    ...settings,
                    llm: { ...settings.llm, openai: { ...settings.llm.openai, baseUrl: e.target.value } }
                  })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模型</label>
                <input
                  type="text"
                  value={settings.llm.openai.model}
                  onChange={(e) => setSettings({
                    ...settings,
                    llm: { ...settings.llm, openai: { ...settings.llm.openai, model: e.target.value } }
                  })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="gpt-4o"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">代理（可选）</label>
                <input
                  type="text"
                  value={settings.llm.openai.proxy}
                  onChange={(e) => setSettings({
                    ...settings,
                    llm: { ...settings.llm, openai: { ...settings.llm.openai, proxy: e.target.value } }
                  })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="http://127.0.0.1:7897"
                />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">ComfyUI 工作流管理</h3>
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 text-sm"
            >
              上传工作流
            </button>
          </div>

          {workflows.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>还没有上传工作流</p>
              <p className="text-sm mt-2">点击上方按钮上传 ComfyUI 工作流（API 格式）</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className={`border rounded-lg p-4 ${
                    settings.comfyui.activeWorkflowId === workflow.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">
                        {workflow.name}
                        {settings.comfyui.activeWorkflowId === workflow.id && (
                          <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                            激活中
                          </span>
                        )}
                      </h4>
                      <p className="text-sm text-gray-500">
                        创建于: {new Date(workflow.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {settings.comfyui.activeWorkflowId !== workflow.id && (
                        <button
                          onClick={() => handleSetActive(workflow.id)}
                          className="text-green-600 hover:text-green-800 text-sm"
                        >
                          设为激活
                        </button>
                      )}
                      <button
                        onClick={() => handleEditWorkflow(workflow)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">ComfyUI 设置</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API 地址</label>
              <input
                type="text"
                value={settings.comfyui.apiUrl}
                onChange={(e) => setSettings({...settings, comfyui: {...settings.comfyui, apiUrl: e.target.value}})}
                className="w-full border rounded-md px-3 py-2"
                placeholder="http://localhost:8188"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">默认 Prompt 模板</h3>
            <a
              href="/prompts"
              className="text-blue-500 hover:text-blue-600 text-sm"
            >
              管理模板 →
            </a>
          </div>
          <div className="space-y-4">
            {[
              { key: 'character_extraction' as const, label: '角色提取' },
              { key: 'image_prompt' as const, label: '图像生成' },
            ].map(({ key: type, label }) => {
              const templatesByType = promptTemplates.filter(t => t.type === type);
              return (
                <div key={type}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                  </label>
                  <select
                    value={settings.defaultPromptTemplates[type] || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      defaultPromptTemplates: {
                        ...settings.defaultPromptTemplates,
                        [type]: e.target.value
                      }
                    })}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="">-- 选择模板 --</option>
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

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">微软 TTS 设置</h3>
            <button
              onClick={handleTestTTS}
              disabled={testingTTS}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50 text-sm"
            >
              {testingTTS ? '测试中...' : '测试连接'}
            </button>
          </div>
          {ttsTestResult && (
            <div className={`mb-4 p-4 rounded-md ${ttsTestResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <pre className="whitespace-pre-wrap text-sm">{ttsTestResult.message}</pre>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Key</label>
              <input
                type="password"
                value={settings.tts.azureKey || ''}
                onChange={(e) => setSettings({...settings, tts: {...settings.tts, azureKey: e.target.value}})}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
              <input
                type="text"
                value={settings.tts.azureRegion || ''}
                onChange={(e) => setSettings({...settings, tts: {...settings.tts, azureRegion: e.target.value}})}
                className="w-full border rounded-md px-3 py-2"
                placeholder="eastasia"
              />
            </div>
          </div>
        </div>
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {editingWorkflow ? '编辑工作流' : '上传工作流'}
            </h3>

            {!editingWorkflow && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  工作流 JSON 文件
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="workflow-file"
                  />
                  <label htmlFor="workflow-file" className="cursor-pointer">
                    <div className="text-gray-500">
                      {workflowFile ? workflowFile.name : '点击选择文件，或拖拽到此处'}
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                工作流名称
              </label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
                placeholder="我的工作流"
              />
            </div>

            {parsedNodes.length > 0 && (
              <>
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-medium">节点映射配置</h4>

                  <NodeMappingField
                    label="正向提示词"
                    nodeId={nodeMappings.positivePromptNodeId}
                    fieldName={nodeMappings.positivePromptField}
                    nodes={parsedNodes}
                    onNodeChange={(id) => setNodeMappings({ ...nodeMappings, positivePromptNodeId: id })}
                    onFieldChange={(field) => setNodeMappings({ ...nodeMappings, positivePromptField: field })}
                  />

                  <NodeMappingField
                    label="否定提示词"
                    nodeId={nodeMappings.negativePromptNodeId}
                    fieldName={nodeMappings.negativePromptField}
                    nodes={parsedNodes}
                    onNodeChange={(id) => setNodeMappings({ ...nodeMappings, negativePromptNodeId: id })}
                    onFieldChange={(field) => setNodeMappings({ ...nodeMappings, negativePromptField: field })}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <NodeMappingField
                      label="宽度"
                      nodeId={nodeMappings.widthNodeId}
                      fieldName={nodeMappings.widthField}
                      nodes={parsedNodes}
                      onNodeChange={(id) => setNodeMappings({ ...nodeMappings, widthNodeId: id })}
                      onFieldChange={(field) => setNodeMappings({ ...nodeMappings, widthField: field })}
                    />
                    <NodeMappingField
                      label="高度"
                      nodeId={nodeMappings.heightNodeId}
                      fieldName={nodeMappings.heightField}
                      nodes={parsedNodes}
                      onNodeChange={(id) => setNodeMappings({ ...nodeMappings, heightNodeId: id })}
                      onFieldChange={(field) => setNodeMappings({ ...nodeMappings, heightField: field })}
                    />
                  </div>

                  <NodeMappingField
                    label="采样器（包含 steps、cfg、seed）"
                    nodeId={nodeMappings.samplerNodeId}
                    fieldName={nodeMappings.samplerField}
                    nodes={parsedNodes}
                    onNodeChange={(id) => setNodeMappings({ ...nodeMappings, samplerNodeId: id })}
                    onFieldChange={(field) => setNodeMappings({ ...nodeMappings, samplerField: field })}
                    extraFields={[
                      { label: 'Steps', value: nodeMappings.stepsField, onChange: (v) => setNodeMappings({ ...nodeMappings, stepsField: v }) },
                      { label: 'CFG', value: nodeMappings.cfgField, onChange: (v) => setNodeMappings({ ...nodeMappings, cfgField: v }) },
                      { label: 'Seed', value: nodeMappings.seedField, onChange: (v) => setNodeMappings({ ...nodeMappings, seedField: v }) },
                    ]}
                  />

                  <NodeMappingField
                    label="批次大小"
                    nodeId={nodeMappings.batchNodeId}
                    fieldName={nodeMappings.batchSizeField}
                    nodes={parsedNodes}
                    onNodeChange={(id) => setNodeMappings({ ...nodeMappings, batchNodeId: id })}
                    onFieldChange={(field) => setNodeMappings({ ...nodeMappings, batchSizeField: field })}
                  />
                </div>

                <div className="space-y-4 border-t pt-4 mt-4">
                  <h4 className="font-medium">默认参数配置</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">宽度</label>
                      <input
                        type="number"
                        value={defaultParams.width}
                        onChange={(e) => setDefaultParams({ ...defaultParams, width: parseInt(e.target.value) || 1280 })}
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">高度</label>
                      <input
                        type="number"
                        value={defaultParams.height}
                        onChange={(e) => setDefaultParams({ ...defaultParams, height: parseInt(e.target.value) || 960 })}
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Steps</label>
                      <input
                        type="number"
                        value={defaultParams.steps}
                        onChange={(e) => setDefaultParams({ ...defaultParams, steps: parseInt(e.target.value) || 30 })}
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CFG</label>
                      <input
                        type="number"
                        step="0.1"
                        value={defaultParams.cfg}
                        onChange={(e) => setDefaultParams({ ...defaultParams, cfg: parseFloat(e.target.value) || 7.0 })}
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Batch Size</label>
                      <input
                        type="number"
                        value={defaultParams.batchSize}
                        onChange={(e) => setDefaultParams({ ...defaultParams, batchSize: parseInt(e.target.value) || 1 })}
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sampler</label>
                      <select
                        value={defaultParams.samplerName || ''}
                        onChange={(e) => setDefaultParams({ ...defaultParams, samplerName: e.target.value || null })}
                        className="w-full border rounded-md px-3 py-2"
                      >
                        <option value="">使用工作流默认</option>
                        <option value="euler">euler</option>
                        <option value="euler_a">euler_a</option>
                        <option value="dpmpp_2m_sde_karras">dpmpp_2m_sde_karras</option>
                        <option value="dpmpp_sde_karras">dpmpp_sde_karras</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Seed <span className="text-gray-400">(0=随机)</span></label>
                      <input
                        type="number"
                        value={defaultParams.seed}
                        onChange={(e) => setDefaultParams({ ...defaultParams, seed: parseInt(e.target.value) || 0 })}
                        className="w-full border rounded-md px-3 py-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">正向提示词前缀</label>
                    <input
                      type="text"
                      value={defaultParams.positivePromptPrefix}
                      onChange={(e) => setDefaultParams({ ...defaultParams, positivePromptPrefix: e.target.value })}
                      className="w-full border rounded-md px-3 py-2"
                      placeholder="例如: masterpiece, best quality, "
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">正向提示词后缀</label>
                    <input
                      type="text"
                      value={defaultParams.positivePromptSuffix}
                      onChange={(e) => setDefaultParams({ ...defaultParams, positivePromptSuffix: e.target.value })}
                      className="w-full border rounded-md px-3 py-2"
                      placeholder="例如: , cinematic lighting"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">否定提示词覆盖 <span className="text-gray-400">(留空表示不覆盖)</span></label>
                    <input
                      type="text"
                      value={defaultParams.negativePromptOverride || ''}
                      onChange={(e) => setDefaultParams({ ...defaultParams, negativePromptOverride: e.target.value || null })}
                      className="w-full border rounded-md px-3 py-2"
                      placeholder="例如: bad anatomy, bad hands"
                    />
                  </div>
                </div>
              </>
            )}

            {!editingWorkflow && workflowJson && parsedNodes.length === 0 && (
              <div className="border-t pt-4 mt-4">
                <button
                  onClick={async () => {
                    if (editingWorkflow) {
                      parseAndSetNodes(editingWorkflow);
                    } else if (workflowJson) {
                      try {
                        const newWorkflow = await comfyuiWorkflowApi.create(workflowName || '未命名工作流', workflowJson);
                        setEditingWorkflow(newWorkflow.data);
                        parseAndSetNodes(newWorkflow.data);
                      } catch (err) {
                        console.error('Failed to create workflow:', err);
                      }
                    }
                  }}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  解析工作流节点
                </button>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  resetUploadForm();
                }}
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveWorkflow}
                disabled={!workflowName || (!editingWorkflow && !workflowJson)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
