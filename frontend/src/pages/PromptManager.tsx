import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  promptApi,
  type PromptTemplate,
  type PromptType,
  type PromptVariable,
} from '../services/api';

const PromptManager: React.FC = () => {
  const navigate = useNavigate();
  const [currentType, setCurrentType] = useState<PromptType>('character_extraction');
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [variables, setVariables] = useState<PromptVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<PromptTemplate>>({});

  const typeLabels: Record<PromptType, string> = {
    character_extraction: '角色提取',
    storyboard_split: '分镜拆分（旧版）',
    image_prompt: '图像生成',
  };

  useEffect(() => {
    loadTemplates();
    loadVariables();
  }, [currentType]);

  const loadTemplates = async () => {
    try {
      const response = await promptApi.listTemplates(currentType);
      setTemplates(response.data);
      if (response.data.length > 0 && !selectedTemplate) {
        setSelectedTemplate(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVariables = async () => {
    try {
      const response = await promptApi.getVariables(currentType);
      setVariables(response.data);
    } catch (error) {
      console.error('Failed to load variables:', error);
    }
  };

  const handleSelectTemplate = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setEditing(false);
    setEditForm({});
  };

  const startEdit = () => {
    if (selectedTemplate) {
      setEditForm({ ...selectedTemplate });
      setEditing(true);
    }
  };

  const saveEdit = async () => {
    if (!selectedTemplate || !editForm.name) return;
    try {
      if (selectedTemplate.isPreset) {
        const newName = `${editForm.name} (副本)`;
        const response = await promptApi.duplicateTemplate(selectedTemplate.id, newName);
        setSelectedTemplate(response.data);
      } else {
        const response = await promptApi.updateTemplate(selectedTemplate.id, editForm);
        setSelectedTemplate(response.data);
      }
      await loadTemplates();
      setEditing(false);
      setEditForm({});
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    if (!confirm(`确定要删除模板 "${selectedTemplate.name}" 吗？`)) return;
    try {
      await promptApi.deleteTemplate(selectedTemplate.id);
      setSelectedTemplate(null);
      await loadTemplates();
    } catch (error: any) {
      if (error.response?.status === 400) {
        const usages = error.response?.data?.detail?.usages;
        if (usages) {
          const message = `此模板正在被使用：\n${usages.join('\n')}\n\n是否级联更新为默认模板？`;
          if (confirm(message)) {
            try {
              await promptApi.deleteTemplate(selectedTemplate.id, true);
              setSelectedTemplate(null);
              await loadTemplates();
            } catch (e) {
              console.error('Failed to cascade delete:', e);
            }
          }
        }
      }
    }
  };

  const handleDuplicate = async () => {
    if (!selectedTemplate) return;
    const newName = prompt('请输入新模板名称:', `${selectedTemplate.name} (副本)`);
    if (!newName) return;
    try {
      const response = await promptApi.duplicateTemplate(selectedTemplate.id, newName);
      setSelectedTemplate(response.data);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  };

  const insertVariable = (name: string, field: 'systemPrompt' | 'userPrompt') => {
    const currentValue = editForm[field] || '';
    setEditForm({ ...editForm, [field]: currentValue + `{${name}}` });
  };

  const presets = templates.filter(t => t.isPreset);
  const userTemplates = templates.filter(t => !t.isPreset);

  const displayTemplate = editing ? editForm : selectedTemplate;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-blue-500 hover:text-blue-600"
            >
              ← 返回
            </button>
            <h2 className="text-2xl font-bold">Prompt 模板管理器</h2>
          </div>
        </div>

        {/* 类型标签页 */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b">
            {(Object.keys(typeLabels) as PromptType[]).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setCurrentType(type);
                  setSelectedTemplate(null);
                }}
                className={`px-6 py-4 font-medium ${
                  currentType === type
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {typeLabels[type]}
              </button>
            ))}
          </div>
        </div>

        {/* 分镜拆分旧版提示 */}
        {currentType === 'storyboard_split' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-yellow-600 text-xl">⚠️</span>
              <div>
                <h4 className="font-medium text-yellow-800 mb-1">分镜拆分已更新</h4>
                <p className="text-yellow-700 text-sm">
                  当前版本已改用按行分割的方式创建分镜，不再使用 LLM 模板进行智能拆分。
                  此页面的模板仅用于历史参考。
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-6">
          {/* 模板列表 */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-4 text-gray-700">模板列表</h3>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">预设</h4>
                <div className="space-y-1">
                  {presets.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        selectedTemplate?.id === template.id
                          ? 'bg-blue-50 text-blue-600'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">我的模板</h4>
                <div className="space-y-1">
                  {userTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        selectedTemplate?.id === template.id
                          ? 'bg-blue-50 text-blue-600'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={async () => {
                  const name = prompt('请输入新模板名称:');
                  if (!name) return;
                  try {
                    const response = await promptApi.createTemplate({
                      name,
                      type: currentType,
                    });
                    setSelectedTemplate(response.data);
                    await loadTemplates();
                  } catch (error) {
                    console.error('Failed to create template:', error);
                  }
                }}
                className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 text-sm"
              >
                + 新建模板
              </button>
            </div>
          </div>

          {/* 编辑器 */}
          <div className="flex-1">
            {loading ? (
              <div className="bg-white rounded-lg shadow p-6">
                加载中...
              </div>
            ) : !displayTemplate ? (
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-500">请选择一个模板</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    名称
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      maxLength={100}
                    />
                  ) : (
                    <div className="text-lg font-medium">{displayTemplate.name}</div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    描述
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    />
                  ) : (
                    <div className="text-gray-600">{displayTemplate.description || '无描述'}</div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    System Prompt
                  </label>
                  {editing ? (
                    <textarea
                      value={editForm.systemPrompt || ''}
                      onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })}
                      className="w-full border rounded px-3 py-2 h-32 font-mono text-sm"
                    />
                  ) : (
                    <div className="bg-gray-50 rounded p-3 font-mono text-sm whitespace-pre-wrap">
                      {displayTemplate.systemPrompt || '空'}
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User Prompt
                  </label>
                  {editing ? (
                    <textarea
                      value={editForm.userPrompt || ''}
                      onChange={(e) => setEditForm({ ...editForm, userPrompt: e.target.value })}
                      className="w-full border rounded px-3 py-2 h-48 font-mono text-sm"
                    />
                  ) : (
                    <div className="bg-gray-50 rounded p-3 font-mono text-sm whitespace-pre-wrap">
                      {displayTemplate.userPrompt || '空'}
                    </div>
                  )}
                </div>

                {editing && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      可用变量
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {variables.map((v) => (
                        <div key={v.name} className="flex gap-1">
                          <button
                            onClick={() => insertVariable(v.name, 'systemPrompt')}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono"
                            title={`${v.description} (插入到 System Prompt)`}
                          >
                            {`{${v.name}}`} → S
                          </button>
                          <button
                            onClick={() => insertVariable(v.name, 'userPrompt')}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono"
                            title={`${v.description} (插入到 User Prompt)`}
                          >
                            {`{${v.name}}`} → U
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <button
                        onClick={saveEdit}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setEditForm({});
                        }}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      {!selectedTemplate?.isPreset && (
                        <button
                          onClick={startEdit}
                          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                          编辑
                        </button>
                      )}
                      <button
                        onClick={handleDuplicate}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                      >
                        复制
                      </button>
                      {!selectedTemplate?.isPreset && (
                        <button
                          onClick={handleDelete}
                          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                        >
                          删除
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptManager;
