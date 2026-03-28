import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectApi, type ProjectType } from '../services/api';
import { useToast } from '../hooks/useToast';

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectText, setNewProjectText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProjectType, setSelectedProjectType] = useState<ProjectType>('novel_comic');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await projectApi.list();
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newProjectName.trim()) return;

    setIsCreating(true);
    try {
      console.log('Creating project with:', {
        name: newProjectName,
        type: selectedProjectType,
        sourceText: selectedProjectType === 'novel_comic' ? newProjectText || undefined : undefined
      });
      const response = await projectApi.create(
        newProjectName,
        selectedProjectType === 'novel_comic' ? newProjectText || undefined : undefined,
        selectedProjectType
      );
      console.log('Project created:', response.data);
      setShowCreateModal(false);
      navigate(`/project/${response.data.id}`);
    } catch (error: any) {
      console.error('Failed to create project:', error);
      toast({
        type: 'error',
        title: '创建项目失败',
        message: error?.response?.data?.detail || error?.message || '请重试'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('确定要删除这个项目吗？')) return;
    try {
      await projectApi.delete(id);
      loadProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6">
            <div className="h-6 w-1/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded mt-4 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
          我的项目
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          + 新建项目
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
        <div
          key={project.id}
          className="card p-6 cursor-pointer"
          onClick={() => navigate(`/project/${project.id}`)}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                {project.name}
              </h3>
              <div className="flex gap-2">
                {(!project.type || project.type === 'novel_comic') && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded dark:bg-blue-900/30 dark:text-blue-300">AI推文</span>
                )}
                {project.type === 'decompression_video' && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded dark:bg-green-900/30 dark:text-green-300">解压视频</span>
                )}
              </div>
            </div>
            <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => navigate(`/project/${project.id}`)}
                className="btn-icon"
                title="编辑"
              >
                ✏️
              </button>
              <button
                onClick={() => handleDeleteProject(project.id)}
                className="btn-icon text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10"
                title="删除"
              >
                🗑️
              </button>
            </div>
          </div>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
            创建于: {new Date(project.createdAt).toLocaleDateString()}
          </p>
          {/* Progress indicator placeholder */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-light-divider dark:bg-dark-divider rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full"
                style={{ width: '0%' }}
              />
            </div>
            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              0%
            </span>
          </div>
        </div>
      ))}
      </div>

      {projects.length === 0 && (
        <div className="card p-12 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
            还没有项目
          </h3>
          <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
            点击上方按钮创建你的第一个项目
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            创建项目
          </button>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-lg modal-enter">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                创建新项目
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-icon"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="input-label">项目名称</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="input-field w-full"
                  placeholder="输入项目名称"
                  autoFocus
                />
              </div>
              <div>
                <label className="block input-label mb-2">项目类型</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setSelectedProjectType('novel_comic')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedProjectType === 'novel_comic'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="text-2xl mb-2">🎬</div>
                    <div className="font-medium text-light-text-primary dark:text-dark-text-primary">AI推文视频项目</div>
                    <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">小说转漫剧</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProjectType('decompression_video')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedProjectType === 'decompression_video'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="text-2xl mb-2">🎮</div>
                    <div className="font-medium text-light-text-primary dark:text-dark-text-primary">解压视频混剪项目</div>
                    <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">视频+图片混剪</div>
                  </button>
                </div>
              </div>
              {selectedProjectType === 'novel_comic' && (
                <div>
                  <label className="input-label">小说文本（可选）</label>
                  <textarea
                    value={newProjectText}
                    onChange={(e) => setNewProjectText(e.target.value)}
                    className="input-field w-full h-32 resize-none"
                    placeholder="粘贴小说文本..."
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                  disabled={isCreating}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={!newProjectName.trim() || isCreating}
                >
                  {isCreating ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
