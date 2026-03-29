import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  projectApi,
  decompressionApi,
  type Project,
  type DecompressionProjectData,
  type MotionConfig,
} from '../services/api';
import { WizardSteps, type WizardStep } from '../components/project/WizardSteps';
import { useToast } from '../hooks/useToast';

// 解压视频编辑器的向导步骤定义
const decompressionWizardSteps: Omit<WizardStep, 'status'>[] = [
  { id: 0, label: '文本输入', icon: '1' },
  { id: 1, label: '配音生成', icon: '2' },
  { id: 2, label: '素材选择', icon: '3' },
  { id: 3, label: '图片生成', icon: '4' },
  { id: 4, label: '导出交付', icon: '5' },
];

interface DecompressionVideoEditorProps {
  project: Project;
  onProjectUpdate: (project: Project) => void;
}

const DecompressionVideoEditor: React.FC<DecompressionVideoEditorProps> = ({
  project: initialProject,
  onProjectUpdate,
}) => {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();
  const [project, setProject] = useState<Project>(initialProject);
  const [currentStep, setCurrentStep] = useState(0);
  const [polling, setPolling] = useState(false);

  // 视频素材和风格相关状态
  const [availableVideos, setAvailableVideos] = useState<
    { filePath: string; fileName: string; duration: number }[]
  >([]);
  const [availableStyles, setAvailableStyles] = useState<string[]>([]);
  const [selectedStylePrompts, setSelectedStylePrompts] = useState<string[]>(
    []
  );
  const [scanningVideos, setScanningVideos] = useState(false);
  const [scanningStyles, setScanningStyles] = useState(false);

  // 生成相关状态
  const [splittingText, setSplittingText] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [selectingVideos, setSelectingVideos] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [exportingJianying, setExportingJianying] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [generateImagesError, setGenerateImagesError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  // 上传相关状态
  const [uploadingSubtitle, setUploadingSubtitle] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const subtitleFileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);

  // 图片动效相关
  const [imageMotion, setImageMotion] = useState<MotionConfig>({
    type: 'zoom_in',
    startScale: 1.0,
    endScale: 1.2,
    startX: 0,
    endX: 0,
    startY: 0,
    endY: 0,
  });

  // 本地文本状态，避免每次输入都调用 API
  const [localSourceText, setLocalSourceText] = useState('');

  useEffect(() => {
    setProject(initialProject);
    // 初始化本地文本状态
    const data = initialProject.decompressionData;
    if (data) {
      setLocalSourceText(data.sourceText || '');
    } else {
      setLocalSourceText(initialProject.sourceText || '');
    }
  }, [initialProject]);

  useEffect(() => {
    loadVideos();
    loadStyles();
  }, []);

  const loadProject = async () => {
    if (!id) return;
    try {
      const response = await projectApi.get(id);
      setProject(response.data);
      onProjectUpdate(response.data);
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const loadVideos = async () => {
    try {
      const response = await decompressionApi.listVideos();
      setAvailableVideos(response.data);
    } catch (error) {
      console.error('Failed to load videos:', error);
    }
  };

  const loadStyles = async () => {
    try {
      const response = await decompressionApi.listStyles();
      setAvailableStyles(response.data);
    } catch (error) {
      console.error('Failed to load styles:', error);
    }
  };

  const handleScanVideos = async () => {
    setScanningVideos(true);
    try {
      const response = await decompressionApi.scanVideos();
      setAvailableVideos(response.data);
    } catch (error) {
      console.error('Failed to scan videos:', error);
    } finally {
      setScanningVideos(false);
    }
  };

  const handleScanStyles = async () => {
    setScanningStyles(true);
    try {
      const response = await decompressionApi.scanStyles();
      setAvailableStyles(response.data);
    } catch (error) {
      console.error('Failed to scan styles:', error);
    } finally {
      setScanningStyles(false);
    }
  };

  const handleStyleSelect = async (styleName: string) => {
    if (!id) return;
    try {
      const response = await decompressionApi.getStylePrompts(styleName);
      setSelectedStylePrompts(response.data);

      // Save to backend first
      const updateResponse = await decompressionApi.updateData(id, { selectedStyle: styleName });

      // Update local state with response from backend
      setProject(updateResponse.data);
      onProjectUpdate(updateResponse.data);
    } catch (error) {
      console.error('Failed to load style prompts:', error);
    }
  };

  const handleUpdateSourceText = (text: string) => {
    setLocalSourceText(text);
  };

  const saveSourceText = async () => {
    if (!id) return;
    try {
      // 同时更新 project.sourceText 和 decompressionData.sourceText
      const updatedProject = {
        ...project,
        sourceText: localSourceText,
        decompressionData: project.decompressionData ? {
          ...project.decompressionData,
          sourceText: localSourceText,
        } : undefined,
      } as Project;
      setProject(updatedProject);
      onProjectUpdate(updatedProject);

      // 保存到后端
      await projectApi.update(id, { sourceText: localSourceText });
    } catch (error) {
      console.error('Failed to save source text:', error);
    }
  };

  const handleSplitText = async () => {
    if (!id) return;
    setSplittingText(true);
    setProgress(0);
    setStatusText('正在保存文本...');
    try {
      // 先保存文本到后端
      await saveSourceText();
      setStatusText('正在拆分文本...');
      setProgress(30);
      await decompressionApi.splitText(id);
      setProgress(100);
      setStatusText('完成！');
      await loadProject();
      setTimeout(() => {
        setSplittingText(false);
        setProgress(0);
        setStatusText('');
      }, 1000);
    } catch (error) {
      console.error('Failed to split text:', error);
      setSplittingText(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!id) return;
    setGeneratingAudio(true);
    setPolling(true);
    setProgress(0);
    setStatusText('正在生成配音...');
    try {
      await decompressionApi.generateAudio(id);

      // 开始轮询进度
      const pollInterval = setInterval(async () => {
        try {
          const response = await projectApi.get(id);
          const latestProject = response.data;
          setProject(latestProject);
          onProjectUpdate(latestProject);

          const data = latestProject.decompressionData;
          if (data) {
            const total = data.textSegments.length;
            const completed = data.audioClips.filter(
              (c) => c.status === 'completed' || c.status === 'failed'
            ).length;
            const inProgress = data.audioClips.filter(
              (c) => c.status === 'generating'
            ).length;

            if (total > 0) {
              setProgress(Math.round((completed / total) * 100));
              if (inProgress > 0) {
                setStatusText(`正在生成配音 (${completed}/${total})...`);
              } else if (completed === total) {
                setStatusText('完成！');
                clearInterval(pollInterval);
                setPolling(false);
                setTimeout(() => {
                  setGeneratingAudio(false);
                  setProgress(0);
                  setStatusText('');
                }, 1000);
              }
            }
          }
        } catch (error) {
          console.error('Failed to poll audio status:', error);
        }
      }, 1000);
    } catch (error: any) {
      console.error('Failed to generate audio:', error);
      setGeneratingAudio(false);
      setPolling(false);
    }
  };

  const handleSelectVideos = async () => {
    if (!id) return;
    setSelectingVideos(true);
    setProgress(0);
    setStatusText('正在选择视频素材...');
    try {
      await decompressionApi.selectVideos(id);
      setProgress(100);
      setStatusText('完成！');
      await loadProject();
      setTimeout(() => {
        setSelectingVideos(false);
        setProgress(0);
        setStatusText('');
      }, 1000);
    } catch (error) {
      console.error('Failed to select videos:', error);
      setSelectingVideos(false);
    }
  };

  const handleGenerateImages = async (forceRegenerate: boolean = false) => {
    if (!id) return;
    setGeneratingImages(true);
    setProgress(0);
    setStatusText('正在生成图片...');
    setGenerateImagesError(null);
    try {
      await decompressionApi.generateImages(id, forceRegenerate);
      setPolling(true);
      // Start polling for progress
      const pollInterval = setInterval(async () => {
        const response = await projectApi.get(id);
        const latestProject = response.data;
        setProject(latestProject);
        onProjectUpdate(latestProject);

        const data = latestProject.decompressionData;
        if (data && data.imageClips.length > 0) {
          const total = data.imageClips.length;
          const completed = data.imageClips.filter(
            (c) => c.status === 'completed'
          ).length;
          const failed = data.imageClips.filter(
            (c) => c.status === 'failed'
          ).length;
          const cancelled = data.imageClips.filter(
            (c) => c.status === 'cancelled'
          ).length;
          const doneCount = completed + failed + cancelled;

          if (total > 0) {
            setProgress(Math.round((doneCount / total) * 100));
            if (cancelled > 0) {
              setStatusText(`生成已取消 (${completed}/${total} 完成, ${cancelled} 已取消)`);
            } else {
              setStatusText(`正在生成图片... (${completed}/${total})`);
            }
          }
          if (doneCount >= total && total > 0) {
            clearInterval(pollInterval);
            setPolling(false);
            setProgress(100);
            setStatusText(cancelled > 0 ? `生成已取消 (${completed} 完成, ${cancelled} 已取消)` : '完成！');
            setTimeout(() => {
              setGeneratingImages(false);
              setProgress(0);
              setStatusText('');
            }, 1500);
          }
        }
      }, 2000);
    } catch (error: any) {
      console.error('Failed to generate images:', error);
      const errorMsg = error.response?.data?.detail || error.message || '未知错误';
      setGenerateImagesError(errorMsg);
      setGeneratingImages(false);
      setPolling(false);
    }
  };

  const handleCancelImageGeneration = async () => {
    if (!id) return;
    try {
      await decompressionApi.cancelImageGeneration(id);
      addToast({
        type: 'info',
        message: '已发送取消请求，正在停止生成...',
      });
    } catch (error: any) {
      console.error('Failed to cancel image generation:', error);
      addToast({
        type: 'error',
        message: error.response?.data?.detail || '取消生成失败',
      });
    }
  };

  const handleExportJianying = async () => {
    if (!id) return;
    setExportingJianying(true);
    setExportResult(null);
    try {
      const response = await decompressionApi.exportJianying(id);
      setExportResult({
        success: true,
        message: `导出成功！草稿路径: ${response.data.draftPath || '未知'}`,
      });
    } catch (error: any) {
      setExportResult({
        success: false,
        message: `导出失败: ${error.response?.data?.detail || error.message}`,
      });
    } finally {
      setExportingJianying(false);
    }
  };

  const getWizardSteps = (): WizardStep[] => {
    return decompressionWizardSteps.map((step, index) => ({
      ...step,
      status:
        index < currentStep
          ? 'completed'
          : index === currentStep
          ? 'current'
          : 'pending',
    }));
  };

  // 字幕上传处理
  const handleUploadSubtitle = async (file: File) => {
    if (!id) return;
    setUploadingSubtitle(true);
    console.log('开始上传字幕文件:', file.name, file.size, file.type);
    try {
      const response = await decompressionApi.uploadSubtitle(id, file);
      console.log('上传成功，响应数据:', response.data);
      setLocalSourceText(response.data.textSegments.map((t: any) => t.text).join('\n'));
      await loadProject();
      addToast({
        type: 'success',
        message: `字幕上传成功！共 ${response.data.textSegments.length} 个片段`,
      });
    } catch (error: any) {
      console.error('字幕上传失败 - 详细错误:', error);
      console.error('错误响应:', error?.response);
      console.error('错误消息:', error?.message);
      const errorMsg = error?.response?.data?.detail || error?.message || '字幕上传失败，请重试';
      addToast({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setUploadingSubtitle(false);
    }
  };

  const handleDeleteSubtitle = async () => {
    if (!id) return;
    try {
      await decompressionApi.deleteSubtitle(id);
      await loadProject();
      addToast({
        type: 'success',
        message: '字幕已删除',
      });
    } catch (error: any) {
      console.error('删除字幕失败:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || '删除字幕失败';
      addToast({
        type: 'error',
        message: errorMsg,
      });
    }
  };

  // 音频上传处理
  const handleUploadAudio = async (file: File) => {
    if (!id) return;
    setUploadingAudio(true);
    console.log('开始上传音频文件:', file.name, file.size, file.type);
    try {
      const response = await decompressionApi.uploadAudio(id, file);
      console.log('音频上传成功，响应数据:', response.data);
      await loadProject();
      addToast({
        type: 'success',
        message: `音频上传成功：${file.name}`,
      });
    } catch (error: any) {
      console.error('音频上传失败 - 详细错误:', error);
      console.error('错误响应:', error?.response);
      const errorMsg = error?.response?.data?.detail || error?.message || '音频上传失败，请重试';
      addToast({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleUploadAudios = async (files: FileList) => {
    if (!id) return;
    setUploadingAudio(true);
    console.log('开始批量上传音频文件，数量:', files.length);
    try {
      const fileArray = Array.from(files);
      const response = await decompressionApi.uploadAudios(id, fileArray);
      console.log('批量上传成功，响应数据:', response.data);
      await loadProject();
      addToast({
        type: 'success',
        message: `成功上传 ${fileArray.length} 个音频文件`,
      });
    } catch (error: any) {
      console.error('批量上传音频失败 - 详细错误:', error);
      console.error('错误响应:', error?.response);
      const errorMsg = error?.response?.data?.detail || error?.message || '音频上传失败，请重试';
      addToast({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleDeleteUploadedAudios = async () => {
    if (!id) return;
    try {
      await decompressionApi.deleteUploadedAudios(id);
      await loadProject();
      addToast({
        type: 'success',
        message: '已清空上传的音频',
      });
    } catch (error: any) {
      console.error('清空音频失败:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || '清空音频失败';
      addToast({
        type: 'error',
        message: errorMsg,
      });
    }
  };

  const getData = (): DecompressionProjectData => {
    const baseData = project.decompressionData;
    const defaultData = {
      sourceText: project.sourceText || '',
      textSegments: [],
      audioClips: [],
      totalAudioDuration: 0,
      videoClips: [],
      imageClips: [],
      status: 'idle',
      subtitleSegments: [],
      uploadedAudioFiles: [],
    };
    // 使用本地 sourceText 而不是数据中的
    return {
      ...defaultData,
      ...baseData,
      sourceText: localSourceText,
      // 确保新字段有默认值
      subtitleSegments: baseData?.subtitleSegments ?? [],
      uploadedAudioFiles: baseData?.uploadedAudioFiles ?? [],
    };
  };

  const data = getData();

  // 判断是否有音频（不管是生成的还是上传的）
  const hasAudio = data.audioClips.length > 0 || data.uploadedAudioFiles.length > 0;

  return (
    <div>
      {/* Wizard Steps Navigation */}
      <WizardSteps
        steps={getWizardSteps()}
        currentStep={currentStep}
        onStepClick={(stepId) => setCurrentStep(stepId)}
      />

      <div className="card p-6">
        {/* Step 0: 文本输入 */}
        {currentStep === 0 && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                文本输入
              </h3>
              <div className="flex gap-3">
                <input
                  ref={subtitleFileRef}
                  type="file"
                  accept=".srt,.vtt,.lrc,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadSubtitle(e.target.files[0]);
                    }
                  }}
                />
                {data.subtitleFilePath ? (
                  <button
                    onClick={handleDeleteSubtitle}
                    className="btn-secondary text-red-500 hover:text-red-600 hover:border-red-300 dark:hover:border-red-700"
                  >
                    删除字幕
                  </button>
                ) : (
                  <button
                    onClick={() => subtitleFileRef.current?.click()}
                    disabled={uploadingSubtitle}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingSubtitle ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin">⟳</span> 上传中...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span>📝</span> 上传字幕文件
                      </span>
                    )}
                  </button>
                )}
                <button
                  onClick={handleSplitText}
                  disabled={splittingText || !data.sourceText.trim()}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {splittingText ? '拆分中...' : '按行拆分文本'}
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* 字幕上传提示 */}
              <div className="bg-secondary-50 dark:bg-secondary-500/10 rounded-xl p-4 border border-secondary-200 dark:border-secondary-500/20">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary-100 dark:bg-secondary-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-secondary-600 dark:text-secondary-400">💡</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
                      支持两种方式输入文本
                    </h4>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      方式1：直接在下方文本框中粘贴文本，然后点击"按行拆分文本"
                    </p>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                      方式2：点击"上传字幕文件"（支持 .srt, .vtt, .lrc, .txt 格式）
                    </p>
                  </div>
                </div>
              </div>

              {data.subtitleFilePath && (
                <div className="bg-success-50 dark:bg-success-500/10 rounded-xl p-4 border border-success-200 dark:border-success-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-success-100 dark:bg-success-500/20 flex items-center justify-center">
                      <span className="text-success-600 dark:text-success-400">✓</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary">
                        已上传字幕
                      </h4>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {data.subtitleSegments.length} 个字幕片段
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="input-label">文本内容</label>
                <textarea
                  value={localSourceText}
                  onChange={(e) => handleUpdateSourceText(e.target.value)}
                  className="input-field w-full h-64 resize-none"
                  placeholder="粘贴小说文本..."
                />
              </div>

              {splittingText && (
                <div className="bg-light-divider dark:bg-dark-divider rounded-lg p-4">
                  <div className="flex justify-between text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">
                    <span>{statusText}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-light-border dark:bg-dark-border rounded-full h-3">
                    <div
                      className="bg-primary-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {data.textSegments.length > 0 && (
                <div>
                  <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-4">
                    拆分结果 ({data.textSegments.length} 段)
                  </h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {data.textSegments.map((segment) => (
                      <div
                        key={segment.id}
                        className="border border-light-border dark:border-dark-border rounded-lg p-3"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            第 {segment.index + 1} 段
                          </span>
                        </div>
                        <p className="text-sm text-light-text-primary dark:text-dark-text-primary">
                          {segment.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 1: 配音生成 */}
        {currentStep === 1 && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                配音生成
              </h3>
              <div className="flex gap-3">
                <input
                  ref={audioFileRef}
                  type="file"
                  accept=".wav,.mp3,.m4a"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      if (e.target.files.length === 1) {
                        handleUploadAudio(e.target.files[0]);
                      } else {
                        handleUploadAudios(e.target.files);
                      }
                    }
                  }}
                />
                {data.uploadedAudioFiles.length > 0 && (
                  <button
                    onClick={handleDeleteUploadedAudios}
                    className="btn-secondary text-red-500 hover:text-red-600 hover:border-red-300 dark:hover:border-red-700"
                  >
                    清空上传
                  </button>
                )}
                <button
                  onClick={() => audioFileRef.current?.click()}
                  disabled={uploadingAudio}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingAudio ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⟳</span> 上传中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span>🎵</span> 上传音频文件
                    </span>
                  )}
                </button>
                <button
                  onClick={handleGenerateAudio}
                  disabled={
                    generatingAudio || data.textSegments.length === 0
                  }
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingAudio ? '生成中...' : '批量生成配音'}
                </button>
              </div>
            </div>

            {/* 音频上传提示 */}
            <div className="bg-secondary-50 dark:bg-secondary-500/10 rounded-xl p-4 border border-secondary-200 dark:border-secondary-500/20 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary-100 dark:bg-secondary-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-secondary-600 dark:text-secondary-400">💡</span>
                </div>
                <div>
                  <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
                    支持两种方式添加配音
                  </h4>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    方式1：点击"批量生成配音"使用AI生成配音
                  </p>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                    方式2：点击"上传音频文件"上传已有的音频文件（支持 .wav, .mp3, .m4a）
                  </p>
                  <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary mt-2">
                    提示：可以一次性选择多个音频文件上传
                  </p>
                </div>
              </div>
            </div>

            {uploadingAudio && (
              <div className="mb-6 bg-light-divider dark:bg-dark-divider rounded-lg p-4">
                <div className="flex justify-between text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">
                  <span>正在上传音频...</span>
                </div>
                <div className="w-full bg-light-border dark:bg-dark-border rounded-full h-3">
                  <div
                    className="bg-primary-500 h-3 rounded-full transition-all duration-300 animate-pulse"
                    style={{ width: '60%' }}
                  ></div>
                </div>
              </div>
            )}

            {data.uploadedAudioFiles.length > 0 && (
              <div className="mb-6 bg-success-50 dark:bg-success-500/10 rounded-xl p-4 border border-success-200 dark:border-success-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-success-100 dark:bg-success-500/20 flex items-center justify-center">
                    <span className="text-success-600 dark:text-success-400">✓</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary">
                      已上传音频
                    </h4>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      {data.uploadedAudioFiles.length} 个音频文件 · 总时长 {data.totalAudioDuration.toFixed(1)} 秒
                    </p>
                  </div>
                </div>
              </div>
            )}

            {generatingAudio && (
              <div className="mb-6 bg-light-divider dark:bg-dark-divider rounded-lg p-4">
                <div className="flex justify-between text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">
                  <span>{statusText}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-light-border dark:bg-dark-border rounded-full h-3">
                  <div
                    className="bg-success-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {data.audioClips.length > 0 && (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {data.audioClips.map((clip) => (
                  <div
                    key={clip.id}
                    className="border border-light-border dark:border-dark-border rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                        第 {clip.index + 1} 段
                      </span>
                      <div className="flex items-center gap-2">
                        {clip.duration > 0 && (
                          <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            ({clip.duration.toFixed(1)}秒)
                          </span>
                        )}
                        <span
                          className={`text-sm px-2 py-1 rounded ${
                            clip.status === 'completed'
                              ? 'bg-success-100 text-success-700 dark:bg-success-500/10 dark:text-success-300'
                              : clip.status === 'generating'
                              ? 'bg-secondary-100 text-secondary-700 dark:bg-secondary-500/10 dark:text-secondary-300'
                              : clip.status === 'failed'
                              ? 'bg-error-100 text-error-700 dark:bg-error-500/10 dark:text-error-300'
                              : 'bg-light-divider text-light-text-secondary dark:bg-dark-divider dark:text-dark-text-secondary'
                          }`}
                        >
                          {clip.status === 'completed'
                            ? '已完成'
                            : clip.status === 'generating'
                            ? '生成中'
                            : clip.status === 'failed'
                            ? '失败'
                            : '待生成'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-3">
                      {clip.text}
                    </p>
                    {clip.status === 'completed' && clip.audioPath && (
                      <audio controls className="h-10 w-full">
                        <source src={`/data/projects/${id}/${clip.audioPath}`} />
                      </audio>
                    )}
                  </div>
                ))}
              </div>
            )}

            {data.audioClips.length === 0 && data.uploadedAudioFiles.length === 0 &&
              data.textSegments.length > 0 && (
                <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
                  点击上方按钮生成配音或上传音频文件
                </div>
              )}

            {data.textSegments.length === 0 && data.uploadedAudioFiles.length === 0 && (
              <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
                请先完成文本拆分或上传音频文件
              </div>
            )}
          </div>
        )}

        {/* Step 2: 素材选择 */}
        {currentStep === 2 && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                素材选择
              </h3>
              <button
                onClick={handleSelectVideos}
                disabled={
                  selectingVideos || !hasAudio
                }
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectingVideos ? '选择中...' : '自动选择视频素材'}
              </button>
            </div>

            <div className="space-y-8 mb-6">
              {/* 视频素材 */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center">
                      <span className="text-primary-600 dark:text-primary-400 text-lg">🎬</span>
                    </div>
                    <h4 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                      视频素材库
                    </h4>
                    <span className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary bg-light-divider dark:bg-dark-divider px-2 py-1 rounded-full">
                      {availableVideos.length} 个
                    </span>
                  </div>
                  <button
                    onClick={handleScanVideos}
                    disabled={scanningVideos}
                    className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {scanningVideos ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin">⟳</span> 扫描中...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span>⟳</span> 重新扫描
                      </span>
                    )}
                  </button>
                </div>

                <div className="card p-4">
                  {availableVideos.length > 0 ? (
                    <div className="relative">
                      <div className="flex gap-3 overflow-x-auto pb-2 scroll-smooth snap-x" style={{ scrollbarWidth: 'thin' }}>
                        {availableVideos.map((video, idx) => (
                          <div
                            key={idx}
                            className="flex-shrink-0 snap-start w-56"
                          >
                            <div className="bg-light-divider dark:bg-dark-divider rounded-xl p-4 h-full transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-lg flex-shrink-0">
                                  📹
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary truncate" title={video.fileName}>
                                    {video.fileName}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary bg-light-card dark:bg-dark-card px-2 py-1 rounded-full">
                                  <span>⏱</span>
                                  <span>{video.duration.toFixed(1)}秒</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-center mt-2">
                        <span className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                          ← 左右滑动查看更多 →
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-light-divider dark:bg-dark-divider flex items-center justify-center">
                        <span className="text-3xl text-light-text-tertiary dark:text-dark-text-tertiary">📭</span>
                      </div>
                      <p className="text-light-text-secondary dark:text-dark-text-secondary">
                        暂无视频素材
                      </p>
                      <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary mt-1">
                        请在设置中配置解压视频素材目录
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 风格提示词 */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary-100 dark:bg-secondary-500/20 flex items-center justify-center">
                      <span className="text-secondary-600 dark:text-secondary-400 text-lg">🎨</span>
                    </div>
                    <h4 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                      图片风格
                    </h4>
                    <span className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary bg-light-divider dark:bg-dark-divider px-2 py-1 rounded-full">
                      {availableStyles.length} 种
                    </span>
                  </div>
                  <button
                    onClick={handleScanStyles}
                    disabled={scanningStyles}
                    className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {scanningStyles ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin">⟳</span> 扫描中...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span>⟳</span> 重新扫描
                      </span>
                    )}
                  </button>
                </div>

                <div className="card p-4">
                  {availableStyles.length > 0 ? (
                    <div className="relative">
                      <div className="flex gap-3 overflow-x-auto pb-2 scroll-smooth snap-x" style={{ scrollbarWidth: 'thin' }}>
                        {availableStyles.map((style) => (
                          <button
                            key={style}
                            onClick={() => handleStyleSelect(style)}
                            className={`flex-shrink-0 snap-start w-48 p-4 rounded-xl text-left transition-all duration-200 border-2 ${
                              project.decompressionData?.selectedStyle === style
                                ? 'border-primary-500 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-500/20 dark:to-primary-500/10 shadow-md -translate-y-0.5'
                                : 'border-transparent bg-light-divider dark:bg-dark-divider hover:bg-light-border dark:hover:bg-dark-border hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                                project.decompressionData?.selectedStyle === style
                                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white'
                                  : 'bg-light-card dark:bg-dark-card text-light-text-secondary dark:text-dark-text-secondary'
                              }`}>
                                {project.decompressionData?.selectedStyle === style ? '✓' : '✨'}
                              </div>
                              {project.decompressionData?.selectedStyle === style && (
                                <span className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-500/20 px-2 py-1 rounded-full">
                                  已选择
                                </span>
                              )}
                            </div>
                            <div className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                              {style}
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-center mt-2">
                        <span className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                          ← 左右滑动查看更多 →
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-light-divider dark:bg-dark-divider flex items-center justify-center">
                        <span className="text-3xl text-light-text-tertiary dark:text-dark-text-tertiary">🎭</span>
                      </div>
                      <p className="text-light-text-secondary dark:text-dark-text-secondary">
                        暂无风格
                      </p>
                      <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary mt-1">
                        请在设置中配置风格提示词目录
                      </p>
                    </div>
                  )}
                </div>

                {selectedStylePrompts.length > 0 && (
                  <div className="mt-6 card p-5 border-l-4 border-primary-500">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center">
                        <span className="text-primary-600 dark:text-primary-400">📝</span>
                      </div>
                      <h5 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                        提示词预览
                      </h5>
                    </div>
                    <div className="bg-light-divider dark:bg-dark-divider rounded-xl p-4 space-y-2">
                      {selectedStylePrompts.map((prompt, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <span className="text-primary-500 mt-0.5">•</span>
                          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                            {prompt}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectingVideos && (
              <div className="mb-6 bg-light-divider dark:bg-dark-divider rounded-lg p-4">
                <div className="flex justify-between text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">
                  <span>{statusText}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-light-border dark:bg-dark-border rounded-full h-3">
                  <div
                    className="bg-primary-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {data.videoClips.length > 0 && (
              <div className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-success-100 dark:bg-success-500/20 flex items-center justify-center">
                    <span className="text-success-600 dark:text-success-400 text-lg">✓</span>
                  </div>
                  <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                    已选择的视频
                  </h4>
                  <span className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary bg-success-100 dark:bg-success-500/20 text-success-700 dark:text-success-300 px-2 py-1 rounded-full">
                    {data.videoClips.length} 个
                  </span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {data.videoClips.map((clip, index) => (
                    <div
                      key={clip.id}
                      className="bg-light-divider dark:bg-dark-divider rounded-xl p-4 flex items-center gap-4 transition-all duration-150 hover:bg-light-border dark:hover:bg-dark-border"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-success-500 to-success-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary truncate" title={clip.fileName}>
                          {clip.fileName}
                        </div>
                        <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                          时间轴: {clip.startTime.toFixed(1)}s - {clip.endTime.toFixed(1)}s
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center gap-1 text-xs text-light-text-secondary dark:text-dark-text-secondary bg-light-card dark:bg-dark-card px-3 py-1 rounded-full">
                          <span>⏱</span>
                          <span>{(clip.endTime - clip.startTime).toFixed(1)}s</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: 图片生成 */}
        {currentStep === 3 && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                图片生成
              </h3>
              <div className="flex gap-3">
                {generatingImages && (
                  <button
                    onClick={handleCancelImageGeneration}
                    className="btn-danger"
                  >
                    取消生成
                  </button>
                )}
                <button
                  onClick={() => handleGenerateImages(data.imageClips.some(c => c.status === 'completed' || c.status === 'failed'))}
                  disabled={
                    generatingImages ||
                    !hasAudio ||
                    !data.selectedStyle ||
                    data.totalAudioDuration <= 0
                  }
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingImages
                    ? '生成中...'
                    : data.imageClips.some(c => c.status === 'completed' || c.status === 'failed')
                    ? '重新生成'
                    : '批量生成图片'}
                </button>
              </div>
            </div>

            {/* 动效设置 */}
            <div className="mb-6 p-4 bg-light-divider dark:bg-dark-divider rounded-lg">
              <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-4">
                图片动效设置
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">动效类型</label>
                  <select
                    value={imageMotion.type}
                    onChange={(e) =>
                      setImageMotion({
                        ...imageMotion,
                        type: e.target.value as any,
                      })
                    }
                    className="input-field w-full"
                  >
                    <option value="none">无</option>
                    <option value="pan_left">向左平移</option>
                    <option value="pan_right">向右平移</option>
                    <option value="pan_up">向上平移</option>
                    <option value="pan_down">向下平移</option>
                    <option value="zoom_in">放大</option>
                    <option value="zoom_out">缩小</option>
                  </select>
                </div>
                {imageMotion.type.startsWith('zoom') && (
                  <>
                    <div>
                      <label className="input-label">起始缩放</label>
                      <input
                        type="number"
                        step="0.1"
                        value={imageMotion.startScale}
                        onChange={(e) =>
                          setImageMotion({
                            ...imageMotion,
                            startScale: parseFloat(e.target.value),
                          })
                        }
                        className="input-field w-full"
                      />
                    </div>
                    <div>
                      <label className="input-label">结束缩放</label>
                      <input
                        type="number"
                        step="0.1"
                        value={imageMotion.endScale}
                        onChange={(e) =>
                          setImageMotion({
                            ...imageMotion,
                            endScale: parseFloat(e.target.value),
                          })
                        }
                        className="input-field w-full"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 错误提示 */}
            {generateImagesError && (
              <div className="mb-6 p-4 bg-error-50 dark:bg-error-500/10 text-error-700 dark:text-error-300 rounded-lg">
                <p className="font-medium">生成图片失败</p>
                <p className="text-sm mt-1">{generateImagesError}</p>
              </div>
            )}

            {/* 帮助提示 */}
            {(!data.selectedStyle || data.totalAudioDuration <= 0) && (
              <div className="mb-6 p-4 bg-secondary-50 dark:bg-secondary-500/10 text-secondary-700 dark:text-secondary-300 rounded-lg">
                <p className="font-medium">使用前请完成以下步骤：</p>
                <ul className="text-sm mt-2 space-y-1">
                  {!data.selectedStyle && (
                    <li>• 在"素材选择"步骤中选择一种图片风格</li>
                  )}
                  {data.totalAudioDuration <= 0 && (
                    <li>• 在"配音生成"步骤中先生成配音</li>
                  )}
                </ul>
              </div>
            )}

            {(generatingImages || polling) && (
              <div className="mb-6 bg-light-divider dark:bg-dark-divider rounded-lg p-4">
                <div className="flex justify-between text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">
                  <span>{statusText}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-light-border dark:bg-dark-border rounded-full h-3">
                  <div
                    className="bg-primary-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {data.imageClips.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {data.imageClips.map((clip) => (
                  <div
                    key={clip.id}
                    className="border border-light-border dark:border-dark-border rounded-lg p-2"
                  >
                    <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      图片 {clip.index + 1}
                    </div>
                    {clip.status === 'completed' && clip.imagePath ? (
                      <img
                        src={`/data/projects/${id}/${clip.imagePath}`}
                        alt=""
                        className="w-full h-24 sm:h-32 object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-24 sm:h-32 bg-light-divider dark:bg-dark-divider rounded flex items-center justify-center">
                        <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                          {clip.status === 'generating'
                            ? '生成中...'
                            : clip.status === 'failed'
                            ? '失败'
                            : clip.status === 'cancelled'
                            ? '已取消'
                            : '待生成'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {data.imageClips.length === 0 &&
              data.textSegments.length > 0 && (
                <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
                  点击上方按钮生成图片（每张 15 秒）
                </div>
              )}

            {data.textSegments.length === 0 && (
              <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
                请先完成文本拆分
              </div>
            )}
          </div>
        )}

        {/* Step 4: 导出交付 */}
        {currentStep === 4 && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                导出剪映草稿
              </h3>
              <button
                onClick={handleExportJianying}
                disabled={exportingJianying}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingJianying ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⟳</span> 导出中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span>✂️</span> 导出到剪映
                  </span>
                )}
              </button>
            </div>

            {exportResult && (
              <div
                className={`mb-6 p-4 rounded-md ${
                  exportResult.success
                    ? 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300'
                    : 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300'
                }`}
              >
                <pre className="whitespace-pre-wrap text-sm">
                  {exportResult.message}
                </pre>
              </div>
            )}

            <div className="bg-light-divider dark:bg-dark-divider rounded-lg p-6 mb-6">
              <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-4">
                导出说明
              </h4>
              <ul className="space-y-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <li>• 将视频素材、图片、音频和字幕导出为剪映草稿</li>
                <li>• 轨道层级：视频（下层）→ 图片（上层，15秒/张）→ 字幕 → 音频</li>
                <li>• 图片自动应用动效效果</li>
                <li>• 导出前请确保已配置剪映草稿保存路径（在设置页面）</li>
                <li>• 导出后可以在剪映中打开草稿进行进一步编辑</li>
              </ul>
            </div>

            {/* 项目预览 */}
            <div>
              <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-4">
                项目预览
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-light-divider dark:bg-dark-divider rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    {data.textSegments.length}
                  </div>
                  <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    文本段落
                  </div>
                </div>
                <div className="bg-light-divider dark:bg-dark-divider rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    {data.audioClips.filter((c) => c.status === 'completed').length}
                  </div>
                  <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    配音片段
                  </div>
                </div>
                <div className="bg-light-divider dark:bg-dark-divider rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    {data.videoClips.length}
                  </div>
                  <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    视频素材
                  </div>
                </div>
                <div className="bg-light-divider dark:bg-dark-divider rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    {data.imageClips.filter((c) => c.status === 'completed').length}
                  </div>
                  <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    生成图片
                  </div>
                </div>
              </div>

              {data.totalAudioDuration > 0 && (
                <div className="text-center text-light-text-secondary dark:text-dark-text-secondary">
                  总音频时长: {data.totalAudioDuration.toFixed(1)} 秒
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DecompressionVideoEditor;
