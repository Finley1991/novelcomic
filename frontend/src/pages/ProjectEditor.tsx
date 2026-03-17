import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  projectApi,
  characterApi,
  storyboardApi,
  generationApi,
  exportApi,
  type Project,
  type Character,
  type Storyboard,
} from '../services/api';

const ProjectEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (id) {
      loadProject();
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
      await storyboardApi.split(id);
      await loadProject();
    } catch (error) {
      console.error('Failed to split storyboard:', error);
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

  const handleExportJianying = async () => {
    if (!id) return;
    try {
      const response = await exportApi.exportJianying(id);
      if (response.data.downloadUrl) {
        window.location.href = response.data.downloadUrl;
      }
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  const steps = [
    { name: '角色管理', onClick: () => setCurrentStep(0) },
    { name: '剧本拆分', onClick: () => setCurrentStep(1) },
    { name: '图片生成', onClick: () => setCurrentStep(2) },
    { name: '配音生成', onClick: () => setCurrentStep(3) },
    { name: '导出剪映', onClick: () => setCurrentStep(4) },
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
      </div>

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
                  <h4 className="font-semibold">{char.name}</h4>
                  <p className="text-sm text-gray-600">{char.description}</p>
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
              <button
                onClick={handleSplitStoryboard}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
              >
                自动拆分剧本
              </button>
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
            <div className="space-y-2">
              {project.storyboards.map((sb) => (
                <div key={sb.id} className="border rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <span className="font-medium">分镜 {sb.index + 1}</span>
                    {sb.audioDuration > 0 && (
                      <span className="text-sm text-gray-500 ml-2">
                        ({sb.audioDuration.toFixed(1)}秒)
                      </span>
                    )}
                  </div>
                  <div>
                    {sb.audioStatus === 'completed' && sb.audioPath ? (
                      <audio controls className="h-8">
                        <source src={`/data/projects/${id}/${sb.audioPath}`} />
                      </audio>
                    ) : (
                      <span className="text-sm text-gray-400">
                        {sb.audioStatus === 'generating' ? '生成中...' :
                         sb.audioStatus === 'failed' ? '失败' : '待生成'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">导出剪映草稿</h3>
            <p className="text-gray-600 mb-6">
              点击下方按钮导出剪映草稿 ZIP 文件，解压后用剪映打开即可编辑。
            </p>
            <button
              onClick={handleExportJianying}
              className="bg-green-500 text-white px-6 py-3 rounded-md hover:bg-green-600 text-lg"
            >
              📥 导出剪映草稿
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectEditor;
