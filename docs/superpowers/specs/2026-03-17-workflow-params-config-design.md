# ComfyUI 工作流参数配置设计

**Date:** 2026-03-17

## 概述

为每个 ComfyUI 工作流添加独立的默认参数配置功能，用户可以在前端网页配置常用参数，无需修改后端代码。

## 目标

- 支持每个工作流独立配置参数
- 支持正向提示词前缀和后缀
- 支持常用参数可配置：宽度、高度、CFG、Steps、Seed、Sampler、Batch Size
- 无需修改后端代码即可调整参数

## 架构设计

### 1. 数据模型

#### 1.1 新增 ComfyUIWorkflowParams 模型

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

#### 1.2 更新 ComfyUIWorkflow 模型

```python
class ComfyUIWorkflow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    workflowJson: Dict[str, Any]
    nodeMappings: ComfyUINodeMappings = Field(default_factory=ComfyUINodeMappings)
    defaultParams: ComfyUIWorkflowParams = Field(default_factory=ComfyUIWorkflowParams)
    createdAt: datetime = Field(default_factory=datetime.now)
```

#### 1.3 更新 UpdateComfyUIWorkflowRequest

```python
class UpdateComfyUIWorkflowRequest(BaseModel):
    name: Optional[str] = None
    nodeMappings: Optional[ComfyUINodeMappings] = None
    defaultParams: Optional[ComfyUIWorkflowParams] = None
```

### 2. 后端实现

#### 2.1 修改 `_apply_workflow_mappings` 方法

**文件:** `backend/core/comfyui.py`

**变更:**
- 新增 `params: Optional[ComfyUIWorkflowParams]` 参数
- 应用参数逻辑：
  - 如果 `params` 不为 None，使用配置的参数
  - `samplerName=None` 时保留工作流原值
  - 正向提示词 = `prefix + 生成的提示词 + suffix`
  - 否定提示词：有 override 用 override，否则用传入值

**签名变更：
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

#### 2.2 修改 `generate_image` 方法

传递工作流的 `defaultParams` 到 `_apply_workflow_mappings`。

### 3. 前端实现

#### 3.1 更新 TypeScript 类型

**文件:** `frontend/src/services/api.ts`

新增 `ComfyUIWorkflowParams` 类型：
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

更新 `ComfyUIWorkflow` 类型：
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

更新 `UpdateComfyUIWorkflowRequest` 类型：
```typescript
export interface UpdateComfyUIWorkflowRequest {
  name?: string;
  nodeMappings?: Partial<ComfyUINodeMappings>;
  defaultParams?: Partial<ComfyUIWorkflowParams>;
}
```

#### 3.2 更新 Settings.tsx UI

在编辑工作流模态框中，"节点映射配置"下方新增"默认参数配置"区域。

**UI 布局:**
```
[默认参数配置
  ┌─────────────────────────────────┐
  │ 宽度: [ 1280 ]      │
  │ 高度: [ 960  ]      │
  │ Steps: [ 30   ]      │
  │ CFG:   [ 7.0  ]      │
  │ Sampler: [▼ 使用工作流默认]│
  │ Seed:  [ 0    ] (0=随机)│
  │ Batch Size: [ 1 ]      │
  │                         │
  │ 正向提示词前缀: [______] │
  │ 正向提示词后缀: [______] │
  │ 否定提示词覆盖: [______] │
  │ (留空表示不覆盖)         │
  └─────────────────────────────────┘
```

**新增 state:**
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

**Sampler 下拉选项:**
- "使用工作流默认" → `null`
- 从工作流 JSON 中读取现有 sampler_name 值作为默认显示
- 可手动输入其他 sampler 名称

### 4. 可配置参数清单

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| width | int | 1280 | 图片宽度 |
| height | int | 960 | 图片高度 |
| steps | int | 30 | 采样步数 |
| cfg | float | 7.0 | CFG scale |
| samplerName | string \| null | null | null=使用工作流原值 |
| seed | int | 0 | 0=随机 |
| batchSize | int | 1 | 批次大小 |
| positivePromptPrefix | string | "" | 正向提示词前缀 |
| positivePromptSuffix | string | "" | 正向提示词后缀 |
| negativePromptOverride | string \| null | null | null=不覆盖 |

### 5. 参数应用规则

1. **宽度/高度:** 配置的值覆盖工作流节点映射的对应字段
2. **Steps/CFG/Seed:** 配置的值覆盖工作流节点映射的对应字段
3. **Sampler:**
   - `null → 保留工作流原值
   - 非 null → 覆盖工作流值
4. **Batch Size:** 配置的值覆盖工作流节点映射的对应字段
5. **正向提示词:**
   - 最终值 = `prefix + 系统生成的提示词 + suffix`
6. **否定提示词:**
   - `null` → 使用传入的 negative_prompt
   - 非 null → 使用配置的 override 值

### 6. 文件变更清单

**后端:**
- `backend/models/schemas.py` - 新增 ComfyUIWorkflowParams，更新 ComfyUIWorkflow、UpdateComfyUIWorkflowRequest
- `backend/core/comfyui.py` - 修改 _apply_workflow_mappings、generate_image
- `backend/api/comfyui_workflows.py` - 更新 update 端点支持 defaultParams

**前端:**
- `frontend/src/services/api.ts` - 更新类型定义
- `frontend/src/pages/Settings.tsx` - 新增默认参数配置 UI

## 非目标

- 不支持为任意节点的任意字段配置值（保持简单，只支持固定的常用参数）
- 不支持全局配置（只支持每个工作流独立配置）
