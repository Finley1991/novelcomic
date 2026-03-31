import React, { useState } from 'react';
import {
  draftAdjustApi,
  type Project,
  type DraftAdjustmentConfig,
  type TextStyleConfig,
  type WatermarkStyleConfig,
} from '../services/api';

const defaultTextStyle: TextStyleConfig = {
  fontSize: 24,
  fontFamily: '新青年体',
  fontColor: '#ffd9e8',
  strokeColor: '#ff619d',
  strokeWidth: 0.08,
  alpha: 1,
  positionX: 0,
  positionY: 0.87,
  align: 1,
};

const defaultWatermarkStyle: WatermarkStyleConfig = {
  fontSize: 15,
  fontFamily: '新青年体',
  fontColor: '#ffffff',
  strokeColor: undefined,
  strokeWidth: 0,
  alpha: 0.2078,
  positionX: 0,
  positionY: 0,
  align: 1,
  startPositionX: -0.552795,
  startPositionY: 0.874126,
  endPositionX: 0.596435,
  endPositionY: -0.930708,
};

const defaultConfig: DraftAdjustmentConfig = {
  coverDuration: 3,
  coverTitleEnabled: false,
  coverTitle: '',
  coverTitleStyle: { ...defaultTextStyle },
  textEnabled: false,
  textContent: '',
  textStyle: {
    ...defaultTextStyle,
    fontSize: 15,
    fontColor: '#ffffff',
    strokeColor: undefined,
    strokeWidth: 0,
    positionY: 0,
  },
  watermarkEnabled: false,
  watermarkText: '',
  watermarkStyle: { ...defaultWatermarkStyle },
  bgMusicEnabled: false,
  bgMusicVolume: 0.04425,
  bgMusicFadeInDuration: 1,
  bgMusicFadeOutDuration: 1,
};

interface DraftAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export const DraftAdjustmentModal: React.FC<DraftAdjustmentModalProps> = ({
  isOpen,
  onClose,
  project: _project,
}) => {
  const [draftPath, setDraftPath] = useState('');
  const [draftInfo, setDraftInfo] = useState<{
    success: boolean;
    draftName: string;
    duration: number;
    trackCount: number;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [config, setConfig] = useState<DraftAdjustmentConfig>({ ...defaultConfig });

  if (!isOpen) return null;

  const handleLoadDraft = async () => {
    if (!draftPath) return;
    setLoading(true);
    try {
      const res = await draftAdjustApi.loadDraft({ draftPath });
      setDraftInfo(res.data);
    } catch (e) {
      console.error('Failed to load draft:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!draftPath || !draftInfo?.success) return;
    setApplying(true);
    try {
      const res = await draftAdjustApi.apply({ draftPath, config });
      if (res.data.success) {
        alert('应用成功！');
        onClose();
      } else {
        alert('应用失败: ' + res.data.error);
      }
    } catch (e) {
      console.error('Failed to apply:', e);
      alert('应用失败');
    } finally {
      setApplying(false);
    }
  };

  const handleReset = () => {
    setDraftPath('');
    setDraftInfo(null);
    setConfig({ ...defaultConfig });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-light-divider dark:border-dark-divider flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-lg text-light-text-primary dark:text-dark-text-primary">
            草稿调整
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* 草稿选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              剪映草稿路径
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={draftPath}
                onChange={(e) => setDraftPath(e.target.value)}
                className="flex-1 px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                placeholder="/path/to/JianyingPro Drafts/MyDraft"
              />
              <button
                onClick={handleLoadDraft}
                disabled={!draftPath || loading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '加载中...' : '加载'}
              </button>
            </div>
          </div>

          {/* 草稿信息 */}
          {draftInfo && (
            <div className={`p-4 rounded ${draftInfo.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              {draftInfo.success ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">草稿名称:</span>{' '}
                    <span className="font-medium text-gray-900 dark:text-gray-100">{draftInfo.draftName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">时长:</span>{' '}
                    <span className="font-medium text-gray-900 dark:text-gray-100">{draftInfo.duration.toFixed(1)}秒</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">轨道数:</span>{' '}
                    <span className="font-medium text-gray-900 dark:text-gray-100">{draftInfo.trackCount}</span>
                  </div>
                </div>
              ) : (
                <div className="text-red-600 dark:text-red-400">
                  加载失败: {draftInfo.error}
                </div>
              )}
            </div>
          )}

          {draftInfo?.success && (
            <>
              {/* 封面标题 */}
              <div className="border-t border-light-divider dark:border-dark-divider pt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.coverTitleEnabled}
                    onChange={(e) => setConfig({ ...config, coverTitleEnabled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="font-medium text-gray-900 dark:text-gray-100">添加封面标题</span>
                </label>
                {config.coverTitleEnabled && (
                  <div className="mt-3 space-y-3">
                    <input
                      type="text"
                      value={config.coverTitle}
                      onChange={(e) => setConfig({ ...config, coverTitle: e.target.value })}
                      className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                      placeholder="输入标题..."
                    />
                  </div>
                )}
              </div>

              {/* 文本 */}
              <div className="border-t border-light-divider dark:border-dark-divider pt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.textEnabled}
                    onChange={(e) => setConfig({ ...config, textEnabled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="font-medium text-gray-900 dark:text-gray-100">添加文本</span>
                </label>
                {config.textEnabled && (
                  <div className="mt-3 space-y-3">
                    <textarea
                      value={config.textContent}
                      onChange={(e) => setConfig({ ...config, textContent: e.target.value })}
                      className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                      rows={3}
                      placeholder="输入文本..."
                    />
                  </div>
                )}
              </div>

              {/* 水印 */}
              <div className="border-t border-light-divider dark:border-dark-divider pt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.watermarkEnabled}
                    onChange={(e) => setConfig({ ...config, watermarkEnabled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="font-medium text-gray-900 dark:text-gray-100">添加水印</span>
                </label>
                {config.watermarkEnabled && (
                  <div className="mt-3 space-y-3">
                    <input
                      type="text"
                      value={config.watermarkText}
                      onChange={(e) => setConfig({ ...config, watermarkText: e.target.value })}
                      className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                      placeholder="@用户名"
                    />
                  </div>
                )}
              </div>

              {/* 配乐 */}
              <div className="border-t border-light-divider dark:border-dark-divider pt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.bgMusicEnabled}
                    onChange={(e) => setConfig({ ...config, bgMusicEnabled: e.target.checked })}
                    className="rounded"
                    disabled={true}
                  />
                  <span className="font-medium text-gray-900 dark:text-gray-100">添加配乐</span>
                  <span className="text-gray-400 text-sm ml-2">(待实现)</span>
                </label>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-between mt-6 pt-4 border-t border-light-divider dark:border-dark-divider flex-shrink-0">
          <button
            onClick={handleReset}
            className="px-4 py-2 border rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-300"
          >
            重置
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-300"
            >
              取消
            </button>
            <button
              onClick={handleApply}
              disabled={!draftInfo?.success || applying}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applying ? '应用中...' : '应用调整'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
