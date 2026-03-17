# ComfyUI 自定义工作流支持 - 设计文档

**日期:** 2026-03-17
**作者:** NovelComic Team
**状态:** 待审核

## 概述

本文档描述了为 NovelComic 项目添加 ComfyUI 自定义工作流支持的设计方案。该功能允许用户上传自己的 ComfyUI 工作流（API 格式），并通过图形界面配置参数映射，从而解决当前硬编码工作流无法适配不同环境的问题。

## 背景与目标

### 当前问题

1. **硬编码工作流**: `comfyui.py` 中的工作流是硬编码的，无法适配用户的不同 ComfyUI 设置
2. **模型差异**: 不同用户使用的模型、检查点名称不同
3. **工作流多样性**: 用户可能有自己优化过的工作流（如 SDXL、ControlNet、LoRA 等）
4. **节点配置**: 即使是相同功能，不同工作流的节点 ID 和字段名也可能不同

### 设计目标

1. **完全替换硬编码工作流**: 移除 `_build_text_to_image_workflow()` 方法
2. **支持多工作流管理**: 用户可以保存、管理多个工作流
3. **可视化节点映射**: 通过下拉菜单选择参数对应的节点和字段
4. **向后兼容**: 无（用户必须上传自己的工作流）

## 数据模型设计

### ComfyUIWorkflow

工作流主模型，包含工作流 JSON 和节点映射配置。

```python
class ComfyUIWorkflow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    workflowJson: Dict[str, Any]
    nodeMappings: ComfyUINodeMappings
    createdAt: datetime = Field(default_factory=datetime.now)
```

### ComfyUINodeMappings

节点映射配置，定义了每个参数类型对应工作流中的哪个节点的哪个字段。

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
```

### ComfyUINodeInfo

用于前端展示的节点信息结构。

```python
class ComfyUINodeInfo(BaseModel):
    id: str
    classType: str
    title: Optional[str]
    fields: List[str]
```

### 更新现有模型

```python
class ComfyUISettings(BaseModel):
    apiUrl: str = "http://8.222.174.34:8188"
    timeout: int = 300
    maxRetries: int = 3
    concurrentLimit: int = 3
    activeWorkflowId: Optional[str] = None  # 新增
```

## API 端点设计

### 工作流管理

| 方法 | 端点 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/comfyui/workflows` | 列出所有工作流 | - | `List[ComfyUIWorkflow]` |
| POST | `/api/comfyui/workflows` | 创建新工作流 | `{name: str, workflowJson: Dict}` | `ComfyUIWorkflow` |
| GET | `/api/comfyui/workflows/{id}` | 获取工作流详情 | - | `ComfyUIWorkflow` |
| PUT | `/api/comfyui/workflows/{id}` | 更新工作流 | `{name?: str, nodeMappings?: Dict}` | `ComfyUIWorkflow` |
| DELETE | `/api/comfyui/workflows/{id}` | 删除工作流 | - | `{success: bool}` |
| POST | `/api/comfyui/workflows/{id}/parse` | 解析工作流节点 | - | `{nodes: List[ComfyUINodeInfo]}` |

### 激活工作流

| 方法 | 端点 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| PUT | `/api/comfyui/active-workflow` | 设置激活工作流 | `{workflowId: string}` | `GlobalSettings` |

### 路由注册

在 `main.py` 中新增工作流路由：

```python
from api import comfyui_workflows

app.include_router(comfyui_workflows.router, prefix="/api/comfyui", tags=["comfyui"])
```

## 核心逻辑变更

### comfyui.py 重构

#### 移除

- `_build_text_to_image_workflow()` 方法

