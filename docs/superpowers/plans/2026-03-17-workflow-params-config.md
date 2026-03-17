# ComfyUI 工作流参数配置实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每个 ComfyUI 工作流添加独立的默认参数配置功能，支持在前端网页配置常用参数（宽度、高度、CFG、Steps、Seed、Sampler、Batch Size）以及正向提示词前缀/后缀。

**Architecture:**
- 后端：在 ComfyUIWorkflow 模型中添加 defaultParams 字段，修改 comfyui.py 中的参数应用逻辑
- 前端：添加参数配置 UI，更新类型定义和 API 调用
- 参数应用：优先使用工作流配置的参数，samplerName=None 时保留工作流原值

**Tech Stack:** FastAPI, Pydantic, React, TypeScript, Tailwind CSS

---

## Task 1: 更新后端数据模型

**Files:**
- Modify: `backend/models/schemas.py`

**Goal:** 添加 ComfyUIWorkflowParams 模型，更新相关模型。

- [ ] **Step 1: 添加 ComfyUIWorkflowParams 模型**

在 `ComfyUINodeMappings` 类之后添加：

```python
class ComfyUIWorkflowParams(BaseModel):
    """工作流默认参数配置"""
    # 尺寸参数
    width: int = 1280
    height: int = 960

    # 采样参数
    steps: int = 30
    cfg: float = 7.0
    samplerName: Optional[str] = None  # None = 使用工作流原值
    seed: int = 0  # 0 = 随机

    # 批次参数
    batchSize: int = 1

    # 提示词参数
    positivePromptPrefix: str = ""
    positivePromptSuffix: str = ""
    negativePromptOverride: Optional[str] = None  # None = 不覆盖
```

- [ ] **Step 2: 更新 ComfyUIWorkflow 模型**

在 `ComfyUIWorkflow` 类中添加 `defaultParams` 字段：

```python
class ComfyUIWorkflow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    workflowJson: Dict[str, Any]
    nodeMappings: ComfyUINodeMappings = Field(default_factory=ComfyUINodeMappings)
    defaultParams: ComfyUIWorkflowParams = Field(default_factory=ComfyUIWorkflowParams)
    createdAt: datetime = Field(default_factory=datetime.now)
```

- [ ] **Step 3: 更新 UpdateComfyUIWorkflowRequest 模型**

在 `UpdateComfyUIWorkflowRequest` 类中添加 `defaultParams` 字段：

```python
class UpdateComfyUIWorkflowRequest(BaseModel):
    name: Optional[str] = None
    nodeMappings: Optional[ComfyUINodeMappings] = None
    defaultParams: Optional[ComfyUIWorkflowParams] = None
```

- [ ] **Step 4: 验证代码语法正确**

确保导入了所有需要的类型（Optional 已在文件顶部导入）。

- [ ] **Step 5: 提交**

```bash
git add backend/models/schemas.py
git commit -m "feat: add ComfyUIWorkflowParams model"
```

---

## Task 2: 更新后端 comfyui.py 参数应用逻辑

**Files:**
- Modify: `backend/core/comfyui.py`

**Goal:** 修改 `_apply_workflow_mappings` 方法，支持从工作流参数读取配置并应用。

- [ ] **Step 1: 修改 _apply_workflow_mappings 方法签名**

添加 `params: Optional[ComfyUIWorkflowParams] = None` 参数：

```python
def _apply_workflow_mappings(
    self,
    workflow: Dict[str, Any],
    mappings: ComfyUINodeMappings,
    prompt: str,
    negative_prompt: str = "",
    width: int = 1024,
    height: int = 1024,
    steps: int = 30,
    cfg: float = 7.0,
    sampler_name: str = "dpmpp_2m_sde_karras",
    seed: int = 0,
    batch_size: int = 1,
    params: Optional[ComfyUIWorkflowParams] = None
) -> Dict[str, Any]:
```

- [ ] **Step 2: 添加参数应用逻辑**

在 `workflow_copy = deepcopy(workflow)` 之后添加：

