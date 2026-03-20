# 剧本拆分优化设计文档

**日期**: 2026-03-20
**版本**: 1.0

## 概述

优化剧本拆分功能，改为按行分割原文，并在拆分后自动生成画图提示词，支持前端编辑提示词。

## 目标

1. 简化分镜拆分逻辑，改为按行分割（1行/2行/3行可选）
2. 分镜拆分后自动批量生成画图提示词（imagePrompt）
3. 前端支持编辑每个分镜的画图提示词

## 需求分析

### 功能需求

1. **按行分割原文**
   - 用户可选择：1行/2行/3行 = 1个分镜
   - 原文格式：每行一个句子，段落间有空行
   - 空行跳过，不计入行数
   - 原文直接填入 sceneDescription 字段
   - dialogue、narration、characterIds 暂时不处理（留空）

2. **自动生成画图提示词**
   - 分镜拆分完成后立即自动批量生成
   - 输入：当前分镜文案 + 小说全文 + 角色列表
   - 输出：ComfyUI 可用的英文提示词
   - 存储在 imagePrompt 字段

3. **前端提示词编辑**
   - 分镜列表中每个分镜卡片显示可编辑的 imagePrompt 输入框
   - 支持实时编辑，失焦时自动保存
   - 输入框可折叠/展开（提示词可能很长）

4. **图片生成使用提示词**
   - 自动画图时直接使用分镜的 imagePrompt
   - 拼接角色提示词、前后缀等

## 架构设计

### 数据流程

```
用户选择行数(1/2/3)
    ↓
点击"自动拆分剧本"
    ↓
后端按行分割 → sceneDescription = 原文
    ↓
自动调用LLM批量生成 imagePrompt
    ↓
返回完整分镜列表
    ↓
前端展示分镜 + 可编辑的 imagePrompt
    ↓
用户可修改 imagePrompt
    ↓
点击"批量生成图片" → 使用 imagePrompt
```

### 模块改动

#### 1. 后端 API 改动

**文件**: `backend/api/generation.py`

**修改**: `split_storyboard` 端点

- 新增参数: `lines_per_storyboard: int = 1` (1/2/3)
- 移除 LLM 调用
- 实现按行分割逻辑
- 拆分完成后自动调用提示词生成

**新增**: `generate_storyboard_prompts` 端点

- 路径: `POST /projects/{project_id}/storyboards/generate-prompts`
- 功能: 批量生成分镜的 imagePrompt
- 输入: `storyboardIds?: string[]` (可选，默认全部分镜)

#### 2. 后端 LLM Client 改动

**文件**: `backend/core/ollama.py` 和 `backend/core/openai_client.py`

- 确保 `generate_image_prompt` 方法可用
- 传入参数: scene_description, 小说全文, 角色列表

#### 3. 前端改动

**文件**: `frontend/src/pages/ProjectEditor.tsx`

- "自动拆分剧本"按钮旁边添加下拉选择器 (1行/2行/3行)
- 分镜列表 (currentStep === 1) 中每个分镜卡片增加 imagePrompt 输入框
- 输入框可折叠/展开
- 失焦时调用 API 保存 imagePrompt

## 详细设计

### 1. 按行分割逻辑

```python
def split_by_lines(text: str, lines_per_storyboard: int) -> List[Dict]:
    lines = text.split('\n')
    storyboards = []
    current_lines = []
    index = 0

    for line in lines:
        line = line.strip()
        if not line:
            continue  # 跳过空行

        current_lines.append(line)

        if len(current_lines) >= lines_per_storyboard:
            # 凑够指定行数，创建分镜
            storyboards.append({
                "index": index,
                "sceneDescription": "\n".join(current_lines),
                "dialogue": "",
                "narration": "",
                "characterNames": []
            })
            current_lines = []
            index += 1

    # 处理剩余的行
    if current_lines:
        storyboards.append({
            "index": index,
            "sceneDescription": "\n".join(current_lines),
            "dialogue": "",
            "narration": "",
            "characterNames": []
        })

    return storyboards
```

### 2. 批量生成提示词逻辑

```python
async def generate_prompts_for_storyboards(
    project: Project,
    storyboard_ids: Optional[List[str]] = None
):
    settings = storage.load_global_settings()
    llm_client = LLMClient(settings)

    target_sbs = project.storyboards
    if storyboard_ids:
        target_sbs = [sb for sb in project.storyboards if sb.id in storyboard_ids]

    char_dicts = [c.model_dump() for c in project.characters]

    for sb in target_sbs:
        if not sb.imagePrompt:
            sb.imagePrompt = await llm_client.generate_image_prompt(
                scene_description=sb.sceneDescription,
                characters=char_dicts,
                style_prompt=project.stylePrompt,
                novel_text=project.sourceText,  # 传入全文
                project=project,
                global_settings=settings
            )

    storage.save_project(project)
```

### 3. 前端分镜卡片 UI

在分镜列表中，每个分镜卡片增加：

```tsx
<div className="mt-3 pt-3 border-t">
  <div className="flex justify-between items-center mb-2">
    <label className="text-sm font-medium text-gray-700">画图提示词</label>
    <button
      onClick={() => setExpandedPrompt(
        expandedPrompt === sb.id ? null : sb.id
      )}
      className="text-xs text-blue-500 hover:text-blue-600"
    >
      {expandedPrompt === sb.id ? '收起' : '展开'}
    </button>
  </div>
  {expandedPrompt === sb.id && (
    <textarea
      value={sb.imagePrompt || ''}
      onChange={(e) => handlePromptChange(sb.id, e.target.value)}
      onBlur={() => handlePromptSave(sb.id)}
      placeholder="AI 生成的画图提示词将显示在这里..."
      className="w-full border rounded-md px-3 py-2 text-sm font-mono"
      rows={4}
    />
  )}
</div>
```

## API 接口定义

### 修改分镜拆分接口

**请求**:
```
POST /api/projects/{project_id}/storyboards/split
Content-Type: application/json

{
  "lines_per_storyboard": 1  // 1, 2, or 3
}
```

**响应**:
```json
{
  "storyboards": [...]
}
```

### 新增批量生成提示词接口

**请求**:
```
POST /api/projects/{project_id}/storyboards/generate-prompts
Content-Type: application/json

{
  "storyboardIds": ["uuid1", "uuid2"]  // 可选，不提供则生成全部分镜
}
```

**响应**:
```json
{
  "success": true,
  "updated": 10
}
```

## 实现计划

1. 修改后端 split_storyboard API，支持按行分割
2. 新增后端批量生成提示词 API
3. 修改前端，添加行数选择器
4. 修改前端，添加提示词编辑功能
5. 联调测试

## 风险和注意事项

1. **全文长度限制**: 小说全文可能很长，超过 LLM 上下文限制。后续可优化为只传相关部分。
2. **同步生成耗时**: 批量生成提示词可能耗时较长，后续可改为异步。
3. **向后兼容**: 保留原有的 prompt template 机制不变。
