import React, { useState } from 'react';
import { Storyboard } from '../../services/api';
import { TTS_VOICES } from '../../constants/ttsVoices';

interface AudioGeneratorProps {
  projectId: string;
  storyboards: Storyboard[];
  polling: boolean;
  generationStatus: { completed: number; total: number } | null;
  onGenerateAudios: () => Promise<void>;
  onGenerateSingleAudio: (storyboardId: string) => Promise<void>;
  onStoryboardVoiceChange: (storyboardId: string, voice: string) => Promise<void>;
  onApplyBulkVoice?: (voice: string) => Promise<void>;
}

export const AudioGenerator: React.FC<AudioGeneratorProps> = ({
  projectId,
  storyboards,
  polling,
  generationStatus,
  onGenerateAudios,
  onGenerateSingleAudio,
  onStoryboardVoiceChange,
  onApplyBulkVoice,
}) => {
  const [bulkVoice, setBulkVoice] = useState<string>('');

  const handleApplyBulkVoiceToStoryboards = async () => {
    if (onApplyBulkVoice && bulkVoice) {
      await onApplyBulkVoice(bulkVoice);
      setBulkVoice('');
    }
  };

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">配音生成</h3>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">批量设置音色:</label>
            <select
              value={bulkVoice}
              onChange={(e) => setBulkVoice(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">-- 选择音色 --</option>
              {TTS_VOICES.map((voice) => (
                <option key={voice.value} value={voice.value}>
                  {voice.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleApplyBulkVoiceToStoryboards}
            disabled={!bulkVoice}
            className="bg-warning-500 hover:bg-warning-600 text-white px-4 py-2 rounded-md disabled:opacity-50 text-sm"
          >
            应用到所有分镜
          </button>
          <button
            onClick={onGenerateAudios}
            disabled={polling}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {polling ? '生成中...' : '批量生成配音'}
          </button>
        </div>
      </div>
      {polling && generationStatus && generationStatus.total > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
            <span>配音生成进度</span>
            <span>{generationStatus.completed}/{generationStatus.total}</span>
          </div>
          <div className="w-full bg-light-divider dark:bg-dark-divider rounded-full h-3">
            <div
              className="bg-success-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${Math.round((generationStatus.completed / generationStatus.total) * 100)}%` }}
            ></div>
          </div>
        </div>
      )}
      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {storyboards.map((sb) => (
          <div key={sb.id} className="border border-light-border dark:border-dark-border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">分镜 {sb.index + 1}</span>
              <div className="flex items-center gap-2">
                {sb.audioDuration > 0 && (
                  <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    ({sb.audioDuration.toFixed(1)}秒)
                  </span>
                )}
                <span className={`text-sm px-2 py-1 rounded ${
                  sb.audioStatus === 'completed' ? 'bg-success-100 text-success-700 dark:bg-success-500/10 dark:text-success-300' :
                  sb.audioStatus === 'generating' ? 'bg-secondary-100 text-secondary-700 dark:bg-secondary-500/10 dark:text-secondary-300' :
                  sb.audioStatus === 'failed' ? 'bg-error-100 text-error-700 dark:bg-error-500/10 dark:text-error-300' :
                  'bg-light-divider text-light-text-secondary dark:bg-dark-divider dark:text-dark-text-secondary'
                }`}>
                  {sb.audioStatus === 'completed' ? '已完成' :
                   sb.audioStatus === 'generating' ? '生成中' :
                   sb.audioStatus === 'failed' ? '失败' : '待生成'}
                </span>
              </div>
            </div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">{sb.sceneDescription}</p>
            {sb.narration && (
              <p className="text-sm text-success-600 dark:text-success-400 mb-1">
                <span className="font-medium">旁白:</span> {sb.narration}
              </p>
            )}
            {sb.dialogue && (
              <p className="text-sm text-primary-600 dark:text-primary-400 mb-2">
                <span className="font-medium">台词:</span> {sb.dialogue}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-light-border dark:border-dark-border">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">音色:</label>
                <select
                  value={sb.ttsConfig?.voice || ''}
                  onChange={(e) => onStoryboardVoiceChange(sb.id, e.target.value)}
                  className="input-field text-xs flex-1"
                >
                  <option value="">-- 使用角色配置 --</option>
                  {TTS_VOICES.map((voice) => (
                    <option key={voice.value} value={voice.value}>
                      {voice.label}
                    </option>
                  ))}
                </select>
              </div>
              {sb.audioStatus === 'completed' && sb.audioPath ? (
                <audio controls className="h-10 w-48 sm:w-64">
                  <source src={`/data/projects/${projectId}/${sb.audioPath}`} />
                </audio>
              ) : (
                <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary w-32 sm:w-48">
                  状态: {sb.audioStatus}
                </div>
              )}
              {sb.audioStatus !== 'generating' && (
                <button
                  onClick={() => onGenerateSingleAudio(sb.id)}
                  className="bg-success-500 hover:bg-success-600 text-white px-3 py-1 rounded text-sm"
                >
                  {sb.audioStatus === 'completed' ? '重新生成' : '生成配音'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