#### 新增

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
    """
    将生成参数注入到工作流的指定节点中。

    Args:
        workflow: 原始工作流 JSON
        mappings: 节点映射配置
        prompt: 正向提示词
        negative_prompt: 否定提示词
        width: 图片宽度
        height: 图片高度
        steps: 采样步数
        cfg: CFG scale
        sampler_name: 采样器名称
        seed: 随机种子
        batch_size: 批次大小

    Returns:
        注入参数后的工作流
    """
    workflow_copy = deepcopy(workflow)

    # 正向提示词
    if mappings.positivePromptNodeId:
        node = workflow_copy.get(mappings.positivePromptNodeId, {})
        if "inputs" in node:
            node["inputs"][mappings.positivePromptField] = prompt

    # 否定提示词
    if mappings.negativePromptNodeId:
        node = workflow_copy.get(mappings.negativePromptNodeId, {})
        if "inputs" in node:
            node["inputs"][mappings.negativePromptField] = negative_prompt or "bad anatomy, bad hands"

    # 宽度
    if mappings.widthNodeId:
        node = workflow_copy.get(mappings.widthNodeId, {})
        if "inputs" in node:
            node["inputs"][mappings.widthField] = width

    # 高度
    if mappings.heightNodeId:
        node = workflow_copy.get(mappings.heightNodeId, {})
        if "inputs" in node:
            node["inputs"][mappings.heightField] = height

    # 采样参数
    if mappings.samplerNodeId:
        node = workflow_copy.get(mappings.samplerNodeId, {})
        if "inputs" in node:
            node["inputs"][mappings.samplerField] = sampler_name
            node["inputs"][mappings.stepsField] = steps
            node["inputs"][mappings.cfgField] = cfg
            node["inputs"][mappings.seedField] = seed

    # 批次大小
    if mappings.batchNodeId:
        node = workflow_copy.get(mappings.batchNodeId, {})
        if "inputs" in node:
            node["inputs"][mappings.batchSizeField] = batch_size

    return workflow_copy
```

#### 修改

`generate_image()` 方法更新为：

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

    # 获取工作流
    if workflow_id:
        workflow = storage.get_comfyui_workflow(workflow_id)
    else:
        # 从全局设置获取激活的工作流
        settings = storage.get_settings()
        if not settings.comfyui.activeWorkflowId:
            raise Exception("No active ComfyUI workflow. Please upload and activate a workflow in Settings.")
        workflow = storage.get_comfyui_workflow(settings.comfyui.activeWorkflowId)

    if not workflow:
        raise Exception("ComfyUI workflow not found")

    # 应用映射
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

    # 提交生成（原有逻辑）
    prompt_id = await self._queue_prompt(workflow_json)
    # ... 其余保持不变
```

### storage.py 扩展

新增工作流存储方法：

```python
class Storage:
    # ... 现有方法 ...

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
        # 按创建时间倒序
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

### 工作流解析逻辑

新增 `api/comfyui_workflows.py` 中的节点解析函数：

```python
def _parse_workflow_nodes(workflow_json: Dict[str, Any]) -> List[ComfyUINodeInfo]:
    """
    解析工作流 JSON，提取所有节点信息。

    返回每个节点的 ID、类型、标题（如果有）、以及可配置的输入字段列表。
    """
    nodes = []
    for node_id, node_data in workflow_json.items():
        class_type = node_data.get("class_type", "")
        inputs = node_data.get("inputs", {})

        # 尝试获取节点标题（某些工作流格式可能有）
        title = node_data.get("_meta", {}).get("title")
        if not title:
            title = node_data.get("title")

        # 收集可配置的字段（只包含原始值，不包含链接）
        fields = []
        for key, value in inputs.items():
            # 如果值不是列表（即不是节点链接），则认为是可配置字段
            if not isinstance(value, list):
                fields.append(key)

        nodes.append(ComfyUINodeInfo(
            id=node_id,
            classType=class_type,
            title=title,
            fields=fields
        ))

    return nodes
```

## 前端设计

### 类型定义（api.ts）

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

// 新增 API 方法
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

### UI 组件

#### 工作流列表

在 Settings.tsx 中新增 ComfyUI 工作流管理区域：

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

#### 上传/编辑工作流模态框

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

      {parsedNodes && (
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

#### 节点选择组件

```tsx
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

  const getNodeDisplayText = (node: ComfyUINodeInfo) => {
    if (node.title) {
      return `${node.title} - ${node.classType} (${node.id})`;
    }
    return `${node.classType} (${node.id})`;
  };

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
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {getNodeDisplayText(node)}
            </option>
          ))}
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

