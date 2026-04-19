import React, { useState, useEffect, useRef } from 'react';
import { Storyboard, Character, Scene, ImagePromptTemplate, generationApi } from '../services/api';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  storyboardIndex?: number;
}

interface StoryboardImageGenerationProps {
  projectId: string;
  storyboards: Storyboard[];
  characters: Character[];
  scenes: Scene[];
  imagePromptTemplates: ImagePromptTemplate[];
  onGenerateImages: (storyboardIds?: string[], forceRegenerate?: boolean) => Promise<void>;
  onGenerateSingleImage: (storyboardId: string) => Promise<void>;
  onUseTemplate: (storyboardId: string, templateId: string) => Promise<void>;
  generating: boolean;
  generationStatus?: { completed: number; total: number };
  polling: boolean;
  stylePrompt: string;
}

export const StoryboardImageGeneration: React.FC<StoryboardImageGenerationProps> = ({
  projectId,
  storyboards,
  characters,
  scenes,
  imagePromptTemplates,
  onGenerateImages,
  onGenerateSingleImage,
  onUseTemplate,
  generating,
  generationStatus,
  polling,
  stylePrompt,
}) => {
  const [showTerminal, setShowTerminal] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [prevStatus, setPrevStatus] = useState<{ completed: number; total: number } | undefined>();
  const [prevStoryboards, setPrevStoryboards] = useState<Storyboard[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  const addLog = (type: LogEntry['type'], message: string, storyboardIndex?: number) => {
    const entry: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('zh-CN'),
      type,
      message,
      storyboardIndex,
    };
    setLogs(prev => [...prev, entry]);
  };

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current && showTerminal) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, showTerminal]);

  // Monitor status changes to add logs
  useEffect(() => {
    if (generationStatus && prevStatus) {
      if (generationStatus.completed > prevStatus.completed) {
        const newlyCompleted = generationStatus.completed - prevStatus.completed;
        for (let i = 0; i < newlyCompleted; i++) {
          const completedIndex = prevStatus.completed + i;
          addLog('success', `分镜 ${completedIndex + 1} 图片生成完成`, completedIndex);
        }
      }
    }
    setPrevStatus(generationStatus);
  }, [generationStatus]);

  // Monitor storyboard status changes
  useEffect(() => {
    storyboards.forEach((sb, index) => {
      const prevSb = prevStoryboards.find(p => p.id === sb.id);
      if (prevSb) {
        if (prevSb.imageStatus !== sb.imageStatus) {
          if (sb.imageStatus === 'generating') {
            addLog('info', `开始生成分镜 ${index + 1} 的图片...`, index);
          } else if (sb.imageStatus === 'failed' && !prevSb.imageError && sb.imageError) {
            addLog('error', `分镜 ${index + 1} 生成失败: ${sb.imageError}`, index);
          }
        }
      }
    });
    setPrevStoryboards(storyboards);
  }, [storyboards]);

  // Clear logs when not generating
  useEffect(() => {
    if (!generating && !polling && logs.length > 0) {
      // Keep logs for viewing, don't auto-clear
    }
  }, [generating, polling]);

  const handleGenerateWithLogs = async (storyboardIds?: string[], forceRegenerate?: boolean) => {
    if (forceRegenerate || !storyboardIds) {
      setLogs([]);
      addLog('info', forceRegenerate ? '开始重新生成所有图片...' : '开始批量生成图片...');
    } else {
      addLog('info', `开始生成 ${storyboardIds.length} 张图片...`);
    }
    setShowTerminal(true);
    await onGenerateImages(storyboardIds, forceRegenerate);
  };

  const handleGenerateSingleWithLogs = async (storyboardId: string) => {
    const sb = storyboards.find(s => s.id === storyboardId);
    const index = sb ? storyboards.indexOf(sb) : -1;
    addLog('info', `开始生成分镜 ${index + 1} 的图片...`, index);
    setShowTerminal(true);
    await onGenerateSingleImage(storyboardId);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleCancelGeneration = async () => {
    try {
      addLog('warning', '正在取消图片生成...');
      await generationApi.cancelGeneration(projectId);
      addLog('info', '取消请求已发送，正在停止...');
    } catch (error) {
      console.error('Failed to cancel generation:', error);
      addLog('error', '取消失败');
    }
  };
  const getCharacterName = (charId: string) => {
    return characters.find(c => c.id === charId)?.name || charId;
  };

  const getSceneName = (sceneId: string | null) => {
    if (!sceneId) return '无';
    return scenes.find(s => s.id === sceneId)?.name || sceneId;
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400';
      case 'generating':
        return 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400';
      case 'failed':
        return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'generating':
        return '生成中';
      case 'failed':
        return '失败';
      default:
        return '待生成';
    }
  };

  return (
    <div className="space-y-6">
      {/* 批量操作 */}
      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary mb-1">
              图片生成
            </h3>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              根据分镜提示词生成图片
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className="btn-secondary"
            >
              {showTerminal ? '隐藏终端' : '显示终端'}
            </button>
            {(generating || polling) ? (
              <button
                onClick={handleCancelGeneration}
                className="btn-secondary text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                取消生成
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleGenerateWithLogs(undefined, true)}
                  disabled={generating || storyboards.length === 0}
                  className="btn-secondary"
                >
                  全部重新生成
                </button>
                <button
                  onClick={() => handleGenerateWithLogs()}
                  disabled={generating || storyboards.length === 0}
                  className="btn-primary"
                >
                  {generating ? '生成中...' : '批量生成图片'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* 进度条 */}
        {(generating || polling) && generationStatus && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-light-text-secondary dark:text-dark-text-secondary">
                生成进度
              </span>
              <span className="text-light-text-primary dark:text-dark-text-primary font-medium">
                {generationStatus.completed} / {generationStatus.total}
              </span>
            </div>
            <div className="h-2 bg-light-divider dark:bg-dark-divider rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all duration-300"
                style={{ width: `${(generationStatus.completed / generationStatus.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* 终端显示 */}
        {showTerminal && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                  处理终端
                </span>
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  ({logs.length} 条日志)
                </span>
              </div>
              <button
                onClick={clearLogs}
                className="text-xs text-light-text-secondary hover:text-light-text-primary dark:text-dark-text-secondary dark:hover:text-dark-text-primary"
              >
                清空日志
              </button>
            </div>
            <div
              ref={terminalRef}
              className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm"
            >
              {logs.length === 0 ? (
                <div className="text-gray-500">
                  <span className="text-green-400">$</span> 等待开始生成图片...
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2">
                      <span className="text-gray-500 shrink-0">[{log.timestamp}]</span>
                      <span
                        className={`shrink-0 ${
                          log.type === 'success' ? 'text-green-400' :
                          log.type === 'error' ? 'text-red-400' :
                          log.type === 'warning' ? 'text-yellow-400' :
                          'text-blue-400'
                        }`}
                      >
                        {log.type === 'success' ? '✓' :
                         log.type === 'error' ? '✗' :
                         log.type === 'warning' ? '!' : '>'}
                      </span>
                      <span className="text-gray-300">
                        {log.storyboardIndex !== undefined && (
                          <span className="text-purple-400">[分镜{log.storyboardIndex + 1}]</span>
                        )}
                        {' '}{log.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {(generating || polling) && (
                <div className="mt-2 flex items-center gap-2 text-gray-400">
                  <span className="animate-pulse">●</span>
                  <span>处理中...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 分镜图片网格 */}
      <div className="grid gap-4">
        {storyboards.map((storyboard, index) => (
          <div key={storyboard.id} className="card p-4">
            <div className="flex gap-6">
              {/* 左侧：图片预览 */}
              <div className="flex-shrink-0 w-64">
                {storyboard.imagePath ? (
                  <div className="relative group">
                    <img
                      src={`/data/projects/${projectId}/${storyboard.imagePath}`}
                      alt={`分镜 ${index + 1}`}
                      className="w-full h-40 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => handleGenerateSingleWithLogs(storyboard.id)}
                      disabled={storyboard.imageStatus === 'generating'}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"
                    >
                      <span className="text-white text-sm">重新生成</span>
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-40 bg-light-divider dark:bg-dark-divider rounded-lg flex items-center justify-center">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary text-sm">
                      暂无图片
                    </span>
                  </div>
                )}

                {/* 状态标签 */}
                <div className="mt-2 flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeClass(storyboard.imageStatus)}`}>
                    {getStatusLabel(storyboard.imageStatus)}
                  </span>
                  <button
                    onClick={() => handleGenerateSingleWithLogs(storyboard.id)}
                    disabled={storyboard.imageStatus === 'generating'}
                    className="btn-secondary text-xs py-1 px-2"
                  >
                    生成
                  </button>
                </div>
              </div>

              {/* 右侧：分镜信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                    分镜 {index + 1}
                  </span>
                  {storyboard.characterIds.length > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full">
                      角色: {storyboard.characterIds.map(getCharacterName).join(', ')}
                    </span>
                  )}
                  {storyboard.sceneId && (
                    <span className="text-xs px-2 py-0.5 bg-secondary-100 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400 rounded-full">
                      场景: {getSceneName(storyboard.sceneId)}
                    </span>
                  )}
                </div>

                <div className="text-sm text-light-text-primary dark:text-dark-text-primary mb-2">
                  {storyboard.sceneDescription}
                </div>

                {/* 提示词预览 */}
                {storyboard.imagePrompt && (
                  <div className="mt-2">
                    <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      提示词:
                    </div>
                    <div className="text-xs text-light-text-primary dark:text-dark-text-primary bg-light-divider dark:bg-dark-divider rounded p-2 line-clamp-2">
                      {storyboard.imagePrompt}
                    </div>
                  </div>
                )}

                {/* 模板选择 */}
                {imagePromptTemplates.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary self-center">
                      使用模板:
                    </span>
                    {imagePromptTemplates.slice(0, 3).map((template) => (
                      <button
                        key={template.id}
                        onClick={() => onUseTemplate(storyboard.id, template.id)}
                        className="text-xs px-2 py-1 bg-light-divider dark:bg-dark-divider hover:bg-light-divider/80 dark:hover:bg-dark-divider/80 rounded transition-colors text-light-text-secondary dark:text-dark-text-secondary"
                      >
                        {template.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {storyboards.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              还没有分镜，请先创建分镜并生成提示词
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
