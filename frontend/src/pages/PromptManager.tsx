import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  promptApi,
  type PromptTemplate,
  type PromptType,
  type PromptVariable,
  stylePromptsApi,
  type StylePromptList,
} from '../services/api';

const PromptManager: React.FC = () => {
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState<'templates' | 'style-prompts'>('templates');
  const [currentType, setCurrentType] = useState<PromptType>('character_extraction');
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [variables, setVariables] = useState<PromptVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<PromptTemplate>>({});

  // Style Prompts state
  const [styles, setStyles] = useState<StylePromptList[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<StylePromptList | null>(null);
  const [styleLoading, setStyleLoading] = useState(true);
  const [editingPromptIndex, setEditingPromptIndex] = useState<number | null>(null);
  const [promptEditForm, setPromptEditForm] = useState('');
  const [showParaphraseModal, setShowParaphraseModal] = useState(false);
  const [paraphraseSourcePrompt, setParaphraseSourcePrompt] = useState('');
  const [paraphraseCount, setParaphraseCount] = useState(3);
  const [paraphraseRequirement, setParaphraseRequirement] = useState('');
  const [paraphraseResults, setParaphraseResults] = useState<string[]>([]);
  const [paraphraseLoading, setParaphraseLoading] = useState(false);
  const [showTestImageModal, setShowTestImageModal] = useState(false);
  const [testImagePrompt, setTestImagePrompt] = useState('');
  const [testImageUrl, setTestImageUrl] = useState<string | null>(null);
  const [testImageLoading, setTestImageLoading] = useState(false);
  const [newPrompt, setNewPrompt] = useState('');
  const [renamingStyle, setRenamingStyle] = useState(false);
  const [renameStyleForm, setRenameStyleForm] = useState('');

  const typeLabels: Record<PromptType, string> = {
    character_extraction: '角色提取',
    storyboard_split: '分镜拆分（旧版）',
    image_prompt: '图像生成',
    scene_extraction: '场景提取',
  };

  useEffect(() => {
    if (currentTab === 'templates') {
      loadTemplates();
      loadVariables();
    } else {
      loadStyles();
    }
  }, [currentTab, currentType]);

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

  // ===== Style Prompts Functions =====
  const loadStyles = async () => {
    try {
      setStyleLoading(true);
      const response = await stylePromptsApi.listStyles();
      setStyles(response.data);
      if (response.data.length > 0 && !selectedStyle) {
        setSelectedStyle(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to load styles:', error);
    } finally {
      setStyleLoading(false);
    }
  };

  const handleCreateStyle = async () => {
    const name = prompt('请输入风格名称:');
    if (!name?.trim()) return;
    try {
      const response = await stylePromptsApi.createStyle(name.trim());
      setStyles([...styles, response.data].sort((a, b) => a.styleName.localeCompare(b.styleName)));
      setSelectedStyle(response.data);
    } catch (error) {
      console.error('Failed to create style:', error);
    }
  };

  const handleRenameStyle = async () => {
    if (!selectedStyle) return;
    const newName = prompt('请输入新的风格名称:', selectedStyle.styleName);
    if (!newName?.trim() || newName === selectedStyle.styleName) return;
    try {
      const response = await stylePromptsApi.renameStyle(selectedStyle.styleName, newName.trim());
      const newStyles = styles
        .map(s => s.styleName === selectedStyle.styleName ? response.data : s)
        .sort((a, b) => a.styleName.localeCompare(b.styleName));
      setStyles(newStyles);
      setSelectedStyle(response.data);
    } catch (error) {
      console.error('Failed to rename style:', error);
    }
  };

  const handleDeleteStyle = async () => {
    if (!selectedStyle) return;
    if (!confirm(`确定要删除风格 "${selectedStyle.styleName}" 吗？`)) return;
    try {
      await stylePromptsApi.deleteStyle(selectedStyle.styleName);
      const newStyles = styles.filter(s => s.styleName !== selectedStyle.styleName);
      setStyles(newStyles);
      setSelectedStyle(newStyles.length > 0 ? newStyles[0] : null);
    } catch (error) {
      console.error('Failed to delete style:', error);
    }
  };

  const handleAddPrompt = async () => {
    if (!selectedStyle || !newPrompt.trim()) return;
    try {
      const response = await stylePromptsApi.addPrompt(selectedStyle.styleName, newPrompt.trim());
      setSelectedStyle({ ...selectedStyle, prompts: response });
      setStyles(styles.map(s => s.styleName === selectedStyle.styleName ? { ...s, prompts: response } : s));
      setNewPrompt('');
    } catch (error) {
      console.error('Failed to add prompt:', error);
    }
  };

  const startEditPrompt = (index: number) => {
    if (!selectedStyle) return;
    setEditingPromptIndex(index);
    setPromptEditForm(selectedStyle.prompts[index]);
  };

  const saveEditPrompt = async () => {
    if (!selectedStyle || editingPromptIndex === null) return;
    try {
      const response = await stylePromptsApi.updatePrompt(
        selectedStyle.styleName,
        editingPromptIndex,
        promptEditForm.trim()
      );
      setSelectedStyle({ ...selectedStyle, prompts: response });
      setStyles(styles.map(s => s.styleName === selectedStyle.styleName ? { ...s, prompts: response } : s));
      setEditingPromptIndex(null);
      setPromptEditForm('');
    } catch (error) {
      console.error('Failed to update prompt:', error);
    }
  };

  const handleDeletePrompt = async (index: number) => {
    if (!selectedStyle) return;
    if (!confirm('确定要删除这条提示词吗？')) return;
    try {
      const response = await stylePromptsApi.deletePrompt(selectedStyle.styleName, index);
      setSelectedStyle({ ...selectedStyle, prompts: response });
      setStyles(styles.map(s => s.styleName === selectedStyle.styleName ? { ...s, prompts: response } : s));
    } catch (error) {
      console.error('Failed to delete prompt:', error);
    }
  };

  const openParaphraseModal = (prompt: string) => {
    setParaphraseSourcePrompt(prompt);
    setParaphraseCount(3);
    setParaphraseRequirement('');
    setParaphraseResults([]);
    setShowParaphraseModal(true);
  };

  const handleParaphrase = async () => {
    if (!paraphraseSourcePrompt) return;
    try {
      setParaphraseLoading(true);
      const response = await stylePromptsApi.paraphrase({
        originalPrompt: paraphraseSourcePrompt,
        count: paraphraseCount,
        requirement: paraphraseRequirement,
      });
      setParaphraseResults(response.data.generatedPrompts);
    } catch (error) {
      console.error('Failed to paraphrase:', error);
    } finally {
      setParaphraseLoading(false);
    }
  };

  const appendParaphrased = async (selectedPrompts: string[]) => {
    if (!selectedStyle || selectedPrompts.length === 0) return;
    try {
      const response = await stylePromptsApi.batchAppendPrompts(selectedStyle.styleName, selectedPrompts);
      setSelectedStyle({ ...selectedStyle, prompts: response });
      setStyles(styles.map(s => s.styleName === selectedStyle.styleName ? { ...s, prompts: response } : s));
      setShowParaphraseModal(false);
    } catch (error) {
      console.error('Failed to append prompts:', error);
    }
  };

  const openTestImageModal = (prompt: string) => {
    setTestImagePrompt(prompt);
    setTestImageUrl(null);
    setShowTestImageModal(true);
  };

  const handleTestImage = async () => {
    if (!testImagePrompt) return;
    try {
      setTestImageLoading(true);
      const response = await stylePromptsApi.testImage(testImagePrompt);
      setTestImageUrl(stylePromptsApi.getTestImageUrl(response.data.filename));
    } catch (error) {
      console.error('Failed to generate test image:', error);
    } finally {
      setTestImageLoading(false);
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

  const [selectedParaphrased, setSelectedParaphrased] = useState<boolean[]>([]);

  // Reset selected paraphrased when results change
  useEffect(() => {
    setSelectedParaphrased(new Array(paraphraseResults.length).fill(false));
  }, [paraphraseResults]);

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
            <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">提示词管理器</h2>
          </div>
        </div>

        {/* 主标签页 */}
        <div className="card p-2 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentTab('templates')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-150 ${
                currentTab === 'templates'
                  ? 'bg-primary-500 text-white'
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-divider dark:hover:bg-dark-divider'
              }`}
            >
              Prompt 模板
            </button>
            <button
              onClick={() => setCurrentTab('style-prompts')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-150 ${
                currentTab === 'style-prompts'
                  ? 'bg-primary-500 text-white'
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-divider dark:hover:bg-dark-divider'
              }`}
            >
              风格提示词
            </button>
          </div>
        </div>

        {/* Prompt 模板标签页内容 */}
        {currentTab === 'templates' && (
          <>
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
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
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
          </>
        )}

        {/* 风格提示词标签页内容 */}
        {currentTab === 'style-prompts' && (
          <div className="flex gap-6">
            {/* 风格列表 */}
            <div className="w-64 flex-shrink-0">
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary">风格列表</h3>
                </div>

                <div className="space-y-1 mb-4">
                  {styles.map((style) => (
                    <button
                      key={style.styleName}
                      onClick={() => setSelectedStyle(style)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                        selectedStyle?.styleName === style.styleName
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                          : 'hover:bg-light-divider dark:hover:bg-dark-divider text-light-text-secondary dark:text-dark-text-secondary'
                      }`}
                    >
                      <div className="font-medium">{style.styleName}</div>
                      <div className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                        {style.prompts.length} 条提示词
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCreateStyle}
                  className="w-full btn-primary text-sm mb-2"
                >
                  + 新建风格
                </button>

                {selectedStyle && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleRenameStyle}
                      className="flex-1 btn-secondary text-sm"
                    >
                      重命名
                    </button>
                    <button
                      onClick={handleDeleteStyle}
                      className="flex-1 btn-secondary text-sm text-red-500 hover:text-red-600"
                    >
                      删除
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 提示词列表 */}
            <div className="flex-1">
              {styleLoading ? (
                <div className="card p-6">
                  <span className="text-light-text-secondary dark:text-dark-text-secondary">加载中...</span>
                </div>
              ) : !selectedStyle ? (
                <div className="card p-6">
                  <p className="text-light-text-secondary dark:text-dark-text-secondary">请选择一个风格</p>
                </div>
              ) : (
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg text-light-text-primary dark:text-dark-text-primary">
                      {selectedStyle.styleName}
                    </h3>
                    <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      共 {selectedStyle.prompts.length} 条提示词
                    </span>
                  </div>

                  {/* 添加新提示词 */}
                  <div className="flex gap-2 mb-4">
                    <textarea
                      value={newPrompt}
                      onChange={(e) => setNewPrompt(e.target.value)}
                      placeholder="输入新的提示词..."
                      className="input-field flex-1 h-20 resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddPrompt();
                        }
                      }}
                    />
                    <button
                      onClick={handleAddPrompt}
                      disabled={!newPrompt.trim()}
                      className="btn-primary self-end"
                    >
                      添加
                    </button>
                  </div>

                  {/* 提示词列表 */}
                  <div className="space-y-3">
                    {selectedStyle.prompts.map((prompt, index) => (
                      <div key={index} className="bg-light-divider/50 dark:bg-dark-divider/50 rounded-lg p-4">
                        {editingPromptIndex === index ? (
                          <>
                            <textarea
                              value={promptEditForm}
                              onChange={(e) => setPromptEditForm(e.target.value)}
                              className="input-field w-full h-24 resize-none mb-2"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => {
                                  setEditingPromptIndex(null);
                                  setPromptEditForm('');
                                }}
                                className="btn-secondary text-sm"
                              >
                                取消
                              </button>
                              <button
                                onClick={saveEditPrompt}
                                className="btn-primary text-sm"
                              >
                                保存
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-light-text-primary dark:text-dark-text-primary whitespace-pre-wrap mb-3">
                              {prompt}
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => openTestImageModal(prompt)}
                                className="btn-secondary text-sm"
                              >
                                🎨 测试生图
                              </button>
                              <button
                                onClick={() => openParaphraseModal(prompt)}
                                className="btn-secondary text-sm"
                              >
                                ✨ 仿写
                              </button>
                              <button
                                onClick={() => startEditPrompt(index)}
                                className="btn-secondary text-sm"
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => handleDeletePrompt(index)}
                                className="btn-secondary text-sm text-red-500 hover:text-red-600"
                              >
                                删除
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    {selectedStyle.prompts.length === 0 && (
                      <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
                        暂无提示词，添加一条开始吧
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 仿写弹窗 */}
        {showParaphraseModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="card max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-light-divider dark:border-dark-divider">
                <h3 className="font-semibold text-lg text-light-text-primary dark:text-dark-text-primary">
                  提示词仿写
                </h3>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                <div className="mb-4">
                  <label className="input-label">原始提示词</label>
                  <div className="bg-light-divider dark:bg-dark-divider rounded-lg p-3 text-light-text-primary dark:text-dark-text-primary whitespace-pre-wrap">
                    {paraphraseSourcePrompt}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="input-label">生成数量</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={paraphraseCount}
                      onChange={(e) => setParaphraseCount(parseInt(e.target.value) || 3)}
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label className="input-label">额外要求（可选）</label>
                    <input
                      type="text"
                      placeholder="例如：更夸张一点"
                      value={paraphraseRequirement}
                      onChange={(e) => setParaphraseRequirement(e.target.value)}
                      className="input-field w-full"
                    />
                  </div>
                </div>
                {paraphraseResults.length > 0 && (
                  <div className="mb-4">
                    <label className="input-label">生成结果（勾选要添加的）</label>
                    <div className="space-y-2">
                      {paraphraseResults.map((result, idx) => (
                        <div key={idx} className="flex gap-2 items-start bg-light-divider/50 dark:bg-dark-divider/50 rounded-lg p-3">
                          <input
                            type="checkbox"
                            checked={selectedParaphrased[idx] || false}
                            onChange={(e) => {
                              const newSelected = [...selectedParaphrased];
                              newSelected[idx] = e.target.checked;
                              setSelectedParaphrased(newSelected);
                            }}
                            className="mt-1"
                          />
                          <div className="flex-1 text-light-text-primary dark:text-dark-text-primary whitespace-pre-wrap">
                            {result}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-light-divider dark:border-dark-divider flex gap-2 justify-end">
                <button
                  onClick={() => setShowParaphraseModal(false)}
                  className="btn-secondary"
                >
                  关闭
                </button>
                {paraphraseResults.length === 0 ? (
                  <button
                    onClick={handleParaphrase}
                    disabled={paraphraseLoading}
                    className="btn-primary"
                  >
                    {paraphraseLoading ? '生成中...' : '生成'}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const selected = paraphraseResults.filter((_, idx) => selectedParaphrased[idx]);
                      appendParaphrased(selected);
                    }}
                    disabled={!selectedParaphrased.some(Boolean)}
                    className="btn-primary"
                  >
                    添加选中的
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 测试生图弹窗 */}
        {showTestImageModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="card max-w-2xl w-full">
              <div className="p-4 border-b border-light-divider dark:border-dark-divider">
                <h3 className="font-semibold text-lg text-light-text-primary dark:text-dark-text-primary">
                  测试生图
                </h3>
              </div>
              <div className="p-4">
                <div className="mb-4">
                  <label className="input-label">提示词</label>
                  <textarea
                    value={testImagePrompt}
                    onChange={(e) => setTestImagePrompt(e.target.value)}
                    className="input-field w-full h-24 resize-none"
                  />
                </div>
                {testImageUrl && (
                  <div className="mb-4">
                    <label className="input-label">生成结果</label>
                    <img
                      src={testImageUrl}
                      alt="Test"
                      className="w-full rounded-lg"
                    />
                  </div>
                )}
                {testImageLoading && (
                  <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
                    生成中...
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-light-divider dark:border-dark-divider flex gap-2 justify-end">
                <button
                  onClick={() => setShowTestImageModal(false)}
                  className="btn-secondary"
                >
                  关闭
                </button>
                <button
                  onClick={handleTestImage}
                  disabled={testImageLoading || !testImagePrompt.trim()}
                  className="btn-primary"
                >
                  {testImageLoading ? '生成中...' : '生成图片'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptManager;
