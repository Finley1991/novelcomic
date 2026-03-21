import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const ProjectEditor = React.lazy(() => import('./pages/ProjectEditor'));
const Settings = React.lazy(() => import('./pages/Settings'));
const PromptManager = React.lazy(() => import('./pages/PromptManager'));
const ImagePromptManager = React.lazy(() => import('./pages/ImagePromptManager'));

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-gray-900">NovelComic</h1>
              </div>
              <div className="flex items-center space-x-4">
                <a href="/" className="text-gray-600 hover:text-gray-900">项目</a>
                <a href="/prompts" className="text-gray-600 hover:text-gray-900">Prompt 模板</a>
                <a href="/image-prompts" className="text-gray-600 hover:text-gray-900">图片提示词</a>
                <a href="/settings" className="text-gray-600 hover:text-gray-900">设置</a>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <React.Suspense fallback={<div>Loading...</div>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/project/:id" element={<ProjectEditor />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/prompts" element={<PromptManager />} />
              <Route path="/image-prompts" element={<ImagePromptManager />} />
            </Routes>
          </React.Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
