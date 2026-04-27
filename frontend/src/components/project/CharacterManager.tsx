import React, { useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { Character } from '../../services/api';
import { TTS_VOICES } from '../../constants/ttsVoices';

interface CharacterManagerProps {
  projectId: string;
  characters: Character[];
  onExtractCharacters: () => Promise<void>;
  extractingCharacters: boolean;
  onOpenPromptManager: (type: 'character_extraction') => void;
  onUpdateCharacter: (charId: string, data: Partial<Character>) => Promise<void>;
  onSaveCharacter: (charId: string) => Promise<void>;
  savingCharacter: string | null;
  tempCharacter: { [charId: string]: Partial<Character> };
  onTempCharacterChange: (charId: string, field: keyof Character, value: string) => void;
  onCharacterTestImage: (charId: string) => void;
  onSaveCharacterTts: (charId: string) => Promise<void>;
  savingCharacterTts: string | null;
  tempCharacterTts: { [charId: string]: Character['ttsConfig'] };
  onTempCharacterTtsChange: (charId: string, field: 'voice' | 'rate' | 'pitch', value: any) => void;
}

export const CharacterManager: React.FC<CharacterManagerProps> = ({
  characters,
  onExtractCharacters,
  extractingCharacters,
  onOpenPromptManager,
  onUpdateCharacter,
  onSaveCharacter,
  savingCharacter,
  tempCharacter,
  onTempCharacterChange,
  onCharacterTestImage,
  onSaveCharacterTts,
  savingCharacterTts,
  tempCharacterTts,
  onTempCharacterTtsChange,
}) => {
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">角色列表</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onOpenPromptManager('character_extraction')}
            className="btn-secondary"
          >
            管理提示词
          </button>
          <button
            onClick={onExtractCharacters}
            disabled={extractingCharacters}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {extractingCharacters ? '提取中...' : '自动提取角色'}
          </button>
        </div>
      </div>
      <div className="space-y-4">
        {characters.map((char) => (
          <div key={char.id} className="border border-light-border dark:border-dark-border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">{char.name}</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingCharacterId(
                    editingCharacterId === char.id ? null : char.id
                  )}
                  className="text-primary-500 text-sm hover:text-primary-600"
                >
                  {editingCharacterId === char.id ? '收起' : '编辑'}
                </button>
              </div>
            </div>

            {editingCharacterId === char.id ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">角色描述</label>
                  <textarea
                    value={tempCharacter[char.id]?.description ?? char.description}
                    onChange={(e) => onTempCharacterChange(char.id, 'description', e.target.value)}
                    className="input-field w-full"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">角色提示词 (英文)</label>
                  <textarea
                    value={tempCharacter[char.id]?.characterPrompt ?? char.characterPrompt}
                    onChange={(e) => onTempCharacterChange(char.id, 'characterPrompt', e.target.value)}
                    className="input-field w-full font-mono text-sm"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">负面提示词 (英文)</label>
                  <textarea
                    value={tempCharacter[char.id]?.negativePrompt ?? char.negativePrompt}
                    onChange={(e) => onTempCharacterChange(char.id, 'negativePrompt', e.target.value)}
                    className="input-field w-full font-mono text-sm"
                    rows={2}
                  />
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-light-border dark:border-dark-border">
                  <button
                    onClick={() => onCharacterTestImage(char.id)}
                    className="btn-secondary text-sm"
                  >
                    🎨 测试生图
                  </button>
                  <button
                    onClick={() => onSaveCharacter(char.id)}
                    disabled={savingCharacter === char.id}
                    className={`btn-primary ${savingCharacter === char.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {savingCharacter === char.id ? '保存中...' : '保存'}
                  </button>
                </div>
                <div className="pt-4 border-t border-light-border dark:border-dark-border space-y-4">
                  <h5 className="font-medium text-sm text-light-text-primary dark:text-dark-text-primary">声音配置</h5>
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">声音</label>
                    <select
                      value={tempCharacterTts[char.id]?.voice || char.ttsConfig?.voice || 'zh-CN-XiaoxiaoNeural'}
                      onChange={(e) => {
                        onTempCharacterTtsChange(char.id, 'voice', e.target.value);
                      }}
                      className="input-field w-full"
                    >
                      {TTS_VOICES.map((voice) => (
                        <option key={voice.value} value={voice.value}>
                          {voice.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      语速: {(tempCharacterTts[char.id]?.rate || char.ttsConfig?.rate || 1.0).toFixed(1)}x
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={tempCharacterTts[char.id]?.rate || char.ttsConfig?.rate || 1.0}
                      onChange={(e) => {
                        onTempCharacterTtsChange(char.id, 'rate', parseFloat(e.target.value));
                      }}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      音调: {(tempCharacterTts[char.id]?.pitch ?? char.ttsConfig?.pitch ?? 0)}Hz
                    </label>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={tempCharacterTts[char.id]?.pitch ?? char.ttsConfig?.pitch ?? 0}
                      onChange={(e) => {
                        onTempCharacterTtsChange(char.id, 'pitch', parseInt(e.target.value));
                      }}
                      className="w-full"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => onSaveCharacterTts(char.id)}
                      disabled={savingCharacterTts === char.id || !tempCharacterTts[char.id]}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingCharacterTts === char.id ? '保存声音...' : '保存声音'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{char.description}</p>
                {char.characterPrompt && (
                  <div className="mt-2">
                    <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary font-mono truncate">
                      提示词: {char.characterPrompt}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {characters.length === 0 && (
          <p className="text-light-text-secondary dark:text-dark-text-secondary">还没有角色，点击上方按钮自动提取</p>
        )}
      </div>
    </div>
  );
};
