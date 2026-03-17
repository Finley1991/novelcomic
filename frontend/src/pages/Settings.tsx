import React, { useEffect, useState } from 'react';
import { settingsApi, type GlobalSettings } from '../services/api';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<GlobalSettings>({
    comfyui: { apiUrl: '', timeout: 300, maxRetries: 3, concurrentLimit: 3 },
    llm: {
      provider: 'ollama',
      ollama: { apiUrl: '', model: 'llama3', timeout: 120, maxRetries: 2, chunkSize: 4000 },
      openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', timeout: 120, maxRetries: 2, chunkSize: 4000, proxy: '' }
    },
    ollama: { apiUrl: '', model: 'llama3', timeout: 120, maxRetries: 2, chunkSize: 4000 },
    tts: { azureKey: '', azureRegion: '', voice: 'zh-CN-XiaoxiaoNeural', rate: 1.0, pitch: 0, timeout: 60, maxRetries: 3, concurrentLimit: 5 },
    jianying: { canvasWidth: 1920, canvasHeight: 1080, canvasRatio: '16:9' },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await settingsApi.get();
      const loadedSettings = response.data;
      if (!loadedSettings.llm) {
        loadedSettings.llm = {
          provider: 'ollama',
          ollama: loadedSettings.ollama || { apiUrl: '', model: 'llama3', timeout: 120, maxRetries: 2, chunkSize: 4000 },
          openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', timeout: 120, maxRetries: 2, chunkSize: 4000 }
        };
      }
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
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
      // Add timeout for frontend
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

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
          <h3 className="text-lg font-semibold mb-4">微软 TTS 设置</h3>
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
    </div>
  );
};

export default Settings;
