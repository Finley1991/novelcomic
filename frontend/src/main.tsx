import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { ThemeProvider } from './styles/themes';
import { ToastProvider } from './hooks/useToast';
import { ToastContainer } from './components/ui/Toast';
import { AppLayout } from './components/layout/AppLayout';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const ProjectEditor = React.lazy(() => import('./pages/ProjectEditor'));
const Settings = React.lazy(() => import('./pages/Settings'));
const PromptManager = React.lazy(() => import('./pages/PromptManager'));
const ImagePromptManager = React.lazy(() => import('./pages/ImagePromptManager'));

// Placeholder page for help
function HelpPage() {
  return (
    <div className="card p-6">
      <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">使用帮助</h2>
    </div>
  );
}

// Wrapper for pages that use AppLayout
function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppLayout>
          {children}
        </AppLayout>
        <ToastContainer />
      </ToastProvider>
    </ThemeProvider>
  );
}

// Wrapper for standalone pages (with their own layout)
function StandaloneWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        {children}
        <ToastContainer />
      </ToastProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone pages (legacy with their own layout) */}
        <Route path="/prompts" element={
          <StandaloneWrapper>
            <React.Suspense fallback={<div className="p-6">加载中...</div>}>
              <PromptManager />
            </React.Suspense>
          </StandaloneWrapper>
        } />
        <Route path="/image-prompts" element={
          <StandaloneWrapper>
            <React.Suspense fallback={<div className="p-6">加载中...</div>}>
              <ImagePromptManager />
            </React.Suspense>
          </StandaloneWrapper>
        } />
        {/* Pages with AppLayout */}
        <Route path="/*" element={
          <LayoutWrapper>
            <React.Suspense fallback={<div className="card p-6">加载中...</div>}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/project/:id" element={<ProjectEditor />} />
                <Route path="/templates" element={<Navigate to="/prompts" replace />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/help" element={<HelpPage />} />
              </Routes>
            </React.Suspense>
          </LayoutWrapper>
        } />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
