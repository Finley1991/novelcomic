import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectApi, type Project, type ProjectType } from '../services/api';
import NovelComicEditor from './NovelComicEditor';
import DecompressionVideoEditor from './DecompressionVideoEditor';

const ProjectEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadProject();
    }
  }, [id]);

  const loadProject = async () => {
    if (!id) return;
    try {
      const response = await projectApi.get(id);
      // 向后兼容：确保 type 字段存在
      const originalData = response.data || {};
      const projectData: any = {
        ...originalData,
        type: originalData.type || 'novel_comic',
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

  const handleProjectUpdate = (updatedProject: Project) => {
    setProject(updatedProject);
  };

  if (loading) {
    return <div className="card p-6 text-center">加载中...</div>;
  }

  if (!project) {
    return <div className="card p-6 text-center">项目未找到</div>;
  }

  // 根据项目类型渲染不同的编辑器
  const renderEditor = () => {
    if (project.type === 'decompression_video') {
      return (
        <DecompressionVideoEditor
          project={project}
          onProjectUpdate={handleProjectUpdate}
        />
      );
    }

    // 默认渲染 NovelComicEditor
    return (
      <NovelComicEditor
        project={project}
        onProjectUpdate={handleProjectUpdate}
      />
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <button
            onClick={() => navigate('/')}
            className="text-primary-500 hover:text-primary-600 mr-4"
          >
            ← 返回
          </button>
          <h2 className="text-2xl font-bold inline text-light-text-primary dark:text-dark-text-primary">
            {project.name}
          </h2>
          <span className="ml-3 text-sm px-2 py-1 rounded bg-light-divider dark:bg-dark-divider text-light-text-secondary dark:text-dark-text-secondary">
            {project.type === 'decompression_video' ? '解压视频' : 'AI推文'}
          </span>
        </div>
      </div>

      {renderEditor()}
    </div>
  );
};

export default ProjectEditor;