```python
    # Apply workflow default parameters if available
    if params:
        width = params.width
        height = params.height
        steps = params.steps
        cfg = params.cfg
        if params.samplerName is not None:
            sampler_name = params.samplerName
        seed = params.seed
        batch_size = params.batchSize

        # Apply prompt prefix/suffix
        prompt = f"{params.positivePromptPrefix}{prompt}{params.positivePromptSuffix}"

        # Apply negative prompt override if set
        if params.negativePromptOverride is not None:
            negative_prompt = params.negativePromptOverride
```

- [ ] **Step 3: 修改 generate_image 方法传递参数**

在 `generate_image` 方法中，调用 `_apply_workflow_mappings` 时传递 `params=workflow.defaultParams`：

```python
    workflow_json = self._apply_workflow_mappings(
        workflow=workflow.workflowJson,
        mappings=workflow.nodeMappings,
        prompt=prompt,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
        steps=steps,
        cfg=cfg,
        sampler_name=sampler_name,
        seed=0,
        batch_size=1,
        params=workflow.defaultParams
    )
```

注意：移除对采样器、steps、cfg、seed 的覆盖逻辑（在 Task 1 中已经移除）。

- [ ] **Step 4: 验证导入**

确保导入了 `ComfyUIWorkflowParams`（在文件顶部已导入）。

- [ ] **Step 5: 提交**

```bash
git add backend/core/comfyui.py
git commit -m "feat: apply workflow default params in comfyui client"
```

---

## Task 3: 更新后端 API 端点

**Files:**
- Modify: `backend/api/comfyui_workflows.py`

**Goal:** 更新 update_workflow 端点，支持保存 defaultParams。

- [ ] **Step 1: 更新 update_workflow 端点**

在 `update_workflow` 函数中，添加对 `defaultParams` 的处理：

```python
@router.put("/workflows/{workflow_id}", response_model=ComfyUIWorkflow)
async def update_workflow(workflow_id: str, request: UpdateComfyUIWorkflowRequest):
    workflow = storage.get_comfyui_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if request.name is not None:
        workflow.name = request.name
    if request.nodeMappings is not None:
        workflow.nodeMappings = request.nodeMappings
    if request.defaultParams is not None:
        workflow.defaultParams = request.defaultParams

    storage.save_comfyui_workflow(workflow)
    return workflow
```

- [ ] **Step 2: 提交**

```bash
git add backend/api/comfyui_workflows.py
git commit -m "feat: support updating workflow default params"
```

---

## Task 4: 更新前端类型定义

**Files:**
- Modify: `frontend/src/services/api.ts`

**Goal:** 添加 TypeScript 类型定义。

- [ ] **Step 1: 添加 ComfyUIWorkflowParams 接口**

在 `ComfyUINodeMappings` 接口之后添加：

```typescript
export interface ComfyUIWorkflowParams {
  width: number;
  height: number;
  steps: number;
  cfg: number;
  samplerName?: string | null;
  seed: number;
  batchSize: number;
  positivePromptPrefix: string;
  positivePromptSuffix: string;
  negativePromptOverride?: string | null;
}
```

- [ ] **Step 2: 更新 ComfyUIWorkflow 接口**

在 `ComfyUIWorkflow` 接口中添加 `defaultParams` 字段：

```typescript
export interface ComfyUIWorkflow {
  id: string;
  name: string;
  workflowJson: Record<string, any>;
  nodeMappings: ComfyUINodeMappings;
  defaultParams: ComfyUIWorkflowParams;
  createdAt: string;
}
```

- [ ] **Step 3: 更新 comfyuiWorkflowApi.update 方法**

在 `comfyuiWorkflowApi` 中，更新 `update` 方法的类型：

```typescript
  update: (id: string, data: { name?: string; nodeMappings?: Partial<ComfyUINodeMappings>; defaultParams?: Partial<ComfyUIWorkflowParams> }) =>
    api.put<ComfyUIWorkflow>(`/comfyui/workflows/${id}`, data),
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add workflow params typescript definitions"
```

