import React, { useRef } from 'react';
import { PromptTemplate, PromptType } from '../../services/api';

interface ProjectSettingsProps {
  projectId: string;
  projectName: string;
  projectPromptTemplates: { [key in PromptType]?: string };
  subtitleFilePath: string | null;
  subtitleSegments: any[];
  uploadedAudioFiles: string[];
  promptTemplates: PromptTemplate[];
  savingProjectSettings: boolean;
  uploadingSubtitle: boolean;
  uploadingAudio: boolean;
  onUpdateProjectPromptTemplate: (type: PromptType, templateId: string) => Promise<void>;
  onUploadSubtitle: (file: File) => Promise<void>;
  onDeleteSubtitle: () => Promise<void>;
  onUploadAudio: (file: File) => Promise<void>;
  onUploadAudios: (files: FileList) => Promise<void>;
  onDeleteUploadedAudios: () => Promise<void>;
}

export const ProjectSettings: React.FC<ProjectSettingsProps> = ({
  projectName,
  projectPromptTemplates,
  subtitleFilePath,
  subtitleSegments,
  uploadedAudioFiles,
  promptTemplates,
  savingProjectSettings,
  uploadingSubtitle,
  uploadingAudio,
  onUpdateProjectPromptTemplate,
  onUploadSubtitle,
  onDeleteSubtitle,
  onUploadAudio,
  onUploadAudios,
  onDeleteUploadedAudios,
}) => {
  const subtitleFileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">项目设置</h3>
      </div>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
            项目名称
          </label>
          <input
            type="text"
            value={projectName}
            className="input-field w-full"
            readOnly
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
              项目 Prompt 模板
            </label>
            <a
              href="/templates"
              className="text-primary-500 hover:text-primary-600 text-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              管理模板 →
            </a>
          </div>
          <div className="space-y-4">
            {[
              { key: 'character_extraction' as const, label: '角色提取' },
              { key: 'scene_extraction' as const, label: '场景提取' },
              { key: 'storyboard_split' as const, label: '分镜拆分' },
              { key: 'image_prompt' as const, label: '图像生成' },
            ].map(({ key: type, label }) => {
              const templatesByType = promptTemplates.filter(t => t.type === type);
              return (
                <div key={type}>
                  <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    {label}
                  </label>
                  <select
                    value={projectPromptTemplates?.[type] || ''}
                    onChange={(e) => onUpdateProjectPromptTemplate(type, e.target.value)}
                    disabled={savingProjectSettings}
                    className="input-field w-full"
                  >
                    <option value="">-- 使用全局默认 --</option>
                    {templatesByType.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} {template.isPreset ? '(预设)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-light-divider dark:border-dark-divider pt-6">
          <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
            上传字幕
          </label>
          <div className="space-y-3">
            <input
              ref={subtitleFileRef}
              type="file"
              accept=".srt,.vtt,.lrc,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  onUploadSubtitle(e.target.files[0]);
                }
              }}
            />
            {subtitleFilePath ? (
              <div className="flex items-center gap-2 p-3 bg-success-50 dark:bg-success-500/10 rounded-lg border border-success-200 dark:border-success-500/20">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-success-600 dark:text-success-400">✓</span>
                    <span className="font-medium text-light-text-primary dark:text-dark-text-primary">
                      已上传字幕
                    </span>
                  </div>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                    {subtitleSegments?.length || 0} 个字幕片段
                  </p>
                </div>
                <button
                  onClick={onDeleteSubtitle}
                  className="btn-secondary text-red-500 hover:text-red-600 hover:border-red-300 dark:hover:border-red-700"
                >
                  删除字幕
                </button>
              </div>
            ) : (
              <button
                onClick={() => subtitleFileRef.current?.click()}
                disabled={uploadingSubtitle}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed w-full"
              >
                {uploadingSubtitle ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⟳</span> 上传中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>📝</span> 上传字幕文件（支持 .srt, .vtt, .lrc, .txt）
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-light-divider dark:border-dark-divider pt-6">
          <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
            上传音频
          </label>
          <div className="space-y-3">
            <input
              ref={audioFileRef}
              type="file"
              accept=".wav,.mp3,.m4a"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  if (e.target.files.length === 1) {
                    onUploadAudio(e.target.files[0]);
                  } else {
                    onUploadAudios(e.target.files);
                  }
                }
              }}
            />
            {uploadedAudioFiles?.length > 0 ? (
              <div className="flex items-center gap-2 p-3 bg-success-50 dark:bg-success-500/10 rounded-lg border border-success-200 dark:border-success-500/20">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-success-600 dark:text-success-400">✓</span>
                    <span className="font-medium text-light-text-primary dark:text-dark-text-primary">
                      已上传音频
                    </span>
                  </div>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                    {uploadedAudioFiles.length} 个音频文件
                  </p>
                </div>
                <button
                  onClick={onDeleteUploadedAudios}
                  className="btn-secondary text-red-500 hover:text-red-600 hover:border-red-300 dark:hover:border-red-700"
                >
                  清空上传
                </button>
              </div>
            ) : (
              <button
                onClick={() => audioFileRef.current?.click()}
                disabled={uploadingAudio}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed w-full"
              >
                {uploadingAudio ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⟳</span> 上传中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>🎵</span> 上传音频文件（支持 .wav, .mp3, .m4a，可多选）
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="bg-secondary-50 dark:bg-secondary-500/10 rounded-xl p-4 border border-secondary-200 dark:border-secondary-500/20">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-secondary-100 dark:bg-secondary-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-secondary-600 dark:text-secondary-400">💡</span>
            </div>
            <div>
              <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
                支持两种方式输入文本和音频
              </h4>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                方式1：后续在分镜编辑步骤中自动拆分文本并生成配音
              </p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                方式2：点击上方按钮上传字幕文件和音频文件
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
