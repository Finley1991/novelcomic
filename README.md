# NovelComic

小说推文 AI漫剧生成工具

## 功能特点

- 🎭 自动提取小说角色
- 📝 智能拆分剧本分镜
- 🤖 支持多种 LLM 提供商 (Ollama / OpenAI / 兼容 API)
- 🎨 AI 图片生成 (ComfyUI)
- 🔊 AI 配音生成 (Microsoft TTS)
- ✂️ 一键导出剪映草稿
- 🔌 支持 HTTP 代理配置

## 快速开始

### 前置要求

- Python 3.10+
- Node.js 18+
- ComfyUI (运行中)
- LLM 服务 (二选一):
  - Ollama (运行中)
  - OpenAI API Key (或兼容 API)
- Microsoft Azure TTS API Key (可选)

### 后端启动

```bash
cd novelcomic/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 配置 API 地址
python main.py
```

### 前端启动

```bash
cd novelcomic/frontend
npm install
npm run dev
```

### 访问应用

- 前端: http://localhost:5175
- 后端 API: http://localhost:8001
- API 文档: http://localhost:8001/docs

## 配置说明

在运行前，请先配置以下 API 服务：

### ComfyUI

默认地址: `http://8.222.174.34:8188`

可以在应用的"设置"页面修改。

### LLM 设置 (二选一)

#### 选项 A: Ollama

默认地址: `http://8.222.174.34:11434`

默认模型: `llama3`

可以在应用的"设置"页面修改。

#### 选项 B: OpenAI / 兼容 API

支持:
- OpenAI 官方 API
- 任何兼容 OpenAI 格式的 API (如 Azure OpenAI, 本地模型等)

配置项:
- API Key: 你的 API 密钥
- Base URL: API 地址 (默认: `https://api.openai.com/v1`)
- 模型: 模型名称 (如 `gpt-4o`, `gpt-4`, `gpt-3.5-turbo`)
- 代理 (可选): HTTP 代理地址 (如 `http://127.0.0.1:7897`)

可以在应用的"设置"页面配置，并点击"测试连接"验证。

### Microsoft TTS

需要配置:
- Subscription Key
- Region

可以在应用的"设置"页面配置。

## 使用流程

1. **配置设置** - 在"设置"页面配置 LLM、ComfyUI、TTS 等服务
   - 选择 LLM 提供商 (Ollama 或 OpenAI)
   - 填写相应的 API 配置
   - 点击"测试连接"验证配置 (特别是 OpenAI)
   - 如需使用代理，填写代理地址
2. **创建项目** - 输入项目名称，粘贴小说文本
3. **角色管理** - 自动提取或手动添加角色
4. **剧本拆分** - 将小说拆分为多个分镜
5. **图片生成** - 批量生成漫剧画面
6. **配音生成** - 批量生成配音
7. **导出剪映** - 下载剪映草稿 ZIP 文件

## 项目结构

```
novelcomic/
├── backend/           # FastAPI 后端
│   ├── api/          # API 路由
│   ├── core/         # 核心业务逻辑
│   └── models/       # 数据模型
├── frontend/         # React 前端
│   ├── src/
│   │   ├── pages/    # 页面组件
│   │   └── services/ # API 客户端
└── data/             # 数据存储目录
    ├── config.json   # 全局设置
    └── projects/     # 项目数据
```

## 技术栈

**后端:**
- FastAPI
- Pydantic
- aiohttp

**前端:**
- React 18
- TypeScript
- Tailwind CSS
- Vite

**AI 服务:**
- ComfyUI (图片生成)
- LLM 提供商 (文本处理):
  - Ollama (本地/云端)
  - OpenAI / 兼容 API
- Microsoft TTS (语音合成)

## 许可证

MIT
