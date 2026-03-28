import React from 'react';

interface KeyboardShortcutsHelpProps {
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ onClose }: KeyboardShortcutsHelpProps) {
  const shortcutGroups = [
    {
      title: '全局快捷键',
      shortcuts: [
        { keys: 'Cmd/Ctrl + S', description: '保存当前项目' },
        { keys: 'Cmd/Ctrl + N', description: '新建项目' },
        { keys: 'Cmd/Ctrl + O', description: '打开项目' },
        { keys: 'Cmd/Ctrl + P', description: '快速搜索项目' },
        { keys: 'Cmd/Ctrl + W', description: '关闭当前标签' },
        { keys: 'Cmd/Ctrl + Z', description: '撤销' },
        { keys: 'Cmd/Ctrl + Shift + Z', description: '重做' },
        { keys: 'Cmd/Ctrl + /', description: '显示快捷键帮助' },
        { keys: 'Esc', description: '关闭弹窗/取消操作' },
      ],
    },
    {
      title: '项目编辑快捷键',
      shortcuts: [
        { keys: '1 / 2 / 3 / 4 / 5', description: '跳转到对应步骤' },
        { keys: 'Cmd/Ctrl + G', description: '批量生成图片' },
        { keys: 'Cmd/Ctrl + Shift + G', description: '批量生成音频' },
        { keys: 'Space', description: '播放/暂停预览' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card p-6 w-full max-w-2xl max-h-[80vh] overflow-auto modal-enter" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
            键盘快捷键
          </h3>
          <button onClick={onClose} className="btn-icon">
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h4 className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-3">
                {group.title}
              </h4>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, i) => (
                  <div key={i} className="flex justify-between items-center py-1">
                    <span className="text-sm text-light-text-primary dark:text-dark-text-primary">
                      {shortcut.description}
                    </span>
                    <div className="flex gap-1">
                      {shortcut.keys.split(' / ').map((key, j) => (
                        <kbd
                          key={j}
                          className="px-2 py-1 text-xs font-mono bg-light-divider dark:bg-dark-divider rounded border border-light-border dark:border-dark-border"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
