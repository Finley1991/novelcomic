# 剧本拆分优化实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化剧本拆分功能，支持按行分割，自动生成画图提示词，前端支持编辑提示词

**Architecture:** 修改后端分镜拆分API支持按行分割，新增批量生成提示词API，前端添加行数选择器和提示词编辑框

**Tech Stack:** FastAPI, React, TypeScript, Python

---

## 文件变更列表

**修改文件:**
- `backend/api/generation.py` - 修改分镜拆分API，新增批量生成提示词API
- `backend/models/schemas.py` - 添加新的请求/响应Schema
- `frontend/src/pages/ProjectEditor.tsx` - 添加行数选择器和提示词编辑功能
- `frontend/src/services/api.ts` - 添加新的API接口类型

---

### Task 1: 修改后端 Schema，添加新的请求类型

**Files:**
- Modify: `backend/models/schemas.py`

- [ ] **Step 1: 读取当前 schemas.py 文件**

先读取文件查看现有结构

- [ ] **Step 2: 添加 SplitStoryboardRequest Schema**

在合适位置添加：

```python
class SplitStoryboardRequest(BaseModel):
    lines_per_storyboard: int = Field(1, ge=1, le=3, description="每个分镜包含的行数(1-3)")
```

- [ ] **Step 3: 添加 GeneratePromptsRequest Schema**

```python
class GeneratePromptsRequest(BaseModel):
    storyboardIds: Optional[List[str]] = None
```

- [ ] **Step 4: 添加 GeneratePromptsResponse Schema**

```python
class GeneratePromptsResponse(BaseModel):
    success: bool
    updated: int
```

- [ ] **Step 5: 验证导入**

确保 `Optional` 和 `List` 已从 `typing` 导入

- [ ] **Step 6: 提交**

```bash
git add backend/models/schemas.py
git commit -m "feat: add schemas for storyboard optimization"
```

---

### Task 2: 修改后端 split_storyboard API，支持按行分割

**Files:**
- Modify: `backend/api/generation.py`

- [ ] **Step 1: 导入新的 Schema**

在顶部导入部分添加：

```python
from models.schemas import (
    Project, GenerateImagesRequest, GenerateAudiosRequest,
    GenerationStatus, GenerationStatusResponse,
    SplitStoryboardRequest, GeneratePromptsRequest, GeneratePromptsResponse
)
```

- [ ] **Step 2: 修改 split_storyboard 端点**

将 `split_storyboard` 函数修改为：

```python
@router.post("/projects/{project_id}/storyboards/split")
async def split_storyboard(project_id: str, request: SplitStoryboardRequest):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.sourceText or not project.sourceText.strip():
        raise HTTPException(status_code=400, detail="No source text available")

    # 按行分割文本
    lines = project.sourceText.split('\n')
    current_lines = []
    current_index = len(project.storyboards)

    from models.schemas import Storyboard

    for line in lines:
        line = line.strip()
        if not line:
            continue  # 跳过空行

        current_lines.append(line)

        if len(current_lines) >= request.lines_per_storyboard:
            # 凑够指定行数，创建分镜
            storyboard = Storyboard(
                index=current_index,
                sceneDescription="\n".join(current_lines),
                dialogue="",
                narration="",
                characterIds=[]
            )
            project.storyboards.append(storyboard)
            current_lines = []
            current_index += 1

    # 处理剩余的行
    if current_lines:
        storyboard = Storyboard(
            index=current_index,
            sceneDescription="\n".join(current_lines),
            dialogue="",
            narration="",
            characterIds=[]
        )
        project.storyboards.append(storyboard)

    project.generationProgress.imagesTotal = len(project.storyboards)
    project.generationProgress.audioTotal = len(project.storyboards)
    storage.save_project(project)

    # 自动批量生成提示词
    await _generate_prompts_for_project(project)

    return {"storyboards": project.storyboards}
```

- [ ] **Step 3: 添加辅助函数 _generate_prompts_for_project**

在 `split_storyboard` 函数后面添加：

```python
async def _generate_prompts_for_project(project: Project):
    """为项目的所有分镜生成画图提示词"""
    try:
        settings_obj = storage.load_global_settings()
        llm_client = LLMClient(settings_obj)
        char_dicts = [c.model_dump() for c in project.characters]

        for sb in project.storyboards:
            if not sb.imagePrompt:
                try:
                    sb.imagePrompt = await llm_client.generate_image_prompt(
                        sb.sceneDescription,
                        char_dicts,
                        project.stylePrompt,
                        project=project,
                        global_settings=settings_obj
                    )
                except Exception as e:
                    logger.error(f"Failed to generate prompt for storyboard {sb.id}: {e}")

        storage.save_project(project)
    except Exception as e:
        logger.error(f"Failed to generate prompts: {e}")
```

- [ ] **Step 4: 提交**

```bash
git add backend/api/generation.py
git commit -m "feat: modify split_storyboard to support line-based splitting"
```

---

