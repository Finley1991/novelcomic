# ComfyUI 自定义工作流 - 实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 ComfyUI 自定义工作流支持，允许用户上传自己的工作流并通过可视化界面配置节点映射

**Architecture:** 扩展现有数据模型，新增工作流管理 API，重构 ComfyUIClient 使用工作流而非硬编码，在前端添加上传和配置 UI

**Tech Stack:** FastAPI, Pydantic, React, TypeScript, Tailwind CSS

---

## 文件结构预览

**新增文件:**
- `backend/api/comfyui_workflows.py` - 工作流管理 API 路由
- `docs/superpowers/plans/2026-03-17-comfyui-workflows.md` - 本计划文件

**修改文件:**
- `backend/models/schemas.py` - 添加工作流相关数据模型
- `backend/core/storage.py` - 添加工作流存储方法
- `backend/core/comfyui.py` - 重构，移除硬编码工作流
- `backend/main.py` - 注册工作流路由
- `frontend/src/services/api.ts` - 添加工作流 API 类型和方法
- `frontend/src/pages/Settings.tsx` - 添加工作流管理 UI

---

## 任务 1: 后端数据模型

**Files:**
- Modify: `backend/models/schemas.py`

### 步骤

- [ ] **Step 1.1: 添加 ComfyUINodeMappings 模型**

在 `schemas.py` 末尾（Response schemas 之前）添加：

```python
class ComfyUINodeMappings(BaseModel):
    # 提示词相关
    positivePromptNodeId: Optional[str] = None
    positivePromptField: str = "text"

    negativePromptNodeId: Optional[str] = None
    negativePromptField: str = "text"

    # 尺寸相关
    widthNodeId: Optional[str] = None
    widthField: str = "width"

    heightNodeId: Optional[str] = None
    heightField: str = "height"

    # 采样相关
    samplerNodeId: Optional[str] = None
    samplerField: str = "sampler_name"
    stepsField: str = "steps"
    cfgField: str = "cfg"
    seedField: str = "seed"

    # 批次相关
    batchNodeId: Optional[str] = None
    batchSizeField: str = "batch_size"

class ComfyUIWorkflow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    workflowJson: Dict[str, Any]
    nodeMappings: ComfyUINodeMappings = Field(default_factory=ComfyUINodeMappings)
    createdAt: datetime = Field(default_factory=datetime.now)

class ComfyUINodeInfo(BaseModel):
    id: str
    classType: str
    title: Optional[str]
    fields: List[str]
```

- [ ] **Step 1.2: 更新 ComfyUISettings 模型**

找到 `ComfyUISettings` 类，添加 `activeWorkflowId` 字段：

```python
class ComfyUISettings(BaseModel):
    apiUrl: str = "http://8.222.174.34:8188"
    timeout: int = 300
    maxRetries: int = 3
    concurrentLimit: int = 3
    activeWorkflowId: Optional[str] = None  # 新增
```

- [ ] **Step 1.3: 添加请求/响应模型**

在文件末尾的 Request schemas 部分添加：

```python
class CreateComfyUIWorkflowRequest(BaseModel):
    name: str
    workflowJson: Dict[str, Any]

class UpdateComfyUIWorkflowRequest(BaseModel):
    name: Optional[str] = None
    nodeMappings: Optional[ComfyUINodeMappings] = None

class SetActiveWorkflowRequest(BaseModel):
    workflowId: str
```

- [ ] **Step 1.4: 验证修改**

检查导入语句，确保有所有需要的导入（`Optional`, `Dict`, `Any`, `List` 应该已经有了）。