## 文件结构变更

### 新增文件

```
backend/
├── api/
│   └── comfyui_workflows.py      # 新增：工作流 API 路由
frontend/
└── src/
    └── components/
        └── ComfyUIWorkflowEditor.tsx  # 新增：工作流编辑器组件（可选）
docs/
└── superpowers/
    └── specs/
        └── 2026-03-17-comfyui-workflows-design.md  # 本文档
data/
└── comfyui_workflows/             # 新增：工作流存储目录
    ├── {workflow_id_1}.json
    └── ...
```

### 修改文件

```
backend/
├── models/
│   └── schemas.py          # 添加工作流相关模型
├── core/
│   ├── comfyui.py          # 重构，移除硬编码工作流
│   └── storage.py          # 添加工作流存储方法
├── api/
│   └── projects.py         # （如需，保持不变）
└── main.py                 # 注册工作流路由

frontend/
├── src/
│   ├── pages/
│   │   └── Settings.tsx    # 添加工作流管理 UI
│   └── services/
│       └── api.ts          # 添加工作流 API 类型和方法
```

## 实施步骤

### 阶段 1: 后端数据模型和存储

1. 在 `schemas.py` 中添加工作流相关模型
2. 在 `storage.py` 中添加工作流存储方法
3. 创建 `comfyui_workflows.py` API 路由
4. 在 `main.py` 中注册路由

### 阶段 2: 核心逻辑重构

1. 在 `comfyui.py` 中添加 `_apply_workflow_mappings()` 方法
2. 重构 `generate_image()` 方法使用工作流
3. 移除 `_build_text_to_image_workflow()` 方法

### 阶段 3: 前端实现

1. 在 `api.ts` 中添加类型和 API 方法
2. 在 `Settings.tsx` 中添加工作流列表 UI
3. 实现上传/编辑模态框
4. 实现节点映射配置界面

### 阶段 4: 测试和文档

1. 测试工作流上传和解析
2. 测试节点映射配置
3. 测试图片生成
4. 更新 README 文档

## 注意事项

### 错误处理

1. **无激活工作流**: 当用户尝试生成图片但没有激活工作流时，应给出明确的错误提示，引导用户去设置页面配置
2. **节点映射不完整**: 保存工作流时，检查必需的映射是否已配置（至少正向提示词、尺寸、采样器）
3. **工作流 JSON 无效**: 上传时验证 JSON 格式是否符合 ComfyUI API 格式

### 用户体验

1. 提供示例工作流（可选，作为文档）
2. 在设置页面添加"如何导出 ComfyUI 工作流"的帮助说明
3. 节点下拉框按节点类型分组或排序，方便查找

### 常见节点类型

前端可以高亮显示这些常见节点类型，帮助用户快速识别：

- `CLIPTextEncode` - 提示词编码
- `KSampler` / `KSamplerAdvanced` - 采样器
- `EmptyLatentImage` - 空潜空间（尺寸）
- `CheckpointLoaderSimple` - 检查点加载
- `VAEDecode` - VAE 解码
- `SaveImage` - 保存图片

## 回滚计划

如果实施过程中发现问题，可以：

1. 恢复 `comfyui.py` 中的 `_build_text_to_image_workflow()` 方法
2. 恢复 `generate_image()` 方法调用硬编码工作流
3. 保持新增的 API 端点（不影响现有功能）

## 总结

本设计方案通过以下方式解决了当前的问题：

1. **完全自定义**: 用户可以上传任意 ComfyUI 工作流
2. **可视化配置**: 通过下拉菜单选择节点，无需手动编辑 JSON
3. **多工作流管理**: 可以保存多个工作流，随时切换
4. **灵活映射**: 每个参数都可以独立配置节点和字段

该设计保持了现有 API 接口的稳定性，仅修改了内部实现逻辑。
