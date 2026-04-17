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
  coverImagePath: undefined,
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
  bgMusicPath: undefined,
  bgMusicVolume: 0.03162277660168379,
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
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);

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

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const res = await draftAdjustApi.uploadCover(file);
      setConfig(prev => ({ ...prev, coverImagePath: res.data.path }));
    } catch (e) {
      console.error('Failed to upload cover:', e);
      alert('封面上传失败');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMusic(true);
    try {
      const res = await draftAdjustApi.uploadMusic(file);
      setConfig(prev => ({ ...prev, bgMusicPath: res.data.path, bgMusicEnabled: true }));
    } catch (e) {
      console.error('Failed to upload music:', e);
      alert('音乐上传失败');
    } finally {
      setUploadingMusic(false);
    }
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
              {/* 封面图片 */}
              <div className="border-t border-light-divider dark:border-dark-divider pt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  封面图片
                </label>
                <div className="space-y-2">
                  {config.coverImagePath ? (
                    <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                      <span className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">
                        {config.coverImagePath}
                      </span>
                      <button
                        onClick={() => setConfig(prev => ({ ...prev, coverImagePath: undefined }))}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        移除
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 px-4 py-2 border border-dashed rounded cursor-pointer hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverUpload}
                        disabled={uploadingCover}
                        className="hidden"
                      />
                      <span className="text-gray-600 dark:text-gray-400">
                        {uploadingCover ? '上传中...' : '点击上传封面图片'}
                      </span>
                    </label>
                  )}
                </div>
              </div>

              {/* 封面标题 */}
              <div className="border-t border-light-divider dark:border-dark-divider pt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.coverTitleEnabled}
                    onChange={(e) => setConfig(prev => ({ ...prev, coverTitleEnabled: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="font-medium text-gray-900 dark:text-gray-100">添加封面标题</span>
                </label>
                {config.coverTitleEnabled && (
                  <div className="mt-3 space-y-3">
                    <input
                      type="text"
                      value={config.coverTitle}
                      onChange={(e) => setConfig(prev => ({ ...prev, coverTitle: e.target.value }))}
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
                    onChange={(e) => setConfig(prev => ({ ...prev, textEnabled: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="font-medium text-gray-900 dark:text-gray-100">添加文本</span>
                </label>
                {config.textEnabled && (
                  <div className="mt-3 space-y-3">
                    <textarea
                      value={config.textContent}
                      onChange={(e) => setConfig(prev => ({ ...prev, textContent: e.target.value }))}
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
                    onChange={(e) => setConfig(prev => ({ ...prev, watermarkEnabled: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="font-medium text-gray-900 dark:text-gray-100">添加水印</span>
                </label>
                {config.watermarkEnabled && (
                  <div className="mt-3 space-y-3">
                    <input
                      type="text"
                      value={config.watermarkText}
                      onChange={(e) => setConfig(prev => ({ ...prev, watermarkText: e.target.value }))}
                      className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                      placeholder="@用户名"
                    />
                  </div>
                )}
              </div>

              {/* 配乐 */}
              <div className="border-t border-light-divider dark:border-dark-divider pt-4">
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={config.bgMusicEnabled}
                    onChange={(e) => setConfig(prev => ({ ...prev, bgMusicEnabled: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="font-medium text-gray-900 dark:text-gray-100">添加配乐</span>
                </label>
                {config.bgMusicEnabled && (
                  <div className="space-y-2">
                    {config.bgMusicPath ? (
                      <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                        <span className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">
                          {config.bgMusicPath}
                        </span>
                        <button
                          onClick={() => setConfig(prev => ({ ...prev, bgMusicPath: undefined }))}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          移除
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 px-4 py-2 border border-dashed rounded cursor-pointer hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleMusicUpload}
                          disabled={uploadingMusic}
                          className="hidden"
                        />
                        <span className="text-gray-600 dark:text-gray-400">
                          {uploadingMusic ? '上传中...' : '点击上传配乐文件'}
                        </span>
                      </label>
                    )}
                  </div>
                )}
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