### Task 3: 添加批量生成提示词 API

**Files:**
- Modify: `backend/api/generation.py`

- [ ] **Step 1: 添加新的端点**

在文件末尾添加：

```python
@router.post("/projects/{project_id}/storyboards/generate-prompts", response_model=GeneratePromptsResponse)
async def generate_storyboard_prompts(project_id: str, request: GeneratePromptsRequest):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    settings_obj = storage.load_global_settings()
    llm_client = LLMClient(settings_obj)
    char_dicts = [c.model_dump() for c in project.characters]

    target_sbs = project.storyboards
    if request.storyboardIds:
        target_sbs = [sb for sb in project.storyboards if sb.id in request.storyboardIds]

    updated_count = 0
    for sb in target_sbs:
        try:
            sb.imagePrompt = await llm_client.generate_image_prompt(
                sb.sceneDescription,
                char_dicts,
                project.stylePrompt,
                project=project,
                global_settings=settings_obj
            )
            updated_count += 1
        except Exception as e:
            logger.error(f"Failed to generate prompt for storyboard {sb.id}: {e}")

    storage.save_project(project)
    return GeneratePromptsResponse(success=True, updated=updated_count)
```

- [ ] **Step 2: 提交**

```bash
git add backend/api/generation.py
git commit -m "feat: add batch generate prompts API"
```

---

### Task 4: 更新前端 API 类型定义

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: 读取当前 api.ts 文件**

- [ ] **Step 2: 添加新的接口类型**

在合适位置添加：

```typescript
export interface SplitStoryboardRequest {
  lines_per_storyboard: number;
}

export interface GeneratePromptsRequest {
  storyboardIds?: string[];
}

export interface GeneratePromptsResponse {
  success: boolean;
  updated: number;
}
```

- [ ] **Step 3: 更新 storyboardApi**

修改 `storyboardApi` 对象，添加新方法：

```typescript
export const storyboardApi = {
  split: (projectId: string, linesPerStoryboard?: number) =>
    api.post(`/projects/${projectId}/storyboards/split`, {
      lines_per_storyboard: linesPerStoryboard || 1
    }),
  list: (projectId: string) =>
    api.get<Storyboard[]>(`/projects/${projectId}/storyboards`),
  update: (projectId: string, sbId: string, data: Partial<Storyboard>) =>
    api.put<Storyboard>(`/projects/${projectId}/storyboards/${sbId}`, data),
  delete: (projectId: string, sbId: string) =>
    api.delete(`/projects/${projectId}/storyboards/${sbId}`),
  reorder: (projectId: string, storyboardIds: string[]) =>
    api.put(`/projects/${projectId}/storyboards/reorder`, { storyboardIds }),
  generatePrompts: (projectId: string, storyboardIds?: string[]) =>
    api.post<GeneratePromptsResponse>(`/projects/${projectId}/storyboards/generate-prompts`, {
      storyboardIds
    }),
};
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: update frontend API types for storyboard optimization"
```

---

### Task 5: 更新前端 ProjectEditor - 添加行数选择器

**Files:**
- Modify: `frontend/src/pages/ProjectEditor.tsx`

- [ ] **Step 1: 读取当前 ProjectEditor.tsx 文件**

- [ ] **Step 2: 添加状态管理**

在 `useState` 部分添加：

```typescript
const [linesPerStoryboard, setLinesPerStoryboard] = useState(1);
```

- [ ] **Step 3: 修改导入**

确保导入了新的类型（如果需要）：

```typescript
import {
  projectApi,
  characterApi,
  storyboardApi,
  generationApi,
  promptApi,
  type Project,
  type PromptTemplate,
  type PromptType,
} from '../services/api';
```

- [ ] **Step 4: 修改 handleSplitStoryboard 函数**

修改 `handleSplitStoryboard` 函数：

```typescript
const handleSplitStoryboard = async () => {
  if (!id) return;
  try {
    await storyboardApi.split(id, linesPerStoryboard);
    await loadProject();
  } catch (error) {
    console.error('Failed to split storyboard:', error);
  }
};
```

- [ ] **Step 5: 修改分镜拆分部分的 UI**

找到 `currentStep === 1` 的部分，修改"自动拆分剧本"按钮区域：

```typescript
<div className="flex justify-between items-center mb-4">
  <h3 className="text-lg font-semibold">分镜列表 ({project.storyboards.length})</h3>
  <div className="flex items-center gap-2">
    <select
      value={linesPerStoryboard}
      onChange={(e) => setLinesPerStoryboard(parseInt(e.target.value))}
      className="border rounded-md px-3 py-2 text-sm"
    >
      <option value={1}>1行/分镜</option>
      <option value={2}>2行/分镜</option>
      <option value={3}>3行/分镜</option>
    </select>
    <button
      onClick={handleSplitStoryboard}
      className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
    >
      自动拆分剧本
    </button>
  </div>
</div>
```

- [ ] **Step 6: 提交**

