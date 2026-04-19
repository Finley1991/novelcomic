import React from 'react';
import { Storyboard, Character, Scene } from '../services/api';

interface StoryboardPromptInferenceProps {
  projectId: string;
  storyboards: Storyboard[];
  characters: Character[];
  scenes: Scene[];
  onGeneratePrompts: (storyboardIds?: string[]) => Promise<void>;
  generatingPrompts: boolean;
  onUpdatePrompt: (storyboardId: string, prompt: string) => Promise<void>;
  savingPrompt: string | null;
  editingPrompt: { [key: string]: string };
  onEditPromptChange: (storyboardId: string, prompt: string) => void;
}

export const StoryboardPromptInference: React.FC<StoryboardPromptInferenceProps> = ({
  projectId,
  storyboards,
  characters,
  scenes,
  onGeneratePrompts,
  generatingPrompts,
  onUpdatePrompt,
  savingPrompt,
  editingPrompt,
  onEditPromptChange,
}) => {
  const getCharacterName = (charId: string) => {
    return characters.find(c => c.id === charId)?.name || charId;
  };

  const getSceneName = (sceneId: string | null) => {
    if (!sceneId) return '无';
    return scenes.find(s => s.id === sceneId)?.name || sceneId;
  };

  return (
    <div className="space-y-6">
      {/* 批量操作 */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary mb-1">
              提示词推理
            </h3>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              基于分镜文本、角色提示词和场景提示词，生成适合 AIGC 画图的提示词
            </p>
          </div>
          <button
            onClick={() => onGeneratePrompts()}
            disabled={generatingPrompts || storyboards.length === 0}
            className="btn-primary"
          >
            {generatingPrompts ? '生成中...' : '批量生成提示词'}
          </button>
        </div>
      </div>

      {/* 分镜列表 */}
      <div className="space-y-4">
        {storyboards.map((storyboard, index) => {
          const currentPrompt = editingPrompt[storyboard.id] ?? storyboard.imagePrompt ?? '';
          const isSaving = savingPrompt === storyboard.id;

          return (
            <div key={storyboard.id} className="card p-4">
              <div className="flex gap-4">
                {/* 左侧：分镜信息 */}
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

                  {storyboard.dialogue && (
                    <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary italic">
                      「{storyboard.dialogue}」
                    </div>
                  )}
                </div>

                {/* 右侧：单个生成按钮 */}
                <div className="flex-shrink-0">
                  <button
                    onClick={() => onGeneratePrompts([storyboard.id])}
                    disabled={generatingPrompts}
                    className="btn-secondary text-sm"
                  >
                    生成
                  </button>
                </div>
              </div>

              {/* 提示词编辑器 */}
              <div className="mt-4 pt-4 border-t border-light-divider dark:border-dark-divider">
                <label className="input-label">AIGC 画图提示词</label>
                <textarea
                  value={currentPrompt}
                  onChange={(e) => onEditPromptChange(storyboard.id, e.target.value)}
                  onBlur={() => currentPrompt !== storyboard.imagePrompt && onUpdatePrompt(storyboard.id, currentPrompt)}
                  className="input-field w-full h-24 font-mono text-sm"
                  placeholder="提示词将自动生成，也可以手动编辑"
                />
                {isSaving && (
                  <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                    保存中...
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {storyboards.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              还没有分镜，请先在上一步创建分镜
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