- [ ] **Step 1.5: Commit**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add backend/models/schemas.py
git commit -m "Add ComfyUI workflow data models"
```

---

## 任务 2: 后端存储层

**Files:**
- Modify: `backend/core/storage.py`

### 步骤

- [ ] **Step 2.1: 查看当前 storage.py 结构**

先读取文件确认当前结构。

- [ ] **Step 2.2: 添加导入**

在文件顶部的导入区域添加：

```python
from models.schemas import ComfyUIWorkflow
```

- [ ] **Step 2.3: 添加工作流存储方法**

在 `Storage` 类的末尾（`get_settings` 和 `save_settings` 之后）添加：

```python
    def _get_workflows_dir(self) -> Path:
        dir_path = self.data_dir / "comfyui_workflows"
        dir_path.mkdir(parents=True, exist_ok=True)
        return dir_path

    def list_comfyui_workflows(self) -> List[ComfyUIWorkflow]:
        workflows = []
        workflows_dir = self._get_workflows_dir()
        for file_path in workflows_dir.glob("*.json"):
            try:
                data = json.loads(file_path.read_text(encoding="utf-8"))
                workflows.append(ComfyUIWorkflow(**data))
            except Exception as e:
                logger.error(f"Failed to load workflow {file_path}: {e}")
        workflows.sort(key=lambda w: w.createdAt, reverse=True)
        return workflows

    def get_comfyui_workflow(self, workflow_id: str) -> Optional[ComfyUIWorkflow]:
        file_path = self._get_workflows_dir() / f"{workflow_id}.json"
        if not file_path.exists():
            return None
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
            return ComfyUIWorkflow(**data)
        except Exception as e:
            logger.error(f"Failed to load workflow {workflow_id}: {e}")
            return None

    def save_comfyui_workflow(self, workflow: ComfyUIWorkflow) -> None:
        file_path = self._get_workflows_dir() / f"{workflow.id}.json"
        file_path.write_text(workflow.model_dump_json(indent=2), encoding="utf-8")

    def delete_comfyui_workflow(self, workflow_id: str) -> bool:
        file_path = self._get_workflows_dir() / f"{workflow_id}.json"
        if file_path.exists():
            file_path.unlink()
            return True
        return False
```

- [ ] **Step 2.4: Commit**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add backend/core/storage.py
git commit -m "Add ComfyUI workflow storage methods"
```

---

## 任务 3: 工作流 API 路由

**Files:**
- Create: `backend/api/comfyui_workflows.py`
- Modify: `backend/main.py`

### 步骤

- [ ] **Step 3.1: 创建 comfyui_workflows.py**

```python
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import logging

from models.schemas import (
    ComfyUIWorkflow,
    ComfyUINodeInfo,
    ComfyUINodeMappings,
    CreateComfyUIWorkflowRequest,
    UpdateComfyUIWorkflowRequest,
    SetActiveWorkflowRequest,
    GlobalSettings
)
from core.storage import storage

logger = logging.getLogger(__name__)
router = APIRouter()


def _parse_workflow_nodes(workflow_json: Dict[str, Any]) -> List[ComfyUINodeInfo]:
    nodes = []
    for node_id, node_data in workflow_json.items():
        class_type = node_data.get("class_type", "")
        inputs = node_data.get("inputs", {})

        title = None
        if "_meta" in node_data and "title" in node_data["_meta"]:
            title = node_data["_meta"]["title"]
        elif "title" in node_data:
            title = node_data["title"]

        fields = []
        for key, value in inputs.items():
            if not isinstance(value, list):
                fields.append(key)

        nodes.append(ComfyUINodeInfo(
            id=node_id,
            classType=class_type,
            title=title,
            fields=fields
        ))

    return nodes


@router.get("/workflows", response_model=List[ComfyUIWorkflow])
async def list_workflows():
    return storage.list_comfyui_workflows()


@router.post("/workflows", response_model=ComfyUIWorkflow)
async def create_workflow(request: CreateComfyUIWorkflowRequest):
    workflow = ComfyUIWorkflow(
        name=request.name,
        workflowJson=request.workflowJson
    )
    storage.save_comfyui_workflow(workflow)
    return workflow


@router.get("/workflows/{workflow_id}", response_model=ComfyUIWorkflow)
async def get_workflow(workflow_id: str):
    workflow = storage.get_comfyui_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@router.put("/workflows/{workflow_id}", response_model=ComfyUIWorkflow)
async def update_workflow(workflow_id: str, request: UpdateComfyUIWorkflowRequest):
    workflow = storage.get_comfyui_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if request.name is not None:
        workflow.name = request.name
    if request.nodeMappings is not None:
        workflow.nodeMappings = request.nodeMappings

    storage.save_comfyui_workflow(workflow)
    return workflow


@router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str):
    success = storage.delete_comfyui_workflow(workflow_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workflow not found")

    settings = storage.get_settings()
    if settings.comfyui.activeWorkflowId == workflow_id:
        settings.comfyui.activeWorkflowId = None
        storage.save_settings(settings)

    return {"success": True}


@router.post("/workflows/{workflow_id}/parse")
async def parse_workflow(workflow_id: str):
    workflow = storage.get_comfyui_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    nodes = _parse_workflow_nodes(workflow.workflowJson)
    return {"nodes": nodes}


@router.put("/active-workflow", response_model=GlobalSettings)
async def set_active_workflow(request: SetActiveWorkflowRequest):
    if request.workflowId:
        workflow = storage.get_comfyui_workflow(request.workflowId)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

    settings = storage.get_settings()
    settings.comfyui.activeWorkflowId = request.workflowId
    storage.save_settings(settings)
    return settings
```

