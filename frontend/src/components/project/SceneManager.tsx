import React, { useState } from 'react';
import { Scene } from '../../services/api';

interface SceneManagerProps {
  projectId: string;
  scenes: Scene[];
  onExtractScenes: () => Promise<void>;
  extractingScenes: boolean;
  onOpenPromptManager: (type: 'scene_extraction') => void;
  onSaveScene: (sceneId: string) => Promise<void>;
  savingScene: string | null;
  tempScene: { [sceneId: string]: Partial<Scene> };
  onTempSceneChange: (sceneId: string, field: 'name' | 'description', value: string) => void;
  onDeleteScene: (sceneId: string) => Promise<void>;
}

export const SceneManager: React.FC<SceneManagerProps> = ({
  scenes,
  onExtractScenes,
  extractingScenes,
  onOpenPromptManager,
  onSaveScene,
  savingScene,
  tempScene,
  onTempSceneChange,
  onDeleteScene,
}) => {
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">场景列表</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onOpenPromptManager('scene_extraction')}
            className="btn-secondary"
          >
            管理提示词
          </button>
          <button
            onClick={onExtractScenes}
            disabled={extractingScenes}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {extractingScenes ? '提取中...' : '自动提取场景'}
          </button>
        </div>
      </div>
      <div className="space-y-4">
        {(scenes || []).map((scene) => (
          <div key={scene.id} className="border border-light-border dark:border-dark-border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">{scene.name}</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingSceneId(
                    editingSceneId === scene.id ? null : scene.id
                  )}
                  className="text-primary-500 text-sm hover:text-primary-600"
                >
                  {editingSceneId === scene.id ? '收起' : '编辑'}
                </button>
                <button
                  onClick={() => onDeleteScene(scene.id)}
                  className="text-error-500 text-sm hover:text-error-600"
                >
                  删除
                </button>
              </div>
            </div>

            {editingSceneId === scene.id ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">场景名称</label>
                  <input
                    type="text"
                    value={tempScene[scene.id]?.name ?? scene.name}
                    onChange={(e) => onTempSceneChange(scene.id, 'name', e.target.value)}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">场景描述</label>
                  <textarea
                    value={tempScene[scene.id]?.description ?? scene.description}
                    onChange={(e) => onTempSceneChange(scene.id, 'description', e.target.value)}
                    className="input-field w-full"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => onSaveScene(scene.id)}
                    disabled={savingScene === scene.id}
                    className={`btn-primary ${
                      savingScene === scene.id
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    {savingScene === scene.id ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{scene.description}</p>
            )}
          </div>
        ))}
        {(!scenes || scenes.length === 0) && (
          <p className="text-light-text-secondary dark:text-dark-text-secondary">还没有场景，点击上方按钮自动提取</p>
        )}
      </div>
    </div>
  );
};
