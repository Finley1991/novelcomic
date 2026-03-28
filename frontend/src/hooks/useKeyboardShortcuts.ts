import { useEffect, useCallback } from 'react';

type ShortcutHandler = () => void;

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const matchesKey = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const matchesCtrl = !shortcut.ctrl || e.ctrlKey;
        const matchesMeta = !shortcut.meta || e.metaKey;
        const matchesShift = !shortcut.shift || e.shiftKey;
        const matchesAlt = !shortcut.alt || e.altKey;

        if (matchesKey && matchesCtrl && matchesMeta && matchesShift && matchesAlt) {
          e.preventDefault();
          shortcut.handler();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Predefined shortcut groups
export const GLOBAL_SHORTCUTS = [
  { key: 's', ctrl: true, meta: true, description: '保存当前项目' },
  { key: 'n', ctrl: true, meta: true, description: '新建项目' },
  { key: 'p', ctrl: true, meta: true, description: '快速搜索项目' },
  { key: 'w', ctrl: true, meta: true, description: '关闭当前标签' },
  { key: 'z', ctrl: true, meta: true, description: '撤销' },
  { key: 'z', ctrl: true, meta: true, shift: true, description: '重做' },
  { key: '/', ctrl: true, meta: true, description: '显示快捷键帮助' },
  { key: 'Escape', description: '关闭弹窗/取消操作' },
];

export const PROJECT_EDITOR_SHORTCUTS = [
  { key: '1', description: '跳转到项目设置' },
  { key: '2', description: '跳转到角色管理' },
  { key: '3', description: '跳转到场景管理' },
  { key: '4', description: '跳转到分镜编辑' },
  { key: '5', description: '跳转到导出交付' },
  { key: 'g', ctrl: true, meta: true, description: '批量生成图片' },
  { key: 'g', ctrl: true, meta: true, shift: true, description: '批量生成音频' },
];