- [ ] **Step 3.2: 修改 main.py 注册路由**

在 `main.py` 中添加：

```python
from api import comfyui_workflows
```

然后在 `app.include_router()` 部分添加：

```python
app.include_router(comfyui_workflows.router, prefix="/api/comfyui", tags=["comfyui"])
```

- [ ] **Step 3.3: Commit**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add backend/api/comfyui_workflows.py backend/main.py
git commit -m "Add ComfyUI workflow API endpoints"
```

---

## 任务 4: 重构 ComfyUIClient

**Files:**
- Modify: `backend/core/comfyui.py`

### 步骤

- [ ] **Step 4.1: 添加导入**

在文件顶部添加：

```python
from copy import deepcopy
from models.schemas import ComfyUINodeMappings
```

- [ ] **Step 4.2: 添加 _apply_workflow_mappings 方法**

在 `ComfyUIClient` 类中，在 `_get_image` 方法之后添加：

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
        batch_size: int = 1
    ) -> Dict[str, Any]:
        workflow_copy = deepcopy(workflow)

        if mappings.positivePromptNodeId:
            node = workflow_copy.get(mappings.positivePromptNodeId, {})
            if "inputs" in node:
                node["inputs"][mappings.positivePromptField] = prompt

        if mappings.negativePromptNodeId:
            node = workflow_copy.get(mappings.negativePromptNodeId, {})
            if "inputs" in node:
                node["inputs"][mappings.negativePromptField] = negative_prompt or "bad anatomy, bad hands"

        if mappings.widthNodeId:
            node = workflow_copy.get(mappings.widthNodeId, {})
            if "inputs" in node:
                node["inputs"][mappings.widthField] = width

        if mappings.heightNodeId:
            node = workflow_copy.get(mappings.heightNodeId, {})
            if "inputs" in node:
                node["inputs"][mappings.heightField] = height

        if mappings.samplerNodeId:
            node = workflow_copy.get(mappings.samplerNodeId, {})
            if "inputs" in node:
                node["inputs"][mappings.samplerField] = sampler_name
                node["inputs"][mappings.stepsField] = steps
                node["inputs"][mappings.cfgField] = cfg
                node["inputs"][mappings.seedField] = seed

        if mappings.batchNodeId:
            node = workflow_copy.get(mappings.batchNodeId, {})
            if "inputs" in node:
                node["inputs"][mappings.batchSizeField] = batch_size

        return workflow_copy
```

- [ ] **Step 4.3: 修改 generate_image 方法**

替换 `generate_image` 方法：

