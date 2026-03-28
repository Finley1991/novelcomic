# UI/UX Optimization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the UI/UX optimization design, transforming NovelComic into a polished, professional AI manhua creation tool with warm, approachable aesthetics, sidebar navigation, wizard-style project editing, and both light/dark themes.

**Architecture:**
- Phase 1: Core layout and visual design system (color system + sidebar + top bar)
- Phase 2: Interactive experience optimization (wizard layout + feedback system)
- Phase 3-5: Feature enhancements for prompts, characters, storyboarding
- Maintain backward compatibility with existing backend API

**Tech Stack:** React 18 + TypeScript + Tailwind CSS + React Router

---

## Phase 1: Core Layout and Visual System (MVP)

### Task 1: Set up Tailwind CSS Color Theme System

**Files:**
- Modify: `frontend/tailwind.config.js`
- Create: `frontend/src/styles/themes.ts`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Read existing tailwind.config.js to understand current config**

**Current state:** Basic Tailwind config with no custom colors

- [ ] **Step 2: Update tailwind.config.js with custom color palette for light/dark themes**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light theme colors (default)
        primary: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FF8C42',
          600: '#FF6B35',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        secondary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#5B9BD5',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        success: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        error: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },
        // Light theme backgrounds
        light: {
          bg: '#FFFBF7',
          card: '#FFFFFF',
          text: {
            primary: '#2D3748',
            secondary: '#718096',
          },
          border: '#E2E8F0',
          divider: '#F7FAFC',
        },
        // Dark theme backgrounds
        dark: {
          bg: '#1A1A2E',
          card: '#16213E',
          text: {
            primary: '#F7FAFC',
            secondary: '#A0AEC0',
          },
          border: '#4A5568',
          divider: '#2D3748',
        },
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
        'input': '8px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
        'primary': '0 4px 12px rgba(255, 140, 66, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 300ms ease-in-out',
        'modal-in': 'modalIn 200ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        modalIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 3: Create theme types and hook for theme management**

Create `frontend/src/styles/themes.ts`:

```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage first
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
```

- [ ] **Step 4: Update index.css with base styles**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

@layer components {
  .card {
    @apply rounded-card bg-light-card dark:bg-dark-card shadow-card transition-all duration-200;
  }

  .card:hover {
    @apply shadow-card-hover -translate-y-1;
  }

  .card:active {
    @apply translate-y-0;
  }

  .btn-primary {
    @apply rounded-button bg-gradient-to-br from-primary-500 to-primary-600 text-white px-5 py-2.5 font-medium transition-all duration-150 hover:-translate-y-0.5 hover:shadow-primary;
  }

  .btn-secondary {
    @apply rounded-button bg-transparent border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary px-5 py-2.5 font-medium transition-all duration-150 hover:bg-light-divider dark:hover:bg-dark-divider hover:border-gray-300 dark:hover:border-gray-500;
  }

  .btn-icon {
    @apply w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 hover:bg-black/5 dark:hover:bg-white/5;
  }

  .input-field {
    @apply rounded-input border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card px-3.5 py-2.5 text-sm transition-all duration-100 focus:outline-none focus:border-primary-500 focus:ring-3 focus:ring-primary-500/10;
  }

  .input-label {
    @apply text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5;
  }

  .page-transition {
    animation: fadeIn 300ms ease-in-out;
  }

  .sidebar-transition {
    transition: width 200ms ease;
  }

  .modal-enter {
    animation: modalIn 200ms ease-out;
  }
}
```

- [ ] **Step 5: Verify theme setup by running dev server**

Run: `cd frontend && npm run dev`
Expected: Server starts successfully, no errors

---

### Task 2: Create Sidebar Navigation Component

**Files:**
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/components/layout/TopBar.tsx`
- Create: `frontend/src/components/layout/AppLayout.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create Sidebar component with navigation items**

Create `frontend/src/components/layout/Sidebar.tsx`:

```typescript
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

