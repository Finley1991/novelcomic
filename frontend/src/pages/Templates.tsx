import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PromptManager from './PromptManager';
import ImagePromptManager from './ImagePromptManager';

type TabType = 'prompts' | 'image-prompts';

const Templates: React.FC = () => {
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState<TabType>('prompts');

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-primary-500 hover:text-primary-600"
          >
            ← 返回
          </button>
          <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">提示词模板</h2>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="card p-2 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentTab('prompts')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-150 ${
              currentTab === 'prompts'
                ? 'bg-primary-500 text-white'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-divider dark:hover:bg-dark-divider'
            }`}
          >
            Prompt 模板
          </button>
          <button
            onClick={() => setCurrentTab('image-prompts')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-150 ${
              currentTab === 'image-prompts'
                ? 'bg-primary-500 text-white'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-divider dark:hover:bg-dark-divider'
            }`}
          >
            图片提示词
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="templates-container">
        {currentTab === 'prompts' ? (
          <PromptManagerStandalone />
        ) : (
          <ImagePromptManagerStandalone />
        )}
      </div>
    </div>
  );
};

// Wrapper for PromptManager without the outer container
function PromptManagerStandalone() {
  const navigate = useNavigate();
  const [currentType, setCurrentType] = useState<'character_extraction' | 'storyboard_split' | 'image_prompt' | 'scene_extraction'>('character_extraction');
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [variables, setVariables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  const typeLabels: Record<string, string> = {
    character_extraction: '角色提取',
    storyboard_split: '分镜拆分（旧版）',
    image_prompt: '图像生成',
    scene_extraction: '场景提取',
  };

  // We'll just show a simplified view for now
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">Prompt 模板管理</h3>
      <p className="text-light-text-secondary dark:text-dark-text-secondary">
        Prompt 模板管理功能正在重构中，请使用原页面访问完整功能。
      </p>
      <div className="mt-4">
        <button
          onClick={() => navigate('/prompts')}
          className="btn-primary"
        >
          访问原 Prompt 模板页面
        </button>
      </div>
    </div>
  );
}

// Wrapper for ImagePromptManager without the outer container
function ImagePromptManagerStandalone() {
  const navigate = useNavigate();

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">图片提示词管理</h3>
      <p className="text-light-text-secondary dark:text-dark-text-secondary">
        图片提示词管理功能正在重构中，请使用原页面访问完整功能。
      </p>
      <div className="mt-4">
        <button
          onClick={() => navigate('/image-prompts')}
          className="btn-primary"
        >
          访问原图片提示词页面
        </button>
      </div>
    </div>
  );
}

export default Templates;
