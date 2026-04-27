import React, { useState } from 'react';
import { Character, Scene, Storyboard } from '../../services/api';

interface StoryboardSplitterProps {
  projectId: string;
  storyboards: Storyboard[];
  characters: Character[];
  scenes: Scene[];
  onSplitStoryboard: () => Promise<void>;
  splittingStoryboards: boolean;
  splitProgress: number;
  splitStatusText: string;
  onStoryboardSceneChange: (storyboardId: string, sceneId: string | null) => Promise<void>;
  onStoryboardCharactersChange: (storyboardId: string, characterIds: string[]) => Promise<void>;
}

export const StoryboardSplitter: React.FC<StoryboardSplitterProps> = ({
  storyboards,
  characters,
  scenes,
  onSplitStoryboard,
  splittingStoryboards,
  splitProgress,
  splitStatusText,
  onStoryboardSceneChange,
  onStoryboardCharactersChange,
}) => {
  const [splitMode, setSplitMode] = useState<'fixed' | 'ai'>('fixed');
  const [customLinesPerStoryboard, setCustomLinesPerStoryboard] = useState(1);
  const [autoMatchCharacters, setAutoMatchCharacters] = useState(true);
  const [autoMatchScenes, setAutoMatchScenes] = useState(true);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">分镜列表 ({storyboards.length})</h3>
        <div className="flex items-center gap-2">
          <select
            value={splitMode}
            onChange={(e) => setSplitMode(e.target.value as 'fixed' | 'ai')}
            disabled={splittingStoryboards}
            className="input-field text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="fixed">固定行数</option>
            <option value="ai">AI自动分镜</option>
          </select>

          {splitMode === 'fixed' && (
            <input
              type="number"
              min="1"
              max="10"
              value={customLinesPerStoryboard}
              onChange={(e) => setCustomLinesPerStoryboard(parseInt(e.target.value) || 1)}
              disabled={splittingStoryboards}
              className="input-field text-sm w-20 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="行数"
            />
          )}

          {splitMode === 'ai' && (
            <>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={autoMatchCharacters}
                  onChange={(e) => setAutoMatchCharacters(e.target.checked)}
                  disabled={splittingStoryboards}
                  className="rounded"
                />
                自动匹配角色
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={autoMatchScenes}
                  onChange={(e) => setAutoMatchScenes(e.target.checked)}
                  disabled={splittingStoryboards}
                  className="rounded"
                />
                自动匹配场景
              </label>
            </>
          )}

          <button
            onClick={onSplitStoryboard}
            disabled={splittingStoryboards}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {splittingStoryboards ? '正在拆分分镜...' : '自动拆分剧本'}
          </button>
        </div>
      </div>
      {splittingStoryboards && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
            <span>{splitStatusText || '进度'}</span>
            <span>{splitProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${splitProgress}%` }}
            ></div>
          </div>
        </div>
      )}
      <div className="space-y-4 max-h-[700px] overflow-y-auto">
        {storyboards.map((sb) => (
          <div key={sb.id} className="border border-light-border dark:border-dark-border rounded-lg p-4">
            <div className="flex justify-between">
              <span className="font-semibold">分镜 {sb.index + 1}</span>
            </div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-2">{sb.sceneDescription}</p>
            {sb.dialogue && (
              <p className="text-sm text-blue-600 mt-1">台词: {sb.dialogue}</p>
            )}
            {sb.narration && (
              <p className="text-sm text-green-600 mt-1">旁白: {sb.narration}</p>
            )}

            <div className="mt-3">
              <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1 block">关联场景</label>
              <select
                value={sb.sceneId || ''}
                onChange={(e) => onStoryboardSceneChange(sb.id, e.target.value || null)}
                className="input-field w-full text-sm"
              >
                <option value="">-- 无场景 --</option>
                {(scenes || []).map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.name}
                  </option>
                ))}
              </select>
              {sb.sceneId && (
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                  {(scenes || []).find(s => s.id === sb.sceneId)?.description}
                </p>
              )}
            </div>

            <div className="mt-3">
              <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1 block">关联角色</label>
              <div className="flex flex-wrap gap-2">
                {characters.map((char) => {
                  const isSelected = sb.characterIds?.includes(char.id) || false;
                  return (
                    <button
                      key={char.id}
                      onClick={() => {
                        const newCharIds = isSelected
                          ? (sb.characterIds || []).filter(id => id !== char.id)
                          : [...(sb.characterIds || []), char.id];
                        onStoryboardCharactersChange(sb.id, newCharIds);
                      }}
                      className={`px-3 py-1 rounded-full text-sm ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-light-divider dark:bg-dark-divider text-light-text-secondary dark:text-dark-text-secondary hover:bg-gray-200'
                      }`}
                    >
                      {char.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
        {storyboards.length === 0 && (
          <p className="text-light-text-secondary dark:text-dark-text-secondary">还没有分镜，点击上方按钮自动拆分</p>
        )}
      </div>
    </div>
  );
};
