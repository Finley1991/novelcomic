import React, { useState, useEffect } from 'react';
import {
  generationApi,
  type ProjectPromptTemplate,
  type PromptType,
} from '../services/api';

interface ProjectPromptManagerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  initialType?: PromptType;
}

const typeLabels: Record<PromptType, string> = {
  character_extraction: '角色提取',
  storyboard_split: '分镜拆分',
  image_prompt: '图像生成',
  scene_extraction: '场景提取',
};

const availableTypes: PromptType[] = ['character_extraction', 'scene_extraction', 'storyboard_split'];

const defaultTemplates: Partial<Record<PromptType, Partial<ProjectPromptTemplate>>> = {
  character_extraction: {
    name: '角色提取模板',
    description: '从小说文本中提取角色信息',
    systemPrompt: '你是一个专业的小说角色分析助手。请从给定的文本中提取所有出现的角色信息。',
    userPrompt: '请分析以下文本，提取其中的角色：\n\n{chunk}',
  },
  scene_extraction: {
    name: '场景提取模板',
    description: '从小说文本中提取场景信息',
    systemPrompt: '你是一位专业的场景设定师和概念艺术家。你的任务是从小说文本中提取所有主要场景，并为每个场景创建详细、可用于AI绘画的场景设定。',
    userPrompt: '请从以下小说文本中提取所有主要场景。\n\n对每个场景，请提供：\n1. name: 场景名称（简洁，如"客厅"、"卧室"、"森林"）\n2. description: 详细的视觉描述（包含空间布局、物体陈设、材质质感、光线氛围、时间天气、情感基调等）\n\n仅返回JSON数组，格式如下：\n[\n  {{\n    "name": "场景名称",\n    "description": "详细的视觉描述，用于AI绘画生成该场景"\n  }}\n]\n\n小说文本：\n{chunk}',
  },
  storyboard_split: {
    name: '分镜拆分模板',
    description: '按情节合理拆分小说文本，sceneDescription使用原文20-40字',
    systemPrompt: '你是一个专业的文学编辑。将小说文本按情节拆分为多个片段。\n\n【重要要求】\n1. sceneDescription 必须直接使用原文片段，不要修改或重新描述\n2. sceneDescription 的字数必须控制在 20-40 字之间（汉字）\n3. 尽量保证内容的连贯性和完整性\n4. 按自然的情节断点拆分\n5. 不需要 dialogue 和 narration 字段\n6. characterNames 必须包含该分镜中出现的所有角色\n7. 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"等），请根据上下文推断并替换为具体的角色名称',
    userPrompt: '{characters}\n{scenes}\n\n将以下小说文本按情节拆分为多个片段。\n\n重要要求：\n- sceneDescription 必须直接使用原文片段，不要修改或重新描述\n- sceneDescription 的字数必须控制在 20-40 字之间（汉字）\n- 尽量保证内容的连贯性和完整性\n- 按自然的情节断点拆分\n- 不需要 dialogue 和 narration 字段\n- characterNames 必须包含该分镜中出现的所有角色\n- 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"等），请根据上下文推断并替换为具体的角色名称\n\n对每个分镜提供：\n1. index: 序号（从{current_index}开始）\n2. sceneDescription: 原文片段（20-40字，直接复制原文）\n3. characterNames: 出现的角色名数组（代词请替换为具体角色名）\n\n仅返回JSON数组，格式如下：\n[\n  {{\n    "index": 0,\n    "sceneDescription": "原文片段（20-40字）...",\n    "characterNames": ["角色1", "角色2"]\n  }}\n]\n\n小说文本：\n{chunk}',
  },
};

export const ProjectPromptManager: React.FC<ProjectPromptManagerProps> = ({
  isOpen,
  onClose,
  projectId,
  initialType = 'character_extraction',
}) => {
  const [currentType, setCurrentType] = useState<PromptType>(initialType);
  const [templates, setTemplates] = useState<ProjectPromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectPromptTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ProjectPromptTemplate>>({});

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen, currentType, projectId]);

  const loadTemplates = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const response = await generationApi.listProjectPromptTemplates(projectId, currentType);
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

  const handleSelectTemplate = (template: ProjectPromptTemplate) => {
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
      const response = await generationApi.updateProjectPromptTemplate(
        projectId,
        selectedTemplate.id,
        editForm
      );
      setSelectedTemplate(response.data);
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
      await generationApi.deleteProjectPromptTemplate(projectId, selectedTemplate.id);
      setSelectedTemplate(null);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handleDuplicate = async () => {
    if (!selectedTemplate) return;
    const newName = prompt('请输入新模板名称:', `${selectedTemplate.name} (副本)`);
    if (!newName) return;
    try {
      const response = await generationApi.duplicateProjectPromptTemplate(
        projectId,
        selectedTemplate.id,
        newName
      );
      setSelectedTemplate(response.data);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  };

  const handleCreateTemplate = async () => {
    const name = prompt('请输入新模板名称:');
    if (!name?.trim()) return;

    const defaultData = defaultTemplates[currentType];
    try {
      const response = await generationApi.createProjectPromptTemplate(projectId, {
        name: name.trim(),
        type: currentType,
        description: defaultData?.description || '',
        systemPrompt: defaultData?.systemPrompt || '',
        userPrompt: defaultData?.userPrompt || '',
      });
      setSelectedTemplate(response.data);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  };

  const displayTemplate = editing ? editForm : selectedTemplate;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-light-divider dark:border-dark-divider flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-lg text-light-text-primary dark:text-dark-text-primary">
            项目提示词管理
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {/* 类型标签页 */}
          <div className="card p-2 mb-6">
            <div className="flex gap-2">
              {availableTypes.map((type) => (
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

          <div className="flex gap-6">
            {/* 模板列表 */}
            <div className="w-64 flex-shrink-0">
              <div className="card p-4">
                <h3 className="font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">
                  模板列表
                </h3>

                <div className="space-y-1 mb-4">
                  {templates.map((template) => (
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

                <button
                  onClick={handleCreateTemplate}
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
                  <p className="text-light-text-secondary dark:text-dark-text-secondary">请选择或创建一个模板</p>
                </div>
              ) : (
                <div className="card p-6">
                  <div className="mb-4">
                    <label className="input-label">名称</label>
                    {editing ? (
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="input-field w-full"
                        maxLength={100}
                      />
                    ) : (
                      <div className="text-lg font-medium text-light-text-primary dark:text-dark-text-primary">
                        {displayTemplate.name}
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="input-label">描述</label>
                    {editing ? (
                      <input
                        type="text"
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="input-field w-full"
                      />
                    ) : (
                      <div className="text-light-text-secondary dark:text-dark-text-secondary">
                        {displayTemplate.description || '无描述'}
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="input-label">类型</label>
                    <div className="text-light-text-primary dark:text-dark-text-primary">
                      {typeLabels[displayTemplate.type as PromptType]}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="input-label">System Prompt</label>
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
                    <label className="input-label">User Prompt</label>
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

                  <div className="flex gap-2">
                    {editing ? (
                      <>
                        <button onClick={saveEdit} className="btn-primary">
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
                        <button onClick={startEdit} className="btn-primary">
                          编辑
                        </button>
                        <button onClick={handleDuplicate} className="btn-secondary">
                          复制
                        </button>
                        <button
                          onClick={handleDelete}
                          className="btn-secondary text-red-500 hover:text-red-600 hover:border-red-300 dark:hover:border-red-700"
                        >
                          删除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