---

## Task 5: 更新前端 Settings UI - 添加默认参数配置

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

**Goal:** 在编辑工作流模态框中添加默认参数配置区域。

- [ ] **Step 1: 添加 defaultParams state**

在 `Settings` 组件中，添加 `defaultParams` state：

```typescript
  const [defaultParams, setDefaultParams] = useState<ComfyUIWorkflowParams>({
    width: 1280,
    height: 960,
    steps: 30,
    cfg: 7.0,
    samplerName: null,
    seed: 0,
    batchSize: 1,
    positivePromptPrefix: '',
    positivePromptSuffix: '',
    negativePromptOverride: null,
  });
```

- [ ] **Step 2: 更新 handleEditWorkflow**

在 `handleEditWorkflow` 函数中，初始化 `defaultParams`：

```typescript
  const handleEditWorkflow = (workflow: ComfyUIWorkflow) => {
    setEditingWorkflow(workflow);
    setWorkflowName(workflow.name);
    setNodeMappings(workflow.nodeMappings);
    setDefaultParams(workflow.defaultParams || {
      width: 1280,
      height: 960,
      steps: 30,
      cfg: 7.0,
      samplerName: null,
      seed: 0,
      batchSize: 1,
      positivePromptPrefix: '',
      positivePromptSuffix: '',
      negativePromptOverride: null,
    });
    parseAndSetNodes(workflow);
    setShowUploadModal(true);
  };
```

- [ ] **Step 3: 更新 resetUploadForm**

在 `resetUploadForm` 函数中，重置 `defaultParams`：

```typescript
  const resetUploadForm = () => {
    setEditingWorkflow(null);
    setWorkflowName('');
    setWorkflowFile(null);
    setWorkflowJson(null);
    setParsedNodes([]);
    setNodeMappings({
      positivePromptField: 'text',
      negativePromptField: 'text',
      widthField: 'width',
      heightField: 'height',
      samplerField: 'sampler_name',
      stepsField: 'steps',
      cfgField: 'cfg',
      seedField: 'seed',
      batchSizeField: 'batch_size',
    });
    setDefaultParams({
      width: 1280,
      height: 960,
      steps: 30,
      cfg: 7.0,
      samplerName: null,
      seed: 0,
      batchSize: 1,
      positivePromptPrefix: '',
      positivePromptSuffix: '',
      negativePromptOverride: null,
    });
  };
```

- [ ] **Step 4: 更新 handleSaveWorkflow**

在 `handleSaveWorkflow` 函数中，传递 `defaultParams`：

```typescript
  const handleSaveWorkflow = async () => {
    try {
      if (editingWorkflow) {
        await comfyuiWorkflowApi.update(editingWorkflow.id, {
          name: workflowName,
          nodeMappings,
          defaultParams,
        });
      } else if (workflowJson) {
        const newWorkflow = await comfyuiWorkflowApi.create(workflowName || '未命名工作流', workflowJson);
        await comfyuiWorkflowApi.update(newWorkflow.data.id, { nodeMappings, defaultParams });
        await parseAndSetNodes(newWorkflow.data);
      }
      await loadWorkflows();
      setShowUploadModal(false);
      resetUploadForm();
    } catch (error) {
      console.error('Failed to save workflow:', error);
      alert('保存工作流失败');
    }
  };
```

- [ ] **Step 5: 添加默认参数配置 UI**

在节点映射配置区域（`{parsedNodes.length > 0 && (...)}`）之后，添加默认参数配置区域：

