# 剪映草稿导出功能设计文档

**日期：** 2026-03-24
**版本：** 1.0
**状态：** 设计中

## 概述

基于 capcut-mate 项目的参考，为 novelcomic 实现剪映草稿导出功能，采用轻量级模板方案，不集成 pyJianYingDraft。

## 需求背景

- 用户需要将 novelcomic 生成的漫剧内容导出为剪映草稿
- 剪映草稿可以直接在剪映中打开和进一步编辑
- 需要支持用户配置剪映草稿保存路径

## 功能范围

### 最小可用版本（MVP）

- ✅ 将项目的图片按顺序添加到剪映视频轨道
- ✅ 将项目的音频按顺序添加到剪映音频轨道
- ✅ 所有素材复制到剪映草稿目录，使用相对路径
- ✅ 通过前端设置页面配置剪映草稿路径
- ✅ 导出的草稿可以直接在剪映中打开

### 后续迭代（待定）

- 图片动画效果
- 转场效果
- 字幕/文本样式
- 更丰富的视频编辑功能

## 架构设计

### 1. 配置层

#### 修改 `config.py`

在 `JianyingSettings` 类中新增 `draftPath` 字段：

```python
class JianyingSettings(BaseModel):
    canvasWidth: int = 1920
    canvasHeight: int = 1080
    canvasRatio: str = "16:9"
    draftPath: str = ""  # 新增：剪映草稿保存路径
```

#### 修改 `models/schemas.py`

同步更新 `JianyingSettings` 模型，添加 `draftPath` 字段。

启用之前注释掉的剪映导出相关 schemas：
- `ExportJianyingRequest`
- `ExportJianyingResponse`

### 2. 业务逻辑层

#### 新建 `core/jianying_exporter.py`

`JianyingExporter` 类职责：

| 方法 | 职责 |
|------|------|
| `__init__(template_dir, draft_base_path)` | 初始化，设置模板目录和草稿基础路径 |
| `export_project(project, project_dir)` | 导出项目为剪映草稿（主入口） |
| `_create_draft_directory(draft_id)` | 创建草稿目录 |
| `_copy_template(target_dir)` | 复制模板文件到目标目录 |
| `_copy_materials(project, project_dir, draft_dir)` | 复制素材文件到草稿目录 |
| `_modify_draft_content(draft_dir, project, materials_map)` | 修改 draft_content.json |
| `_update_material_paths(draft_content, draft_id)` | 更新素材路径为相对路径 |

### 3. API 层

#### 修改 `api/export.py`

启用 `POST /api/projects/{project_id}/export/jianying` 端点：

```python
@router.post("/projects/{project_id}/export/jianying")
async def export_jianying(project_id: str, request: ExportJianyingRequest):
    # 1. 验证剪映草稿路径已配置
    # 2. 加载项目
    # 3. 调用 JianyingExporter 执行导出
    # 4. 返回导出状态
```

#### 修改 `main.py`

启用 export 路由的注册（取消注释）。

### 4. 前端层

#### 修改设置页面

- 添加"剪映草稿路径"输入框
- 保存到全局设置

#### 修改项目编辑页面

- 启用"导出到剪映"按钮
- 显示导出进度/状态

## 数据流程

```
用户点击导出
    ↓
验证剪映草稿路径已配置
    ↓
生成唯一的草稿ID（基于项目ID+时间戳）
    ↓
复制 jianying_template 到 {剪映草稿路径}/{草稿ID}/
    ↓
从 storage 加载项目数据
    ↓
遍历分镜：
  - 复制图片到 {草稿ID}/images/
  - 复制音频到 {草稿ID}/audio/
    ↓
加载并解析 draft_content.json
    ↓
修改 draft_content.json：
  - 更新画布尺寸（从设置读取）
  - 添加视频轨道素材
  - 添加音频轨道素材
  - 设置素材时长
    ↓
保存修改后的 draft_content.json
    ↓
返回成功状态 + 草稿ID
```

## 关键文件结构

```
novelcomic/backend/
├── config.py                      # 更新 JianyingSettings
├── models/schemas.py              # 更新 JianyingSettings，启用导出相关 schemas
├── core/
│   ├── assets/
│   │   └── jianying_template/    # 现有模板
│   └── jianying_exporter.py       # 新建：导出核心逻辑
└── api/
    └── export.py                   # 更新：启用导出 API
```

## 剪映草稿目录结构

```
{剪映草稿路径}/
└── {草稿ID}/
    ├── draft_meta_info.json
    ├── draft_content.json
    ├── draft_info.json           # 可选，用于兼容旧版本剪映
    ├── draft_agency_config.json
    ├── draft_biz_config.json
    ├── draft_virtual_store.json
    ├── key_value.json
    ├── attachment_pc_common.json
    ├── images/
    │   ├── {storyboard_id_1}.jpg
    │   ├── {storyboard_id_2}.jpg
    │   └── ...
    └── audio/
        ├── {storyboard_id_1}.wav
        ├── {storyboard_id_2}.wav
        └── ...
```

## draft_content.json 修改要点

### 1. 画布尺寸

更新 `canvas.width` 和 `canvas.height` 为配置的值。

### 2. 视频轨道

在 `tracks` 中找到视频轨道，添加视频片段：
- 每个分镜的图片作为一个视频片段
- 片段时长基于音频时长
- 素材路径使用相对路径：`images/{storyboard_id}.jpg`

### 3. 音频轨道

在 `tracks` 中找到音频轨道，添加音频片段：
- 每个分镜的音频作为一个音频片段
- 片段时长使用实际音频时长
- 素材路径使用相对路径：`audio/{storyboard_id}.wav`

### 4. 素材列表

在 `materials` 中添加：
- `videos` 数组：所有图片素材
- `audios` 数组：所有音频素材

## 错误处理

| 错误情况 | 处理方式 |
|---------|---------|
| 剪映草稿路径未配置 | 返回 400 错误，提示用户先在设置中配置 |
| 剪映草稿路径不存在 | 尝试自动创建目录，失败则返回错误 |
| 项目不存在 | 返回 404 错误 |
| 素材文件缺失 | 记录警告，跳过该素材继续导出 |
| JSON 解析失败 | 返回 500 错误，包含详细错误信息 |
| JSON 保存失败 | 返回 500 错误，包含详细错误信息 |

## 配置说明

### 剪映草稿路径

**Windows 默认路径：**
```
C:\Users\{用户名}\AppData\Local\JianyingPro\User Data\Projects\com.lveditor.draft
```

**macOS 默认路径：**
```
/Users/{用户名}/Movies/JianyingPro/User Data/Projects/com.lveditor.draft
```

用户可在设置中自定义路径。

## 测试计划

### 单元测试

- `JianyingExporter` 各方法的单元测试
- 路径处理测试
- JSON 修改测试

### 集成测试

- 完整导出流程测试
- 各种素材组合测试
- 错误情况测试

### 手动测试

- 在剪映中打开导出的草稿
- 验证素材显示正常
- 验证音频播放正常
- 验证时间线顺序正确

## 参考资料

- capcut-mate 项目：https://github.com/Hommy-master/capcut-mate
- 剪映草稿模板：`backend/core/assets/jianying_template/`

## 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| 1.0 | 2026-03-24 | 初始版本 | - |
