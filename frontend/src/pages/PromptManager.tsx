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
    scene_extraction: '场景提取',
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
    <div className="page-transition">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-primary-500 hover:text-primary-600"
            >
              ← 返回
            </button>
            <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">Prompt 模板管理器</h2>
          </div>
        </div>

        {/* 类型标签页 */}
        <div className="card p-2 mb-6">
          <div className="flex gap-2">
            {(Object.keys(typeLabels) as PromptType[]).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setCurrentType(type);
                  setSelectedTemplate(null);
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-150 ${
                  currentType === type
                    ? 'bg-primary-500 text-white'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-divider dark:hover:bg-dark-divider'
                }`}
              >
                {typeLabels[type]}
              </button>
            ))}
          </div>
        </div>

        {/* 分镜拆分旧版提示 */}
        {currentType === 'storyboard_split' && (
          <div className="card p-4 mb-6 border-l-4 border-amber-500">
            <div className="flex items-start gap-3">
              <span className="text-amber-500 text-xl">⚠️</span>
              <div>
                <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-1">分镜拆分已更新</h4>
                <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">
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
            <div className="card p-4">
              <h3 className="font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">模板列表</h3>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">预设</h4>
                <div className="space-y-1">
                  {presets.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                        selectedTemplate?.id === template.id
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                          : 'hover:bg-light-divider dark:hover:bg-dark-divider text-light-text-secondary dark:text-dark-text-secondary'
                      }`}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">我的模板</h4>
                <div className="space-y-1">
                  {userTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                        selectedTemplate?.id === template.id
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                          : 'hover:bg-light-divider dark:hover:bg-dark-divider text-light-text-secondary dark:text-dark-text-secondary'
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
                className="w-full btn-primary text-sm"
              >
                + 新建模板
              </button>
            </div>
          </div>

          {/* 编辑器 */}
          <div className="flex-1">
            {loading ? (
              <div className="card p-6">
                <span className="text-light-text-secondary dark:text-dark-text-secondary">加载中...</span>
              </div>
            ) : !displayTemplate ? (
              <div className="card p-6">
                <p className="text-light-text-secondary dark:text-dark-text-secondary">请选择一个模板</p>
              </div>
            ) : (
              <div className="card p-6">
                <div className="mb-4">
                  <label className="input-label">
                    名称
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="input-field w-full"
                      maxLength={100}
                    />
                  ) : (
                    <div className="text-lg font-medium text-light-text-primary dark:text-dark-text-primary">{displayTemplate.name}</div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="input-label">
                    描述
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="input-field w-full"
                    />
                  ) : (
                    <div className="text-light-text-secondary dark:text-dark-text-secondary">{displayTemplate.description || '无描述'}</div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="input-label">
                    System Prompt
                  </label>
                  {editing ? (
                    <textarea
                      value={editForm.systemPrompt || ''}
                      onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })}
                      className="input-field w-full h-32 font-mono text-sm"
                    />
                  ) : (
                    <div className="bg-light-divider dark:bg-dark-divider rounded-lg p-3 font-mono text-sm whitespace-pre-wrap text-light-text-primary dark:text-dark-text-primary">
                      {displayTemplate.systemPrompt || '空'}
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="input-label">
                    User Prompt
                  </label>
                  {editing ? (
                    <textarea
                      value={editForm.userPrompt || ''}
                      onChange={(e) => setEditForm({ ...editForm, userPrompt: e.target.value })}
                      className="input-field w-full h-48 font-mono text-sm"
                    />
                  ) : (
                    <div className="bg-light-divider dark:bg-dark-divider rounded-lg p-3 font-mono text-sm whitespace-pre-wrap text-light-text-primary dark:text-dark-text-primary">
                      {displayTemplate.userPrompt || '空'}
                    </div>
                  )}
                </div>

                {editing && (
                  <div className="mb-4">
                    <label className="input-label">
                      可用变量
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {variables.map((v) => (
                        <div key={v.name} className="flex gap-1">
                          <button
                            onClick={() => insertVariable(v.name, 'systemPrompt')}
                            className="px-2 py-1 bg-light-divider dark:bg-dark-divider hover:bg-light-border dark:hover:bg-dark-border rounded-lg text-xs font-mono text-light-text-primary dark:text-dark-text-primary transition-all duration-150"
                            title={`${v.description} (插入到 System Prompt)`}
                          >
                            {`{${v.name}}`} → S
                          </button>
                          <button
                            onClick={() => insertVariable(v.name, 'userPrompt')}
                            className="px-2 py-1 bg-light-divider dark:bg-dark-divider hover:bg-light-border dark:hover:bg-dark-border rounded-lg text-xs font-mono text-light-text-primary dark:text-dark-text-primary transition-all duration-150"
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
                        className="btn-primary"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setEditForm({});
                        }}
                        className="btn-secondary"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      {!selectedTemplate?.isPreset && (
                        <button
                          onClick={startEdit}
                          className="btn-primary"
                        >
                          编辑
                        </button>
                      )}
                      <button
                        onClick={handleDuplicate}
                        className="btn-secondary"
                      >
                        复制
                      </button>
                      {!selectedTemplate?.isPreset && (
                        <button
                          onClick={handleDelete}
                          className="btn-secondary text-red-500 hover:text-red-600 hover:border-red-300 dark:hover:border-red-700"
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
