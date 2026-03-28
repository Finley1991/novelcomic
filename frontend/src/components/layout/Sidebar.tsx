import { NavLink } from 'react-router-dom';

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

const sidebarItems: SidebarItem[] = [
  { id: 'projects', label: '项目', icon: '📁', path: '/' },
  { id: 'prompts', label: '提示词模板', icon: '🎨', path: '/prompts' },
  { id: 'settings', label: '设置', icon: '⚙️', path: '/settings' },
  { id: 'help', label: '帮助', icon: '📖', path: '/help' },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  return (
    <aside
      className={`
        flex flex-col h-full bg-light-card dark:bg-dark-card border-r border-light-border dark:border-dark-border sidebar-transition
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Logo area */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-light-border dark:border-dark-border">
        {!collapsed && (
          <span className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
            NovelComic
          </span>
        )}
        {collapsed && <span className="text-xl font-bold">N</span>}
        {onToggle && (
          <button
            onClick={onToggle}
            className="btn-icon"
            aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {collapsed ? '→' : '←'}
          </button>
        )}
      </div>

      {/* Navigation items */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {sidebarItems.map((item) => (
            <li key={item.id}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150
                  ${isActive
                    ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-divider dark:hover:bg-dark-divider'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
              >
                <span className="text-xl">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