const sidebarItems: SidebarItem[] = [
  { id: 'projects', label: '项目', icon: '📁', path: '/' },
  { id: 'templates', label: '提示词模板', icon: '🎨', path: '/templates' },
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
```

- [ ] **Step 2: Create TopBar component with theme toggle and notifications**

Create `frontend/src/components/layout/TopBar.tsx`:

```typescript
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
```

- [ ] **Step 3: Create AppLayout component that combines Sidebar and TopBar**

Create `frontend/src/components/layout/AppLayout.tsx`:

```typescript
import React, { useState, ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-light-bg dark:bg-dark-bg">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={title} />
        <main className="flex-1 overflow-auto p-6">
          <div className="page-transition">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update main.tsx to use ThemeProvider and AppLayout**

Replace entire contents with:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { ThemeProvider } from './styles/themes';
import { AppLayout } from './components/layout/AppLayout';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const ProjectEditor = React.lazy(() => import('./pages/ProjectEditor'));
const Settings = React.lazy(() => import('./pages/Settings'));
const PromptManager = React.lazy(() => import('./pages/PromptManager'));
const ImagePromptManager = React.lazy(() => import('./pages/ImagePromptManager'));

// Placeholder pages
function TemplatesPage() {
  return <div className="card p-6"><h2 className="text-2xl font-bold">提示词模板</h2></div>;
}

function HelpPage() {
  return <div className="card p-6"><h2 className="text-2xl font-bold">使用帮助</h2></div>;
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppLayout>
          <React.Suspense fallback={<div className="card p-6">加载中...</div>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/project/:id" element={<ProjectEditor />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/help" element={<HelpPage />} />
              {/* Redirect old routes */}
              <Route path="/prompts" element={<Navigate to="/templates" replace />} />
              <Route path="/image-prompts" element={<Navigate to="/templates" replace />} />
            </Routes>
          </React.Suspense>
        </AppLayout>
      </BrowserRouter>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Run dev server and verify layout works**

Run: `cd frontend && npm run dev`
Expected: Sidebar and top bar display correctly, theme toggle works

---

### Task 3: Update Dashboard Page with New Design

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Rewrite Dashboard.tsx to use new design components**

```typescript
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectApi } from '../services/api';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectText, setNewProjectText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await projectApi.list();
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const response = await projectApi.create(newProjectName, newProjectText || undefined);
      navigate(`/project/${response.data.id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('确定要删除这个项目吗？')) return;
    try {
      await projectApi.delete(id);
      loadProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6">
            <div className="h-6 w-1/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded mt-4 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
          我的项目
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          + 新建项目
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
        <div
          key={project.id}
          className="card p-6 cursor-pointer"
          onClick={() => navigate(`/project/${project.id}`)}
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
              {project.name}
            </h3>
            <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => navigate(`/project/${project.id}`)}
                className="btn-icon"
                title="编辑"
              >
                ✏️
              </button>
              <button
                onClick={() => handleDeleteProject(project.id)}
                className="btn-icon text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10"
                title="删除"
              >
                🗑️
              </button>
            </div>
          </div>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
            创建于: {new Date(project.createdAt).toLocaleDateString()}
          </p>
          {/* Progress indicator placeholder */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-light-divider dark:bg-dark-divider rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full"
                style={{ width: '0%' }}
              />
            </div>
            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              0%
            </span>
          </div>
        </div>
      ))}
      </div>

      {projects.length === 0 && (
        <div className="card p-12 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
            还没有项目
          </h3>
          <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
            点击上方按钮创建你的第一个漫剧项目
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            创建项目
          </button>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md modal-enter">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                创建新项目
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-icon"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="input-label">项目名称</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="input-field w-full"
                  placeholder="输入项目名称"
                  autoFocus
                />
              </div>
              <div>
                <label className="input-label">小说文本（可选）</label>
                <textarea
                  value={newProjectText}
                  onChange={(e) => setNewProjectText(e.target.value)}
                  className="input-field w-full h-32 resize-none"
                  placeholder="粘贴小说文本..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={!newProjectName.trim()}
                >
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
```

- [ ] **Step 2: Verify Dashboard works with new design**

Run: `cd frontend && npm run dev`
Expected: Dashboard displays correctly in new card-based layout

---

## Phase 2: Interactive Experience Optimization

### Task 4: Create Wizard-Style Project Editor Layout

**Files:**
- Create: `frontend/src/components/project/WizardSteps.tsx`
- Modify: `frontend/src/pages/ProjectEditor.tsx`

- [ ] **Step 1: Create WizardSteps component for step navigation**

Create `frontend/src/components/project/WizardSteps.tsx`:

```typescript
import React from 'react';

export type WizardStep = {
  id: number;
  label: string;
  icon: string;
  status: 'completed' | 'current' | 'pending';
};

interface WizardStepsProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function WizardSteps({ steps, currentStep, onStepClick }: WizardStepsProps) {
  return (
    <div className="card p-4 mb-6">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Step */}
            <button
              onClick={() => onStepClick?.(step.id)}
              disabled={step.status === 'pending' && step.id > currentStep + 1}
              className={`
                flex flex-col items-center gap-2 relative z-10
                ${step.status !== 'pending' || step.id <= currentStep + 1
                  ? 'cursor-pointer'
                  : 'cursor-not-allowed opacity-50'
                }
              `}
            >
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold
                  transition-all duration-200
                  ${step.status === 'completed'
                    ? 'bg-success-500 text-white'
                    : step.status === 'current'
                    ? 'bg-primary-500 text-white ring-4 ring-primary-500/20'
                    : 'bg-light-divider dark:bg-dark-divider text-light-text-secondary dark:text-dark-text-secondary'
                  }
                `}
              >
                {step.status === 'completed' ? '✓' : step.icon}
              </div>
              <span
                className={`
                  text-sm font-medium
                  ${step.status === 'current'
                    ? 'text-primary-600 dark:text-primary-400'
                    : step.status === 'completed'
                    ? 'text-success-600 dark:text-success-400'
                    : 'text-light-text-secondary dark:text-dark-text-secondary'
                  }
                `}
              >
                {step.label}
              </span>
            </button>

            {/* Connector */}
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 -mt-6">
                <div
                  className={`
                    h-full transition-all duration-300
                    ${index < currentStep
                      ? 'bg-success-500'
                      : 'bg-light-divider dark:bg-dark-divider'
                    }
                  `}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export const wizardStepDefinitions: Omit<WizardStep, 'status'>[] = [
  { id: 0, label: '项目设置', icon: '1' },
  { id: 1, label: '角色管理', icon: '2' },
  { id: 2, label: '场景管理', icon: '3' },
  { id: 3, label: '分镜编辑', icon: '4' },
  { id: 4, label: '导出交付', icon: '5' },
];
```

- [ ] **Step 2: Modify ProjectEditor.tsx to use wizard layout**

**What to keep from existing file:**
- All imports except none to remove
- All state variables (project, currentStep, loading, etc.)
- All helper functions (loadProject, saveProjectSettings, etc.)
- All useEffect hooks
- All the step content: currentStep === 0 through 4 sections
- All modals (showProjectSettings, character editing, etc.)

**What to change:**
1. Add wizard imports
2. Add wizard state logic
3. Replace the loading indicator
4. Replace the old tab button navigation with WizardSteps
5. Add project header at top
6. Add step navigation buttons at bottom

**Step-by-step implementation:**

1. Read the entire existing ProjectEditor.tsx file first

2. Add this import after existing imports:
```typescript
import { WizardSteps, wizardStepDefinitions, type WizardStep } from '../components/project/WizardSteps';
```

3. Add this code right after the last useState declaration (after exportingJianying):
```typescript
  const getStepStatus = (stepId: number): WizardStep['status'] => {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'pending';
  };

  const wizardSteps: WizardStep[] = wizardStepDefinitions.map(step => ({
    ...step,
    status: getStepStatus(step.id),
  }));

  const handleStepClick = (stepId: number) => {
    if (stepId > currentStep + 1) {
      if (!confirm('确定要跳过未完成的步骤吗？')) {
        return;
      }
    }
    setCurrentStep(stepId);
  };
```

4. Replace the existing `if (loading) { ... }` block with:
```typescript
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="card p-6">
          <div className="h-6 w-1/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded mt-4 animate-pulse" />
        </div>
      </div>
    );
  }
```

5. Locate and remove the old tab navigation buttons - it's a div with flex containing buttons like:
   - `<button onClick={() => setCurrentStep(0)} className={...}>项目设置</button>`
   - `<button onClick={() => setCurrentStep(1)} className={...}>角色管理</button>`
   - etc. for all 5 steps
   - Remove this entire navigation button section

6. Wrap the entire return content structure as follows (keep all the inner content):
```typescript
  return (
    <div>
      {/* Project header - ADD THIS */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
            {project?.name}
          </h2>
          <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">
            创建于 {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={() => setShowProjectSettings(!showProjectSettings)}
          className="btn-secondary"
        >
          ⚙️ 项目设置
        </button>
      </div>

      {/* Wizard Steps - ADD THIS */}
      <WizardSteps
        steps={wizardSteps}
        currentStep={currentStep}
        onStepClick={handleStepClick}
      />

      {/* --- KEEP ALL EXISTING CONTENT HERE --- */}
      {/* This includes: showProjectSettings modal, currentStep === 0 through 4, etc. */}

      {/* Step Navigation Buttons - ADD THIS AT BOTTOM */}
      <div className="flex justify-between mt-8 pt-6 border-t border-light-border dark:border-dark-border">
        <button
          onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
          disabled={currentStep === 0}
          className="btn-secondary"
        >
          ← 上一步
        </button>
        <button
          onClick={() => setCurrentStep(prev => Math.min(4, prev + 1))}
          disabled={currentStep === 4}
          className="btn-primary"
        >
          下一步 →
        </button>
      </div>
    </div>
  );
```

- [ ] **Step 3: Test wizard navigation works**

Run: `cd frontend && npm run dev`
Expected: Can navigate between steps with wizard UI

---

### Task 5: Create Toast Notification System

**Files:**
- Create: `frontend/src/components/ui/Toast.tsx`
- Create: `frontend/src/hooks/useToast.ts`
- Modify: `frontend/src/main.tsx` (add ToastProvider)

- [ ] **Step 1: Create Toast context and hook**

Create `frontend/src/hooks/useToast.ts`:

```typescript
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);

    const duration = toast.duration ?? 3000;
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
```

- [ ] **Step 2: Create Toast component**

Create `frontend/src/components/ui/Toast.tsx`:

```typescript
import React, { useEffect } from 'react';
import { useToast, type Toast as ToastType } from '../../hooks/useToast';

const toastIcons: Record<ToastType['type'], string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const toastStyles: Record<ToastType['type'], string> = {
  success: 'border-success-500 bg-success-50 dark:bg-success-500/10 text-success-700 dark:text-success-300',
  error: 'border-error-500 bg-error-50 dark:bg-error-500/10 text-error-700 dark:text-error-300',
  warning: 'border-warning-500 bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-300',
  info: 'border-secondary-500 bg-secondary-50 dark:bg-secondary-500/10 text-secondary-700 dark:text-secondary-300',
};

function Toast({ toast }: { toast: ToastType }) {
  const { removeToast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, toast.duration ?? 3000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 shadow-lg bg-light-card dark:bg-dark-card
        ${toastStyles[toast.type]}
        animate-fade-in
      `}
    >
      <span className="text-lg">{toastIcons[toast.type]}</span>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="btn-icon w-6 h-6"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 w-80">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add ToastProvider to main.tsx**

Wrap App with ToastProvider and add ToastContainer:

```tsx
import { ToastProvider } from './hooks/useToast';
import { ToastContainer } from './components/ui/Toast';

// In App component:
<ThemeProvider>
  <ToastProvider>
    <BrowserRouter>
      {/* ... existing content ... */}
    </BrowserRouter>
    <ToastContainer />
  </ToastProvider>
</ThemeProvider>
```

- [ ] **Step 4: Test toast notifications**

Create a temporary test button in Dashboard to verify:

1. Add test buttons to Dashboard component temporarily:
```typescript
// Add after imports in Dashboard.tsx
import { useToast } from '../hooks/useToast';

// Inside Dashboard component:
const { addToast } = useToast();

// Add test buttons in the JSX:
<div className="flex gap-2 mb-4">
  <button onClick={() => addToast({ type: 'success', message: '操作成功！' })} className="btn-secondary">
    测试成功提示
  </button>
  <button onClick={() => addToast({ type: 'error', message: '操作失败！' })} className="btn-secondary">
    测试错误提示
  </button>
  <button onClick={() => addToast({ type: 'warning', message: '请注意！' })} className="btn-secondary">
    测试警告提示
  </button>
  <button onClick={() => addToast({ type: 'info', message: '提示信息' })} className="btn-secondary">
    测试信息提示
  </button>
</div>
```

2. Run dev server and verify:
   - Each toast type shows with correct icon and color
   - Toasts auto-dismiss after 3 seconds
   - Clicking ✕ button dismisses toast immediately
   - Multiple toasts stack correctly

3. Remove the test buttons after verification

---

### Task 6: Add Keyboard Shortcuts Support

**Files:**
- Create: `frontend/src/hooks/useKeyboardShortcuts.ts`
- Create: `frontend/src/components/ui/KeyboardShortcutsHelp.tsx`
- Modify: `frontend/src/components/layout/TopBar.tsx` (already updated in Task 2)

- [ ] **Step 1: Create keyboard shortcuts hook**

Create `frontend/src/hooks/useKeyboardShortcuts.ts`:

```typescript
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
```

- [ ] **Step 2: Create KeyboardShortcutsHelp modal component**

Create `frontend/src/components/ui/KeyboardShortcutsHelp.tsx`:

```typescript
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
```

- [ ] **Step 3: Add keyboard shortcut trigger in TopBar**

Note: This was already integrated in Task 2, Step 2. Verify the TopBar.tsx includes the keyboard shortcuts button and handler.

- [ ] **Step 4: Test keyboard shortcuts**

Verify:
- Cmd/Ctrl + / shows shortcuts help
- Esc closes the modal
- Shortcuts display correctly in light/dark themes

---

## Phase 3: Prompt Template System Enhancements (Roadmap)

High-level tasks to be detailed in separate plan:
- [ ] Create template version management system (save history, rollback, diff view)
- [ ] Build template preview/testing interface (test input, live output preview)
- [ ] Implement template variable editor (visual variable list, insert, preview)
- [ ] Add template import/export (JSON format)
- [ ] Build A/B testing framework for template comparison

## Phase 4: Character/Scene Management Enhancements (Roadmap)

High-level tasks to be detailed in separate plan:
- [ ] Enhance character editor with visual description, personality settings, reference images
- [ ] Add multi-angle reference image management (front/side/back + expressions)
- [ ] Build character consistency checker for reference images
- [ ] Create character sheet export (PDF/Markdown)
- [ ] Enhance scene management with similar features
- [ ] Build basic asset library infrastructure

## Phase 5: Storyboard Professional Features (Roadmap)

High-level tasks to be detailed in separate plan:
- [ ] Build shot language library (presets with examples, descriptions, prompt snippets)
- [ ] Create visual shot type selector interface
- [ ] Add AI-powered storyboard recommendations
- [ ] Implement Ken Burns effect preview with adjustable parameters
- [ ] Enhance batch operations toolbar
- [ ] Add drag-and-drop sorting for storyboards

---

## End of Plan Phase 1-2

**Plan complete:** Phase 1-2 ready for implementation. Phases 3-5 will be detailed in separate plans after Phase 1-2 is complete and validated.
