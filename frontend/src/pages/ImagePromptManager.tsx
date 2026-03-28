import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  imagePromptApi,
  type PromptSnippet,
  type PromptSnippetCategory,
  type ImagePromptTemplate,
} from '../services/api';

type TabType = 'snippets' | 'templates';

const categoryLabels: Record<PromptSnippetCategory, string> = {
  style: '风格',
  quality: '质量',
  lighting: '光照',
  composition: '构图',
  custom: '自定义',
};

const templateVariables = [
  { name: 'quality', description: '质量片段内容' },
  { name: 'lighting', description: '光照片段内容' },
  { name: 'composition', description: '构图片段内容' },
  { name: 'style', description: '风格片段内容' },
  { name: 'scene', description: '分镜画面描述' },
  { name: 'characters', description: '角色提示词' },
  { name: 'style_prompt', description: '项目风格提示词' },
  { name: 'custom', description: '自定义内容' },
];

const ImagePromptManager: React.FC = () => {
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState<TabType>('snippets');

  // Snippet state
  const [snippets, setSnippets] = useState<PromptSnippet[]>([]);
  const [selectedSnippet, setSelectedSnippet] = useState<PromptSnippet | null>(null);
  const [snippetFilter, setSnippetFilter] = useState<PromptSnippetCategory | 'all'>('all');

  // Template state
  const [templates, setTemplates] = useState<ImagePromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ImagePromptTemplate | null>(null);

  // Common state
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [previewData, setPreviewData] = useState<{
    scene?: string;
    characterPrompts?: string;
    stylePrompt?: string;
    custom?: string;
  }>({});
  const [renderedPreview, setRenderedPreview] = useState<string>('');

  useEffect(() => {
    if (currentTab === 'snippets') {
      loadSnippets();
    } else {
      loadTemplates();
    }
  }, [currentTab]);

  const loadSnippets = async () => {
    try {
      const response = await imagePromptApi.listSnippets();
      setSnippets(response.data);
      if (response.data.length > 0 && !selectedSnippet) {
        setSelectedSnippet(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to load snippets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await imagePromptApi.listTemplates();
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

  const handleSelectSnippet = (snippet: PromptSnippet) => {
    setSelectedSnippet(snippet);
    setEditing(false);
    setEditForm({});
  };

  const handleSelectTemplate = (template: ImagePromptTemplate) => {
    setSelectedTemplate(template);
    setEditing(false);
    setEditForm({});
    setRenderedPreview('');
  };

  const startEdit = () => {
    if (currentTab === 'snippets' && selectedSnippet) {
      setEditForm({ ...selectedSnippet });
      setEditing(true);
    } else if (currentTab === 'templates' && selectedTemplate) {
      setEditForm({ ...selectedTemplate });
      setEditing(true);
    }
  };

  const saveEdit = async () => {
    if (currentTab === 'snippets') {
      if (!selectedSnippet || !editForm.name) return;
      try {
        if (selectedSnippet.isPreset) {
          const newName = editForm.name + ' (副本)';
          const response = await imagePromptApi.duplicateSnippet(selectedSnippet.id, newName);
          setSelectedSnippet(response.data);
        } else {
          const response = await imagePromptApi.updateSnippet(selectedSnippet.id, editForm);
          setSelectedSnippet(response.data);
        }
        await loadSnippets();
        setEditing(false);
        setEditForm({});
      } catch (error) {
        console.error('Failed to save snippet:', error);
      }
    } else {
      if (!selectedTemplate || !editForm.name) return;
      try {
        if (selectedTemplate.isPreset) {
          const newName = editForm.name + ' (副本)';
          const response = await imagePromptApi.duplicateTemplate(selectedTemplate.id, newName);
          setSelectedTemplate(response.data);
        } else {
          const response = await imagePromptApi.updateTemplate(selectedTemplate.id, editForm);
          setSelectedTemplate(response.data);
        }
        await loadTemplates();
        setEditing(false);
        setEditForm({});
      } catch (error) {
        console.error('Failed to save template:', error);
      }
    }
  };

  const handleDelete = async () => {
    if (currentTab === 'snippets') {
      if (!selectedSnippet) return;
      if (!confirm('确定要删除片段 "' + selectedSnippet.name + '" 吗？')) return;
      try {
        await imagePromptApi.deleteSnippet(selectedSnippet.id);
        setSelectedSnippet(null);
        await loadSnippets();
      } catch (error) {
        console.error('Failed to delete snippet:', error);
      }
    } else {
      if (!selectedTemplate) return;
      if (!confirm('确定要删除模板 "' + selectedTemplate.name + '" 吗？')) return;
      try {
        await imagePromptApi.deleteTemplate(selectedTemplate.id);
        setSelectedTemplate(null);
        await loadTemplates();
      } catch (error) {
        console.error('Failed to delete template:', error);
      }
    }
  };

  const handleDuplicate = async () => {
    if (currentTab === 'snippets') {
      if (!selectedSnippet) return;
      const newName = prompt('请输入新片段名称:', selectedSnippet.name + ' (副本)');
      if (!newName) return;
      try {
        const response = await imagePromptApi.duplicateSnippet(selectedSnippet.id, newName);
        setSelectedSnippet(response.data);
        await loadSnippets();
      } catch (error) {
        console.error('Failed to duplicate snippet:', error);
      }
    } else {
      if (!selectedTemplate) return;
      const newName = prompt('请输入新模板名称:', selectedTemplate.name + ' (副本)');
      if (!newName) return;
      try {
        const response = await imagePromptApi.duplicateTemplate(selectedTemplate.id, newName);
        setSelectedTemplate(response.data);
        await loadTemplates();
      } catch (error) {
        console.error('Failed to duplicate template:', error);
      }
    }
  };

  const handleCreateSnippet = async () => {
    const name = prompt('请输入新片段名称:');
    if (!name) return;
    try {
      const response = await imagePromptApi.createSnippet({
        name,
        description: '',
        category: 'custom',
        content: '',
      });
      setSelectedSnippet(response.data);
      await loadSnippets();
      setEditing(true);
      setEditForm({ ...response.data });
    } catch (error) {
      console.error('Failed to create snippet:', error);
    }
  };

  const handleCreateTemplate = async () => {
    const name = prompt('请输入新模板名称:');
    if (!name) return;
    try {
      const response = await imagePromptApi.createTemplate({
        name,
        description: '',
        template: '{quality}, {lighting}, {scene}, {style}',
        snippetIds: [],
      });
      setSelectedTemplate(response.data);
      await loadTemplates();
      setEditing(true);
      setEditForm({ ...response.data });
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  };

  const insertVariable = (name: string) => {
    const currentValue = editForm.template || '';
    setEditForm({ ...editForm, template: currentValue + '{' + name + '}' });
  };

  const toggleSnippetInTemplate = (snippetId: string) => {
    const currentIds = editForm.snippetIds || [];
    const newIds = currentIds.includes(snippetId)
      ? currentIds.filter((id: string) => id !== snippetId)
      : [...currentIds, snippetId];
    setEditForm({ ...editForm, snippetIds: newIds });
  };

  const renderPreview = async () => {
    if (!selectedTemplate) return;
    try {
      const response = await imagePromptApi.renderTemplate(selectedTemplate.id, previewData);
      setRenderedPreview(response.data.renderedPrompt);
    } catch (error) {
      console.error('Failed to render template:', error);
    }
  };

  const filteredSnippets = snippetFilter === 'all'
    ? snippets
    : snippets.filter(s => s.category === snippetFilter);

  const presetSnippets = filteredSnippets.filter(s => s.isPreset);
  const userSnippets = filteredSnippets.filter(s => !s.isPreset);

  const presetTemplates = templates.filter(t => t.isPreset);
  const userTemplates = templates.filter(t => !t.isPreset);

  const displaySnippet = editing ? editForm : selectedSnippet;
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
            <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">图片生成提示词管理</h2>
          </div>
        </div>

        <div className="card p-2 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCurrentTab('snippets');
                setSelectedTemplate(null);
              }}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-150 ${
                currentTab === 'snippets'
                  ? 'bg-primary-500 text-white'
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-divider dark:hover:bg-dark-divider'
              }`}
            >
              提示词片段
            </button>
            <button
              onClick={() => {
                setCurrentTab('templates');
                setSelectedSnippet(null);
              }}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-150 ${
                currentTab === 'templates'
                  ? 'bg-primary-500 text-white'
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-divider dark:hover:bg-dark-divider'
              }`}
            >
              提示词模板
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="w-72 flex-shrink-0">
            <div className="card p-4">
              {currentTab === 'snippets' ? (
                <React.Fragment>
                  <h3 className="font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">片段列表</h3>

                  <div className="mb-4">
                    <select
                      value={snippetFilter}
                      onChange={(e) => setSnippetFilter(e.target.value as any)}
                      className="input-field w-full text-sm"
                    >
                      <option value="all">全部分类</option>
                      {(Object.keys(categoryLabels) as PromptSnippetCategory[]).map((cat) => (
                        <option key={cat} value={cat}>{categoryLabels[cat]}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">预设</h4>
                    <div className="space-y-1">
                      {presetSnippets.map((snippet) => (
                        <button
                          key={snippet.id}
                          onClick={() => handleSelectSnippet(snippet)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                            selectedSnippet?.id === snippet.id
                              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                              : 'hover:bg-light-divider dark:hover:bg-dark-divider text-light-text-secondary dark:text-dark-text-secondary'
                          }`}
                        >
                          {snippet.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">我的片段</h4>
                    <div className="space-y-1">
                      {userSnippets.map((snippet) => (
                        <button
                          key={snippet.id}
                          onClick={() => handleSelectSnippet(snippet)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                            selectedSnippet?.id === snippet.id
                              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                              : 'hover:bg-light-divider dark:hover:bg-dark-divider text-light-text-secondary dark:text-dark-text-secondary'
                          }`}
                        >
                          {snippet.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleCreateSnippet}
                    className="w-full btn-primary text-sm"
                  >
                    + 新建片段
                  </button>
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <h3 className="font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">模板列表</h3>

                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">预设</h4>
                    <div className="space-y-1">
                      {presetTemplates.map((template) => (
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
                    onClick={handleCreateTemplate}
                    className="w-full btn-primary text-sm"
                  >
                    + 新建模板
                  </button>
                </React.Fragment>
              )}
            </div>
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="card p-6">
                <span className="text-light-text-secondary dark:text-dark-text-secondary">加载中...</span>
              </div>
            ) : currentTab === 'snippets' ? (
              !displaySnippet ? (
                <div className="card p-6">
                  <p className="text-light-text-secondary dark:text-dark-text-secondary">请选择一个片段</p>
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
                      <div className="text-lg font-medium text-light-text-primary dark:text-dark-text-primary">{displaySnippet.name}</div>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="input-label">
                      分类
                    </label>
                    {editing ? (
                      <select
                        value={editForm.category || 'custom'}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="input-field w-full"
                      >
                        {(Object.keys(categoryLabels) as PromptSnippetCategory[]).map((cat) => (
                          <option key={cat} value={cat}>{categoryLabels[cat]}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-light-text-secondary dark:text-dark-text-secondary">
                        {categoryLabels[displaySnippet.category as PromptSnippetCategory]}
                      </div>
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
                      <div className="text-light-text-secondary dark:text-dark-text-secondary">{displaySnippet.description || '无描述'}</div>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="input-label">
                      内容
                    </label>
                    {editing ? (
                      <textarea
                        value={editForm.content || ''}
                        onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                        className="input-field w-full h-32 font-mono text-sm"
                      />
                    ) : (
                      <div className="bg-light-divider dark:bg-dark-divider rounded-lg p-3 font-mono text-sm whitespace-pre-wrap text-light-text-primary dark:text-dark-text-primary">
                        {displaySnippet.content || '空'}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {editing ? (
                      <React.Fragment>
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
                      </React.Fragment>
                    ) : (
                      <React.Fragment>
                        {!selectedSnippet?.isPreset && (
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
                        {!selectedSnippet?.isPreset && (
                          <button
                            onClick={handleDelete}
                            className="btn-secondary text-red-500 hover:text-red-600 hover:border-red-300 dark:hover:border-red-700"
                          >
                            删除
                          </button>
                        )}
                      </React.Fragment>
                    )}
                  </div>
                </div>
              )
            ) : (
              !displayTemplate ? (
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
                      模板字符串
                    </label>
                    {editing ? (
                      <textarea
                        value={editForm.template || ''}
                        onChange={(e) => setEditForm({ ...editForm, template: e.target.value })}
                        className="input-field w-full h-24 font-mono text-sm"
                      />
                    ) : (
                      <div className="bg-light-divider dark:bg-dark-divider rounded-lg p-3 font-mono text-sm whitespace-pre-wrap text-light-text-primary dark:text-dark-text-primary">
                        {displayTemplate.template || '空'}
                      </div>
                    )}
                  </div>

                  {editing && (
                    <div className="mb-4">
                      <label className="input-label">
                        可用变量
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {templateVariables.map((v) => (
                          <button
                            key={v.name}
                            onClick={() => insertVariable(v.name)}
                            className="px-2 py-1 bg-light-divider dark:bg-dark-divider hover:bg-light-border dark:hover:bg-dark-border rounded-lg text-xs font-mono text-light-text-primary dark:text-dark-text-primary transition-all duration-150"
                            title={v.description}
                          >
                            {'{' + v.name + '}'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="input-label">
                      默认片段
                    </label>
                    {editing ? (
                      <div className="border border-light-border dark:border-dark-border rounded-lg p-3 max-h-48 overflow-y-auto">
                        {snippets.map((snippet) => (
                          <label key={snippet.id} className="flex items-center gap-2 py-1">
                            <input
                              type="checkbox"
                              checked={(editForm.snippetIds || []).includes(snippet.id)}
                              onChange={() => toggleSnippetInTemplate(snippet.id)}
                              className="rounded border-light-border dark:border-dark-border"
                            />
                            <span className="text-sm text-light-text-primary dark:text-dark-text-primary">
                              {snippet.name}
                              <span className="text-light-text-tertiary dark:text-dark-text-tertiary ml-2">
                                ({categoryLabels[snippet.category]})
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="border border-light-border dark:border-dark-border rounded-lg p-3">
                        {displayTemplate.snippetIds.length === 0 ? (
                          <span className="text-light-text-tertiary dark:text-dark-text-tertiary text-sm">未选择片段</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {displayTemplate.snippetIds.map((id: string) => {
                              const snippet = snippets.find(s => s.id === id);
                              return snippet ? (
                                <span key={id} className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg text-xs">
                                  {snippet.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {!editing && selectedTemplate && (
                    <div className="mb-4 border-t border-light-border dark:border-dark-border pt-4">
                      <h4 className="input-label">预览渲染</h4>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1 block">场景描述</label>
                          <input
                            type="text"
                            value={previewData.scene || ''}
                            onChange={(e) => setPreviewData({ ...previewData, scene: e.target.value })}
                            placeholder="森林中的小屋"
                            className="input-field w-full text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1 block">角色提示词</label>
                          <input
                            type="text"
                            value={previewData.characterPrompts || ''}
                            onChange={(e) => setPreviewData({ ...previewData, characterPrompts: e.target.value })}
                            placeholder="1girl, long hair"
                            className="input-field w-full text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1 block">项目风格</label>
                          <input
                            type="text"
                            value={previewData.stylePrompt || ''}
                            onChange={(e) => setPreviewData({ ...previewData, stylePrompt: e.target.value })}
                            placeholder="watercolor style"
                            className="input-field w-full text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1 block">自定义内容</label>
                          <input
                            type="text"
                            value={previewData.custom || ''}
                            onChange={(e) => setPreviewData({ ...previewData, custom: e.target.value })}
                            placeholder=""
                            className="input-field w-full text-sm"
                          />
                        </div>
                      </div>

                      <button
                        onClick={renderPreview}
                        className="btn-secondary text-sm mb-3"
                      >
                        渲染预览
                      </button>

                      {renderedPreview && (
                        <div>
                          <label className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1 block">渲染结果</label>
                          <div className="bg-light-divider dark:bg-dark-divider rounded-lg p-3 font-mono text-sm whitespace-pre-wrap text-light-text-primary dark:text-dark-text-primary">
                            {renderedPreview}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {editing ? (
                      <React.Fragment>
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
                      </React.Fragment>
                    ) : (
                      <React.Fragment>
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
                      </React.Fragment>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImagePromptManager;