```tsx
            <div className="space-y-4 border-t pt-4 mt-4">
              <h4 className="font-medium">默认参数配置</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">宽度</label>
                  <input
                    type="number"
                    value={defaultParams.width}
                    onChange={(e) => setDefaultParams({ ...defaultParams, width: parseInt(e.target.value) || 1280 })}
                    className="w-full border rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">高度</label>
                  <input
                    type="number"
                    value={defaultParams.height}
                    onChange={(e) => setDefaultParams({ ...defaultParams, height: parseInt(e.target.value) || 960 })}
                    className="w-full border rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Steps</label>
                  <input
                    type="number"
                    value={defaultParams.steps}
                    onChange={(e) => setDefaultParams({ ...defaultParams, steps: parseInt(e.target.value) || 30 })}
                    className="w-full border rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CFG</label>
                  <input
                    type="number"
                    step="0.1"
                    value={defaultParams.cfg}
                    onChange={(e) => setDefaultParams({ ...defaultParams, cfg: parseFloat(e.target.value) || 7.0 })}
                    className="w-full border rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch Size</label>
                  <input
                    type="number"
                    value={defaultParams.batchSize}
                    onChange={(e) => setDefaultParams({ ...defaultParams, batchSize: parseInt(e.target.value) || 1 })}
                    className="w-full border rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sampler</label>
                  <select
                    value={defaultParams.samplerName || ''}
                    onChange={(e) => setDefaultParams({ ...defaultParams, samplerName: e.target.value || null })}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="">使用工作流默认</option>
                    <option value="euler">euler</option>
                    <option value="euler_a">euler_a</option>
                    <option value="dpmpp_2m_sde_karras">dpmpp_2m_sde_karras</option>
                    <option value="dpmpp_sde_karras">dpmpp_sde_karras</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seed <span className="text-gray-400">(0=随机)</span></label>
                  <input
                    type="number"
                    value={defaultParams.seed}
                    onChange={(e) => setDefaultParams({ ...defaultParams, seed: parseInt(e.target.value) || 0 })}
                    className="w-full border rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">正向提示词前缀</label>
                <input
                  type="text"
                  value={defaultParams.positivePromptPrefix}
                  onChange={(e) => setDefaultParams({ ...defaultParams, positivePromptPrefix: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="例如: masterpiece, best quality, "
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">正向提示词后缀</label>
                <input
                  type="text"
                  value={defaultParams.positivePromptSuffix}
                  onChange={(e) => setDefaultParams({ ...defaultParams, positivePromptSuffix: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="例如: , cinematic lighting"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">否定提示词覆盖 <span className="text-gray-400">(留空表示不覆盖)</span></label>
                <input
                  type="text"
                  value={defaultParams.negativePromptOverride || ''}
                  onChange={(e) => setDefaultParams({ ...defaultParams, negativePromptOverride: e.target.value || null })}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="例如: bad anatomy, bad hands"
                />
              </div>
            </div>
```

- [ ] **Step 6: 确保导入了 ComfyUIWorkflowParams**

在文件顶部的导入中，确保包含了 `ComfyUIWorkflowParams`：

```typescript
import { settingsApi, comfyuiWorkflowApi, type GlobalSettings, type ComfyUIWorkflow, type ComfyUINodeInfo, type ComfyUINodeMappings, type ComfyUIWorkflowParams } from '../services/api';
```

- [ ] **Step 7: 提交**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat: add workflow default params config UI"
```

---

## Task 6: 验证功能

**Goal:** 验证整个功能正常工作。

- [ ] **Step 1: 重启后端服务**

确保后端重新加载了代码。

- [ ] **Step 2: 重启前端服务**

确保前端重新加载了代码。

- [ ] **Step 3: 测试编辑工作流**

1. 打开设置页面
2. 点击编辑现有工作流
3. 确认能看到"默认参数配置"区域
4. 修改一些参数（如宽度改为 1024，高度改为 1024）
5. 添加正向提示词前缀，如 "masterpiece, best quality, "
6. 点击保存

- [ ] **Step 4: 测试生成图片**

1. 去项目页面
2. 点击生成图片
3. 确认参数正确应用到 ComfyUI

---

## 总结

所有任务完成后，功能应该可以正常使用：
- 用户可以在前端为每个工作流配置独立的默认参数
- 正向提示词会自动添加前缀和后缀
- 配置的参数会覆盖工作流中的默认值（除了 samplerName=null 时保留原值）
