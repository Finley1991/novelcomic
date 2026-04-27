import React from 'react';
import { Storyboard } from '../../services/api';

interface JianyingExporterProps {
  projectId: string;
  storyboards: Storyboard[];
  exportingJianying: boolean;
  exportResult: { success: boolean; message: string } | null;
  onExportJianying: () => Promise<void>;
}

export const JianyingExporter: React.FC<JianyingExporterProps> = ({
  projectId,
  storyboards,
  exportingJianying,
  exportResult,
  onExportJianying,
}) => {
  return (
    <div className="border-t border-light-border dark:border-dark-border pt-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">导出剪映草稿</h3>
        <button
          onClick={onExportJianying}
          disabled={exportingJianying}
          className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exportingJianying ? '导出中...' : '导出到剪映'}
        </button>
      </div>

      {exportResult && (
        <div className={`mb-6 p-4 rounded-md ${exportResult.success ? 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300' : 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300'}`}>
          <pre className="whitespace-pre-wrap text-sm">{exportResult.message}</pre>
        </div>
      )}

      <div className="bg-light-divider dark:bg-dark-divider rounded-lg p-6">
        <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-4">导出说明</h4>
        <ul className="space-y-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
          <li>• 将项目中的所有图片和音频导出为剪映草稿</li>
          <li>• 图片和音频会自动放置在对应的轨道上</li>
          <li>• 每个分镜的时长根据音频长度自动设置</li>
          <li>• 导出前请确保已配置剪映草稿保存路径（在设置页面）</li>
          <li>• 导出后可以在剪映中打开草稿进行进一步编辑</li>
        </ul>
      </div>

      <div className="mt-6">
        <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-4">项目预览 ({storyboards.length} 个分镜)</h4>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {storyboards.map((sb) => (
            <div key={sb.id} className="flex items-center gap-4 border border-light-border dark:border-dark-border rounded-lg p-3">
              <div className="w-24 h-16 bg-light-divider dark:bg-dark-divider rounded flex items-center justify-center flex-shrink-0">
                {sb.imageStatus === 'completed' && sb.imagePath ? (
                  <img
                    src={`/data/projects/${projectId}/${sb.imagePath}`}
                    alt=""
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    {sb.imageStatus === 'generating' ? '生成中' :
                     sb.imageStatus === 'failed' ? '失败' : '无图'}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-light-text-primary dark:text-dark-text-primary">分镜 {sb.index + 1}</div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">{sb.sceneDescription}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {sb.audioStatus === 'completed' && sb.audioDuration > 0 && (
                  <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    {sb.audioDuration.toFixed(1)}s
                  </span>
                )}
                <span className={`text-xs px-2 py-1 rounded ${
                  sb.audioStatus === 'completed' && sb.imageStatus === 'completed'
                    ? 'bg-success-100 text-success-700 dark:bg-success-500/10 dark:text-success-300'
                    : 'bg-warning-100 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300'
                }`}>
                  {sb.audioStatus === 'completed' && sb.imageStatus === 'completed' ? '就绪' : '需完成'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
