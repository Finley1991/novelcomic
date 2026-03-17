# 更新日志

## [Unreleased]

### 2026-03-17

#### 新增功能
- **OpenAI / 兼容 API 支持**
  - 添加了 `LLMProvider` 枚举，支持 Ollama 和 OpenAI 两种提供商
  - 新增 `OpenAISettings` 数据模型，包含完整的 OpenAI 配置选项
  - 新增 `LLMSettings` 嵌套配置结构
  - 新增 `OpenAIClient` 客户端类，使用 aiohttp 进行异步请求
  - 新增 `LLMClient` 统一接口，自动根据配置选择提供商

- **代理支持**
  - 在 `OpenAISettings` 中添加 `proxy` 字段
  - `OpenAIClient` 支持通过 HTTP 代理发送请求
  - 支持 `http://127.0.0.1:7897` 等本地代理格式
  - 使用 aiohttp 的 `trust_env=True` 确保代理正常工作

- **LLM 测试功能**
  - 新增 API 端点 `POST /api/settings/llm/test`
  - 前端新增"测试连接"按钮
  - 实时显示测试结果（成功/失败、提供商、响应内容）
  - 支持 60 秒超时保护

- **前端 UI 改进**
  - 新增 LLM 提供商下拉选择器
  - 条件渲染对应提供商的设置表单
  - OpenAI 设置表单包含：API Key、Base URL、模型、代理
  - 测试结果显示区域，支持成功/失败样式

#### 配置更新
- 更新 `config.py`，添加 OpenAI 相关配置项
- 更新 `.env` 和 `.env.example`，添加 OpenAI 配置示例
- 更新 `README.md`，添加 OpenAI 和代理配置说明
- 新建 `PROJECT_STATUS.md`，详细记录项目当前状态

#### 向后兼容
- 保留旧的 `ollama` 配置结构，用于向后兼容
- `LLMClient` 会优先使用新的 `llm.ollama` 配置，降级到旧的 `ollama` 配置
- 存储层自动处理新旧配置格式的迁移

#### 文件清单
**新增文件:**
- `backend/core/openai_client.py` - OpenAI API 客户端
- `backend/core/llm.py` - 统一 LLM 客户端接口
- `PROJECT_STATUS.md` - 项目状态文档
- `CHANGELOG.md` - 更新日志
- `backend/.env.example` - 环境变量示例

**修改文件:**
- `backend/models/schemas.py` - 添加 LLMProvider, LLMSettings, OpenAISettings
- `backend/config.py` - 添加 OpenAI 配置
- `backend/api/projects.py` - 添加 LLM 测试端点
- `backend/core/storage.py` - 保持向后兼容
- `frontend/src/services/api.ts` - 添加类型定义和 API 方法
- `frontend/src/pages/Settings.tsx` - 更新设置 UI
- `README.md` - 更新文档
- `backend/.env` - 添加 OpenAI 配置