```python
    async def generate_image(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 1024,
        height: int = 1024,
        steps: int = 30,
        cfg: float = 7.0,
        sampler_name: str = "dpmpp_2m_sde_karras",
        workflow_id: Optional[str] = None
    ) -> Optional[bytes]:
        from core.storage import storage

        if workflow_id:
            workflow = storage.get_comfyui_workflow(workflow_id)
        else:
            settings = storage.get_settings()
            if not settings.comfyui.activeWorkflowId:
                raise Exception("No active ComfyUI workflow. Please upload and activate a workflow in Settings.")
            workflow = storage.get_comfyui_workflow(settings.comfyui.activeWorkflowId)

        if not workflow:
            raise Exception("ComfyUI workflow not found")

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
            batch_size=1
        )

        prompt_id = await self._queue_prompt(workflow_json)
        logger.info(f"Queued ComfyUI prompt: {prompt_id}")

        max_wait = settings.comfyui_timeout if 'settings' in locals() else 300
        poll_interval = 2.0
        waited = 0.0

        while waited < max_wait:
            history = await self._get_history(prompt_id)
            if history and "outputs" in history:
                outputs = history["outputs"]
                for node_id, node_output in outputs.items():
                    if "images" in node_output and node_output["images"]:
                        img_info = node_output["images"][0]
                        img_data = await self._get_image(
                            img_info["filename"],
                            img_info.get("subfolder", ""),
                            img_info.get("type", "output")
                        )
                        if img_data:
                            return img_data

            await asyncio.sleep(poll_interval)
            waited += poll_interval

        raise Exception("Timeout waiting for ComfyUI generation")
```

- [ ] **Step 4.4: 删除 _build_text_to_image_workflow 方法**

删除整个 `_build_text_to_image_workflow()` 方法。

- [ ] **Step 4.5: Commit**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add backend/core/comfyui.py
git commit -m "Refactor ComfyUIClient to use custom workflows"
```

---

## 任务 5: 前端 API 类型和方法

**Files:**
- Modify: `frontend/src/services/api.ts`

### 步骤

- [ ] **Step 5.1: 添加类型定义**

在 `JianyingSettings` 接口之后添加：

```typescript
export interface ComfyUINodeInfo {
  id: string;
  classType: string;
  title?: string;
  fields: string[];
}

export interface ComfyUINodeMappings {
  positivePromptNodeId?: string;
  positivePromptField: string;
  negativePromptNodeId?: string;
  negativePromptField: string;
  widthNodeId?: string;
  widthField: string;
  heightNodeId?: string;
  heightField: string;
  samplerNodeId?: string;
  samplerField: string;
  stepsField: string;
  cfgField: string;
  seedField: string;
  batchNodeId?: string;
  batchSizeField: string;
}

export interface ComfyUIWorkflow {
  id: string;
  name: string;
  workflowJson: Record<string, any>;
  nodeMappings: ComfyUINodeMappings;
  createdAt: string;
}
```

同时更新 `ComfyUISettings` 接口：

```typescript
export interface ComfyUISettings {
  apiUrl: string;
  timeout: number;
  maxRetries: number;
  concurrentLimit: number;
  activeWorkflowId?: string;
}
```

- [ ] **Step 5.2: 添加 API 方法**

在文件末尾（`settingsApi` 之后）添加：

```typescript
export const comfyuiWorkflowApi = {
  list: () => api.get<ComfyUIWorkflow[]>('/comfyui/workflows'),
  create: (name: string, workflowJson: Record<string, any>) =>
    api.post<ComfyUIWorkflow>('/comfyui/workflows', { name, workflowJson }),
  get: (id: string) => api.get<ComfyUIWorkflow>(`/comfyui/workflows/${id}`),
  update: (id: string, data: { name?: string; nodeMappings?: Partial<ComfyUINodeMappings> }) =>
    api.put<ComfyUIWorkflow>(`/comfyui/workflows/${id}`, data),
  delete: (id: string) => api.delete(`/comfyui/workflows/${id}`),
  parse: (id: string) => api.post<{ nodes: ComfyUINodeInfo[] }>(`/comfyui/workflows/${id}/parse`),
  setActive: (workflowId: string) => api.put<GlobalSettings>('/comfyui/active-workflow', { workflowId }),
};
```

- [ ] **Step 5.3: Commit**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add frontend/src/services/api.ts
git commit -m "Add ComfyUI workflow API types and methods to frontend"
```

---

