import React from 'react';

interface CharacterTestImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterTestImagePrompt: string;
  onCharacterTestImagePromptChange: (value: string) => void;
  characterTestImageUrl: string | null;
  characterTestImageLoading: boolean;
  onGenerateCharacterTestImage: () => Promise<void>;
  onCharacterTestImageError: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

export const CharacterTestImageModal: React.FC<CharacterTestImageModalProps> = ({
  isOpen,
  onClose,
  characterTestImagePrompt,
  onCharacterTestImagePromptChange,
  characterTestImageUrl,
  characterTestImageLoading,
  onGenerateCharacterTestImage,
  onCharacterTestImageError,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-light-divider dark:border-dark-divider flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg text-light-text-primary dark:text-dark-text-primary">
              角色测试生图
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <div className="mb-4">
            <label className="input-label">提示词</label>
            <textarea
              value={characterTestImagePrompt}
              onChange={(e) => onCharacterTestImagePromptChange(e.target.value)}
              className="input-field w-full h-24 resize-none"
            />
          </div>
          {characterTestImageUrl && (
            <div className="mb-4">
              <label className="input-label">生成结果</label>
              <div className="flex justify-center">
                <img
                  src={characterTestImageUrl}
                  alt="Test"
                  className="max-w-full max-h-[60vh] w-auto h-auto rounded-lg"
                  onError={onCharacterTestImageError}
                  key={characterTestImageUrl}
                />
              </div>
            </div>
          )}
          {characterTestImageLoading && (
            <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
              生成中...
            </div>
          )}
        </div>
        <div className="p-4 border-t border-light-divider dark:border-dark-divider flex gap-2 justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            关闭
          </button>
          <button
            onClick={onGenerateCharacterTestImage}
            disabled={characterTestImageLoading || !characterTestImagePrompt.trim()}
            className="btn-primary"
          >
            {characterTestImageLoading ? '生成中...' : '生成图片'}
          </button>
        </div>
      </div>
    </div>
  );
};