```bash
git add frontend/src/pages/ProjectEditor.tsx
git commit -m "feat: add lines per storyboard selector"
```

---

### Task 6: 更新前端 ProjectEditor - 添加提示词编辑功能

**Files:**
- Modify: `frontend/src/pages/ProjectEditor.tsx`

- [ ] **Step 1: 添加状态管理**

在 `useState` 部分添加：

```typescript
const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
const [editingPrompt, setEditingPrompt] = useState<{ [key: string]: string }>({});
const [savingPrompt, setSavingPrompt] = useState<string | null>(null);
```

- [ ] **Step 2: 添加处理函数**

在其他处理函数附近添加：

```typescript
const handlePromptChange = (storyboardId: string, value: string) => {
  setEditingPrompt(prev => ({ ...prev, [storyboardId]: value }));
};

const handlePromptSave = async (storyboardId: string) => {
  if (!id) return;
  const newValue = editingPrompt[storyboardId];
  if (newValue === undefined) return;

  setSavingPrompt(storyboardId);
  try {
    await storyboardApi.update(id, storyboardId, { imagePrompt: newValue });
    await loadProject();
  } catch (error) {
    console.error('Failed to save prompt:', error);
  } finally {
    setSavingPrompt(null);
    setEditingPrompt(prev => {
      const next = { ...prev };
      delete next[storyboardId];
      return next;
    });
  }
};
```

- [ ] **Step 3: 修改分镜卡片 UI**

在 `currentStep === 1` 的分镜列表中，每个分镜卡片添加提示词编辑区域。找到分镜卡片的代码，在末尾（闭合 `</div>` 之前）添加：

```typescript
<div className="mt-3 pt-3 border-t">
  <div className="flex justify-between items-center mb-2">
    <label className="text-sm font-medium text-gray-700">画图提示词</label>
    <div className="flex items-center gap-2">
      {savingPrompt === sb.id && (
        <span className="text-xs text-gray-400">保存中...</span>
      )}
      <button
        onClick={() => setExpandedPrompt(
          expandedPrompt === sb.id ? null : sb.id
        )}
        className="text-xs text-blue-500 hover:text-blue-600"
      >
        {expandedPrompt === sb.id ? '收起' : '展开'}
      </button>
    </div>
  </div>
  {expandedPrompt === sb.id && (
    <textarea
      value={editingPrompt[sb.id] ?? sb.imagePrompt ?? ''}
      onChange={(e) => handlePromptChange(sb.id, e.target.value)}
      onBlur={() => handlePromptSave(sb.id)}
      placeholder="AI 生成的画图提示词将显示在这里..."
      className="w-full border rounded-md px-3 py-2 text-sm font-mono disabled:opacity-50"
      rows={4}
      disabled={savingPrompt === sb.id}
    />
  )}
  {!expandedPrompt === sb.id && sb.imagePrompt && (
    <p className="text-xs text-gray-500 truncate">{sb.imagePrompt}</p>
  )}
</div>
```

注意：修复显示逻辑，确保未展开时也能看到提示词预览：

```typescript
{expandedPrompt === sb.id ? (
  <textarea
    value={editingPrompt[sb.id] ?? sb.imagePrompt ?? ''}
    onChange={(e) => handlePromptChange(sb.id, e.target.value)}
    onBlur={() => handlePromptSave(sb.id)}
    placeholder="AI 生成的画图提示词将显示在这里..."
    className="w-full border rounded-md px-3 py-2 text-sm font-mono disabled:opacity-50"
    rows={4}
    disabled={savingPrompt === sb.id}
  />
) : (
  sb.imagePrompt && (
    <p className="text-xs text-gray-500 truncate">{sb.imagePrompt}</p>
  )
)}
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/pages/ProjectEditor.tsx
git commit -m "feat: add editable image prompt field to storyboards"
```

---

### Task 7: 端到端测试

**Files:**
- 手动测试

- [ ] **Step 1: 启动后端服务**

```bash
cd backend
python -m uvicorn main:app --reload
```

- [ ] **Step 2: 启动前端服务**

```bash
cd frontend
npm run dev
```

- [ ] **Step 3: 创建测试项目**

在前端创建新项目，输入测试文本（每行一个句子，有空行）

- [ ] **Step 4: 测试按行拆分**

选择不同行数（1/2/3），点击拆分，验证分镜正确生成

- [ ] **Step 5: 验证提示词生成**

检查分镜是否有 imagePrompt 生成

- [ ] **Step 6: 测试提示词编辑**

展开提示词编辑框，修改提示词，失焦后验证保存成功

- [ ] **Step 7: 测试图片生成**

点击批量生成图片，验证使用的是修改后的提示词

---

## 总结

本计划包含 7 个任务：
1. 修改后端 Schema
2. 修改分镜拆分 API 支持按行分割
3. 添加批量生成提示词 API
4. 更新前端 API 类型
5. 添加行数选择器
6. 添加提示词编辑功能
7. 端到端测试

所有改动完成后，功能应该可以正常使用。