## 任务 6: 前端设置页面 - 工作流列表

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

### 步骤

- [ ] **Step 6.1: 添加导入**

在文件顶部添加：

```typescript
import { comfyuiWorkflowApi, type ComfyUIWorkflow, type ComfyUINodeInfo, type ComfyUINodeMappings } from '../services/api';
```

- [ ] **Step 6.2: 添加状态变量**

在 `Settings` 组件的 useState 区域添加：

```typescript
  const [workflows, setWorkflows] = useState<ComfyUIWorkflow[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<ComfyUIWorkflow | null>(null);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowFile, setWorkflowFile] = useState<File | null>(null);
  const [workflowJson, setWorkflowJson] = useState<Record<string, any> | null>(null);
  const [parsedNodes, setParsedNodes] = useState<ComfyUINodeInfo[]>([]);
  const [nodeMappings, setNodeMappings] = useState<ComfyUINodeMappings>({
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
```

- [ ] **Step 6.3: 添加加载工作流函数**

在 `loadSettings` 之后添加：

```typescript
  const loadWorkflows = async () => {
    try {
      const response = await comfyuiWorkflowApi.list();
      setWorkflows(response.data);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  };
```

并在 `useEffect` 中调用：

```typescript
  useEffect(() => {
    loadSettings();
    loadWorkflows();
  }, []);
```

- [ ] **Step 6.4: 添加工作流处理函数**

在 `handleTestLLM` 之后添加：

```typescript
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setWorkflowFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          setWorkflowJson(json);
        } catch (err) {
          alert('无效的 JSON 文件');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSetActive = async (workflowId: string) => {
    try {
      const response = await comfyuiWorkflowApi.setActive(workflowId);
      setSettings(response.data);
      await loadWorkflows();
    } catch (error) {
      console.error('Failed to set active workflow:', error);
      alert('设置激活工作流失败');
    }
  };

  const handleEditWorkflow = (workflow: ComfyUIWorkflow) => {
    setEditingWorkflow(workflow);
    setWorkflowName(workflow.name);
    setNodeMappings(workflow.nodeMappings);
    parseAndSetNodes(workflow);
    setShowUploadModal(true);
  };

  const parseAndSetNodes = async (workflow: ComfyUIWorkflow) => {
    try {
      const response = await comfyuiWorkflowApi.parse(workflow.id);
      setParsedNodes(response.data.nodes);
    } catch (error) {
      console.error('Failed to parse workflow:', error);
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm('确定要删除这个工作流吗？')) return;
    try {
      await comfyuiWorkflowApi.delete(workflowId);
      await loadWorkflows();
      await loadSettings();
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      alert('删除工作流失败');
    }
  };

  const handleSaveWorkflow = async () => {
    try {
      if (editingWorkflow) {
        await comfyuiWorkflowApi.update(editingWorkflow.id, {
          name: workflowName,
          nodeMappings,
        });
      } else if (workflowJson) {
        const newWorkflow = await comfyuiWorkflowApi.create(workflowName, workflowJson);
        await comfyuiWorkflowApi.update(newWorkflow.data.id, { nodeMappings });
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
  };

  const getNodeDisplayText = (node: ComfyUINodeInfo) => {
    if (node.title) {
      return `${node.title} - ${node.classType} (${node.id})`;
    }
    return `${node.classType} (${node.id})`;
  };
```

- [ ] **Step 6.5: 添加 NodeMappingField 组件**

在 `Settings` 组件之前（文件末尾之前）添加：

