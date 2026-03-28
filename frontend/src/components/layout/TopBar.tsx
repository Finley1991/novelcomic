import React, { useState, useEffect } from 'react';
import { useTheme } from '../../styles/themes';
import { KeyboardShortcutsHelp } from '../ui/KeyboardShortcutsHelp';

interface TopBarProps {
  title?: string;
}

export function TopBar({ title }: TopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcutsHelp(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="h-16 bg-light-card dark:bg-dark-card border-b border-light-border dark:border-dark-border flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          {title && (
            <h1 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
              {title}
            </h1>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Keyboard shortcuts help */}
          <button
            onClick={() => setShowShortcutsHelp(true)}
            className="btn-icon"
            title="快捷键 (Cmd/Ctrl + /)"
          >
            ⌨️
          </button>

          {/* Notifications */}
          <button className="btn-icon relative">
            <span>🔔</span>
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-error-500 text-white text-xs rounded-full flex items-center justify-center">
              0
            </span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="btn-icon"
            aria-label={theme === 'light' ? '切换到深色主题' : '切换到浅色主题'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {/* User profile */}
          <button className="btn-icon">
            <span>👤</span>
          </button>
        </div>
      </header>

      {showShortcutsHelp && (
        <KeyboardShortcutsHelp onClose={() => setShowShortcutsHelp(false)} />
      )}
    </>
  );
}