```typescript
function NodeMappingField({
  label,
  nodeId,
  fieldName,
  nodes,
  onNodeChange,
  onFieldChange,
  extraFields,
}: {
  label: string;
  nodeId?: string;
  fieldName: string;
  nodes: ComfyUINodeInfo[];
  onNodeChange: (id: string) => void;
  onFieldChange: (field: string) => void;
  extraFields?: Array<{ label: string; value: string; onChange: (v: string) => void }>;
}) {
  const selectedNode = nodes.find((n) => n.id === nodeId);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={nodeId || ''}
          onChange={(e) => onNodeChange(e.target.value)}
          className="border rounded-md px-3 py-2"
        >
          <option value="">-- 选择节点 --</option>
          {nodes.map((node) => {
            let displayText = node.classType + ' (' + node.id + ')';
            if (node.title) {
              displayText = node.title + ' - ' + displayText;
            }
            return (
              <option key={node.id} value={node.id}>
                {displayText}
              </option>
            );
          })}
        </select>
        <select
          value={fieldName}
          onChange={(e) => onFieldChange(e.target.value)}
          disabled={!selectedNode}
          className="border rounded-md px-3 py-2 disabled:opacity-50"
        >
          <option value="">-- 选择字段 --</option>
          {selectedNode?.fields.map((field) => (
            <option key={field} value={field}>
              {field}
            </option>
          ))}
        </select>
      </div>
      {extraFields && selectedNode && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {extraFields.map((ef) => (
            <div key={ef.label}>
              <label className="block text-xs text-gray-500 mb-1">{ef.label}</label>
              <select
                value={ef.value}
                onChange={(e) => ef.onChange(e.target.value)}
                className="w-full border rounded-md px-2 py-1 text-sm"
              >
                {selectedNode.fields.map((field) => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6.6: 添加工作流列表 UI**

在设置页面中，在"微软 TTS 设置"之前添加工作流管理区域：

```tsx
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">ComfyUI 工作流管理</h3>
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 text-sm"
            >
              上传工作流
            </button>
          </div>

          {workflows.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>还没有上传工作流</p>
              <p className="text-sm mt-2">点击上方按钮上传 ComfyUI 工作流（API 格式）</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className={`border rounded-lg p-4 ${
                    settings.comfyui.activeWorkflowId === workflow.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">
                        {workflow.name}
                        {settings.comfyui.activeWorkflowId === workflow.id && (
                          <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                            激活中
                          </span>
                        )}
                      </h4>
                      <p className="text-sm text-gray-500">
                        创建于: {new Date(workflow.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {settings.comfyui.activeWorkflowId !== workflow.id && (
                        <button
                          onClick={() => handleSetActive(workflow.id)}
                          className="text-green-600 hover:text-green-800 text-sm"
                        >
                          设为激活
                        </button>
                      )}
                      <button
                        onClick={() => handleEditWorkflow(workflow)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
```

- [ ] **Step 6.7: 添加上传模态框**

在 `Settings` 组件 return 的最后一个 `</div>` 之前添加：

```tsx
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {editingWorkflow ? '编辑工作流' : '上传工作流'}
            </h3>

            {!editingWorkflow && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  工作流 JSON 文件
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="workflow-file"
                  />
                  <label htmlFor="workflow-file" className="cursor-pointer">
                    <div className="text-gray-500">
                      {workflowFile ? workflowFile.name : '点击选择文件，或拖拽到此处'}
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                工作流名称
              </label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
                placeholder="我的工作流"
              />
            </div>

            {parsedNodes.length > 0 && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium">节点映射配置</h4>

                <NodeMappingField
                  label="正向提示词"
                  nodeId={nodeMappings.positivePromptNodeId}
                  fieldName={nodeMappings.positivePromptField}
                  nodes={parsedNodes}
                  onNodeChange={(id) => setNodeMappings({ ...nodeMappings, positivePromptNodeId: id })}
                  onFieldChange={(field) => setNodeMappings({ ...nodeMappings, positivePromptField: field })}
                />

                <NodeMappingField
                  label="否定提示词"
                  nodeId={nodeMappings.negativePromptNodeId}
                  fieldName={nodeMappings.negativePromptField}
                  nodes={parsedNodes}
                  onNodeChange={(id) => setNodeMappings({ ...nodeMappings, negativePromptNodeId: id })}
                  onFieldChange={(field) => setNodeMappings({ ...nodeMappings, negativePromptField: field })}
                />

                <div className="grid grid-cols-2 gap-4">
                  <NodeMappingField
                    label="宽度"
                    nodeId={nodeMappings.widthNodeId}
                    fieldName={nodeMappings.widthField}
                    nodes={parsedNodes}
                    onNodeChange={(id) => setNodeMappings({ ...nodeMappings, widthNodeId: id })}
                    onFieldChange={(field) => setNodeMappings({ ...nodeMappings, widthField: field })}
                  />
                  <NodeMappingField
                    label="高度"
                    nodeId={nodeMappings.heightNodeId}
                    fieldName={nodeMappings.heightField}
                    nodes={parsedNodes}
                    onNodeChange={(id) => setNodeMappings({ ...nodeMappings, heightNodeId: id })}
                    onFieldChange={(field) => setNodeMappings({ ...nodeMappings, heightField: field })}
                  />
                </div>

                <NodeMappingField
                  label="采样器（包含 steps、cfg、seed）"
                  nodeId={nodeMappings.samplerNodeId}
                  fieldName={nodeMappings.samplerField}
                  nodes={parsedNodes}
                  onNodeChange={(id) => setNodeMappings({ ...nodeMappings, samplerNodeId: id })}
                  onFieldChange={(field) => setNodeMappings({ ...nodeMappings, samplerField: field })}
                  extraFields={[
                    { label: 'Steps', value: nodeMappings.stepsField, onChange: (v) => setNodeMappings({ ...nodeMappings, stepsField: v }) },
                    { label: 'CFG', value: nodeMappings.cfgField, onChange: (v) => setNodeMappings({ ...nodeMappings, cfgField: v }) },
                    { label: 'Seed', value: nodeMappings.seedField, onChange: (v) => setNodeMappings({ ...nodeMappings, seedField: v }) },
                  ]}
                />

                <NodeMappingField
                  label="批次大小"
                  nodeId={nodeMappings.batchNodeId}
                  fieldName={nodeMappings.batchSizeField}
                  nodes={parsedNodes}
                  onNodeChange={(id) => setNodeMappings({ ...nodeMappings, batchNodeId: id })}
                  onFieldChange={(field) => setNodeMappings({ ...nodeMappings, batchSizeField: field })}
                />
              </div>
            )}

            {!editingWorkflow && workflowJson && parsedNodes.length === 0 && (
              <div className="border-t pt-4 mt-4">
                <button
                  onClick={async () => {
                    if (editingWorkflow) {
                      parseAndSetNodes(editingWorkflow);
                    } else if (workflowJson) {
                      try {
                        const newWorkflow = await comfyuiWorkflowApi.create(workflowName || '未命名工作流', workflowJson);
                        setEditingWorkflow(newWorkflow.data);
                        parseAndSetNodes(newWorkflow.data);
                      } catch (err) {
                        console.error('Failed to create workflow:', err);
                      }
                    }
                  }}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  解析工作流节点
                </button>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  resetUploadForm();
                }}
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveWorkflow}
                disabled={!workflowName || (!editingWorkflow && !workflowJson)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 6.8: Commit**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add frontend/src/pages/Settings.tsx
git commit -m "Add ComfyUI workflow management UI to Settings page"
```

---

## 任务 7: 测试和验证

**Files:** 无需创建/修改文件

### 步骤

- [ ] **Step 7.1: 启动后端**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic/backend
source venv/bin/activate
python main.py
```

验证后端启动成功，无错误。

- [ ] **Step 7.2: 启动前端**

在新终端中：

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic/frontend
npm run dev
```

验证前端启动成功。

- [ ] **Step 7.3: 功能测试**

1. 打开 http://localhost:5173/settings
2. 验证"ComfyUI 工作流管理"区域显示
3. 上传一个 ComfyUI 工作流 JSON（API 格式）
4. 配置节点映射
5. 设为激活工作流
6. 创建一个项目，尝试生成图片

- [ ] **Step 7.4: 更新文档**

在 README.md 中添加关于 ComfyUI 工作流配置的说明。

- [ ] **Step 7.5: 最终 Commit**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add README.md
git commit -m "Update README with ComfyUI workflow instructions"
```

---

## 完成

所有任务完成！你现在拥有了完整的 ComfyUI 自定义工作流支持功能。
