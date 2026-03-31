
# 剪映草稿调整功能设计文档

## 概述

在解压视频项目中添加草稿调整功能，允许用户加载已导出的剪映草稿并添加封面、文本、水印、配乐等元素。

## 功能需求

### 核心功能

1. **加载剪映草稿**
   - 通过文件选择器选择剪映草稿目录
   - 读取并显示草稿基本信息（时长、轨道数等）

2. **添加封面**
   - 上传封面图片
   - 添加到视频轨道开头（建议时长3-5秒）

3. **添加封面标题**
   - 用户输入标题内容
   - 预设格式：新青年体、大小24、浅粉色(#ffd9e8)、粉色描边(#ff619d)、底部居中
   - 支持自定义格式

4. **添加文本**
   - 用户输入文本内容
   - 预设格式可配置
   - 时长根据音频总时长

5. **添加水印**
   - 用户输入水印内容
   - 预设格式：新青年体、大小15、白色、透明度20%
   - 位置关键帧动画：从左上(x=-0.55, y=0.87)移动到右下(x=0.60, y=-0.93)
   - 支持自定义格式

6. **添加配乐**
   - 上传MP3配乐文件
   - 响度固定为-27dB (volume≈0.044)
   - 自动复制配乐以匹配音频总时长
   - 最后一个片段裁剪结尾
   - 添加淡入淡出效果

7. **保存修改**
   - 直接修改原草稿文件

## 技术设计

### 后端架构

#### 1. 数据模型 (schemas.py)

```python
class TextStyleConfig(BaseModel):
    """文本样式配置"""
    fontSize: float = 24.0
    fontFamily: str = "新青年体"
    fontColor: str = "#ffd9e8"
    strokeColor: Optional[str] = "#ff619d"
    strokeWidth: float = 0.08
    alpha: float = 1.0
    positionX: float = 0.0
    positionY: float = 0.87
    align: int = 1  # 0=左, 1=中, 2=右

class WatermarkStyleConfig(TextStyleConfig):
    """水印样式配置（继承自文本样式）"""
    fontSize: float = 15.0
    fontColor: str = "#ffffff"
    alpha: float = 0.2078
    # 关键帧起始位置
    startPositionX: float = -0.552795
    startPositionY: float = 0.874126
    # 关键帧结束位置
    endPositionX: float = 0.596435
    endPositionY: float = -0.930708

class DraftAdjustmentConfig(BaseModel):
    """草稿调整配置"""
    # 封面
    coverImagePath: Optional[str] = None
    coverDuration: float = 3.0  # 秒

    # 封面标题
    coverTitleEnabled: bool = False
    coverTitle: str = ""
    coverTitleStyle: TextStyleConfig = Field(default_factory=TextStyleConfig)

    # 文本
    textEnabled: bool = False
    textContent: str = ""
    textStyle: TextStyleConfig = Field(default_factory=lambda: TextStyleConfig(
        fontSize=15.0,
        fontColor="#ffffff",
        positionY=0.0
    ))

    # 水印
    watermarkEnabled: bool = False
    watermarkText: str = ""
    watermarkStyle: WatermarkStyleConfig = Field(default_factory=WatermarkStyleConfig)

    # 配乐
    bgMusicEnabled: bool = False
    bgMusicPath: Optional[str] = None
    bgMusicVolume: float = 0.04425  # -27dB
    bgMusicFadeInDuration: float = 1.0  # 秒
    bgMusicFadeOutDuration: float = 1.0  # 秒

class LoadDraftRequest(BaseModel):
    draftPath: str

class LoadDraftResponse(BaseModel):
    success: bool
    draftName: str
    duration: float  # 秒
    trackCount: int
    error: Optional[str] = None

class ApplyDraftAdjustmentRequest(BaseModel):
    draftPath: str
    config: DraftAdjustmentConfig

class ApplyDraftAdjustmentResponse(BaseModel):
    success: bool
    message: str
    error: Optional[str] = None
```

#### 2. DraftAdjuster 类 (core/draft_adjuster.py)

```python
class DraftAdjuster:
    """剪映草稿调整器"""

    def __init__(self, draft_path: Path):
        self.draft_path = Path(draft_path)
        self.draft_content_path = self.draft_path / "draft_content.json"
        self.data = None
        self._load()

    def _load(self):
        """加载草稿"""
        with open(self.draft_content_path, 'r', encoding='utf-8') as f:
            self.data = json.load(f)

    def _save(self):
        """保存草稿"""
        # 备份原文件
        backup_path = self.draft_content_path.with_suffix(".json.bak")
        if not backup_path.exists():
            shutil.copy2(self.draft_content_path, backup_path)

        with open(self.draft_content_path, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False)

    def get_draft_info(self) -> Dict:
        """获取草稿信息"""
        draft = self.data
        duration_us = draft.get('duration', 0)
        tracks = draft.get('tracks', [])
        return {
            'draftName': draft.get('name', ''),
            'duration': duration_us / 1_000_000,
            'trackCount': len(tracks)
        }

    def add_cover_image(self, image_path: str, duration: float = 3.0):
        """添加封面图片"""
        # 复制图片到草稿目录
        # 添加到视频轨道开头
        pass

    def add_text(self, content: str, style: TextStyleConfig, duration_us: int):
        """添加文本片段"""
        # 使用 pyJianYingDraft 创建文本片段
        pass

    def add_watermark(self, content: str, style: WatermarkStyleConfig, duration_us: int):
        """添加水印（带动画）"""
        # 添加文本片段并添加位置关键帧
        pass

    def add_background_music(self, music_path: str, volume: float,
                               fade_in: float, fade_out: float,
                               target_duration_us: int):
        """添加配乐"""
        # 复制配乐文件
        # 计算需要重复次数
        # 添加多个音频片段，最后一个裁剪
        # 添加淡入淡出
        pass

    def apply(self, config: DraftAdjustmentConfig):
        """应用所有调整"""
        # 获取总时长
        draft = self.data
        total_duration_us = draft.get('duration', 0)

        # 按顺序应用各项调整
        if config.coverImagePath:
            self.add_cover_image(config.coverImagePath, config.coverDuration)

        if config.coverTitleEnabled and config.coverTitle:
            self.add_text(config.coverTitle, config.coverTitleStyle, total_duration_us)

        if config.textEnabled and config.textContent:
            self.add_text(config.textContent, config.textStyle, total_duration_us)

        if config.watermarkEnabled and config.watermarkText:
            self.add_watermark(config.watermarkText, config.watermarkStyle, total_duration_us)

        if config.bgMusicEnabled and config.bgMusicPath:
            self.add_background_music(
                config.bgMusicPath,
                config.bgMusicVolume,
                config.bgMusicFadeInDuration,
                config.bgMusicFadeOutDuration,
                total_duration_us
            )

        self._save()
```

#### 3. API 端点 (api/draft_adjust.py)

```python
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pathlib import Path
import shutil
import logging

from models.schemas import (
    LoadDraftRequest, LoadDraftResponse,
    ApplyDraftAdjustmentRequest, ApplyDraftAdjustmentResponse
)
from core.draft_adjuster import DraftAdjuster
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/draft-adjust", tags=["draft-adjust"])

@router.post("/load", response_model=LoadDraftResponse)
async def load_draft(request: LoadDraftRequest):
    """加载草稿信息"""
    try:
        draft_path = Path(request.draftPath)
        if not draft_path.exists():
            raise HTTPException(status_code=404, detail="Draft not found")

        adjuster = DraftAdjuster(draft_path)
        info = adjuster.get_draft_info()

        return LoadDraftResponse(
            success=True,
            draftName=info['draftName'],
            duration=info['duration'],
            trackCount=info['trackCount']
        )
    except Exception as e:
        logger.error(f"Failed to load draft: {e}", exc_info=True)
        return LoadDraftResponse(
            success=False,
            draftName="",
            duration=0,
            trackCount=0,
            error=str(e)
        )

@router.post("/upload-cover", response_model=Dict[str, str])
async def upload_cover(file: UploadFile = File(...)):
    """上传封面图片"""
    upload_dir = settings.data_dir / "tmp" / "draft-adjust"
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename).suffix or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return {"path": str(file_path)}

@router.post("/upload-music", response_model=Dict[str, str])
async def upload_music(file: UploadFile = File(...)):
    """上传配乐"""
    upload_dir = settings.data_dir / "tmp" / "draft-adjust"
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename).suffix or ".mp3"
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return {"path": str(file_path)}

@router.post("/apply", response_model=ApplyDraftAdjustmentResponse)
async def apply_adjustment(request: ApplyDraftAdjustmentRequest):
    """应用草稿调整"""
    try:
        draft_path = Path(request.draftPath)
        if not draft_path.exists():
            raise HTTPException(status_code=404, detail="Draft not found")

        adjuster = DraftAdjuster(draft_path)
        adjuster.apply(request.config)

        return ApplyDraftAdjustmentResponse(
            success=True,
            message="Draft adjusted successfully"
        )
    except Exception as e:
        logger.error(f"Failed to apply draft adjustment: {e}", exc_info=True)
        return ApplyDraftAdjustmentResponse(
            success=False,
            message="",
            error=str(e)
        )
```

### 前端设计

#### 1. API 类型 (services/api.ts)

```typescript
// 草稿调整相关类型
export interface TextStyleConfig {
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  strokeColor?: string;
  strokeWidth: number;
  alpha: number;
  positionX: number;
  positionY: number;
  align: number;
}

export interface WatermarkStyleConfig extends TextStyleConfig {
  startPositionX: number;
  startPositionY: number;
  endPositionX: number;
  endPositionY: number;
}

export interface DraftAdjustmentConfig {
  coverImagePath?: string;
  coverDuration: number;
  coverTitleEnabled: boolean;
  coverTitle: string;
  coverTitleStyle: TextStyleConfig;
  textEnabled: boolean;
  textContent: string;
  textStyle: TextStyleConfig;
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkStyle: WatermarkStyleConfig;
  bgMusicEnabled: boolean;
  bgMusicPath?: string;
  bgMusicVolume: number;
  bgMusicFadeInDuration: number;
  bgMusicFadeOutDuration: number;
}

export interface LoadDraftRequest {
  draftPath: string;
}

export interface LoadDraftResponse {
  success: boolean;
  draftName: string;
  duration: number;
  trackCount: number;
  error?: string;
}

export interface ApplyDraftAdjustmentRequest {
  draftPath: string;
  config: DraftAdjustmentConfig;
}

export interface ApplyDraftAdjustmentResponse {
  success: boolean;
  message: string;
  error?: string;
}

// API 方法
export const draftAdjustApi = {
  loadDraft: (data: LoadDraftRequest) =>
    api.post<LoadDraftResponse>('/draft-adjust/load', data),

  uploadCover: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ path: string }>('/draft-adjust/upload-cover', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  uploadMusic: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ path: string }>('/draft-adjust/upload-music', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  apply: (data: ApplyDraftAdjustmentRequest) =>
    api.post<ApplyDraftAdjustmentResponse>('/draft-adjust/apply', data),
};
```

#### 2. 组件 DraftAdjustmentModal.tsx

在项目页面添加"草稿调整"按钮，点击打开弹窗。

```tsx
const defaultTextStyle: TextStyleConfig = {
  fontSize: 24,
  fontFamily: '新青年体',
  fontColor: '#ffd9e8',
  strokeColor: '#ff619d',
  strokeWidth: 0.08,
  alpha: 1,
  positionX: 0,
  positionY: 0.87,
  align: 1,
};

const defaultWatermarkStyle: WatermarkStyleConfig = {
  fontSize: 15,
  fontFamily: '新青年体',
  fontColor: '#ffffff',
  strokeColor: undefined,
  strokeWidth: 0,
  alpha: 0.2078,
  positionX: 0,
  positionY: 0,
  align: 1,
  startPositionX: -0.552795,
  startPositionY: 0.874126,
  endPositionX: 0.596435,
  endPositionY: -0.930708,
};

export const DraftAdjustmentModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}> = ({ isOpen, onClose, project }) => {
  const [draftPath, setDraftPath] = useState('');
  const [draftInfo, setDraftInfo] = useState<LoadDraftResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const [config, setConfig] = useState<DraftAdjustmentConfig>({
    coverDuration: 3,
    coverTitleEnabled: false,
    coverTitle: '',
    coverTitleStyle: { ...defaultTextStyle },
    textEnabled: false,
    textContent: '',
    textStyle: {
      ...defaultTextStyle,
      fontSize: 15,
      fontColor: '#ffffff',
      strokeColor: undefined,
      strokeWidth: 0,
      positionY: 0,
    },
    watermarkEnabled: false,
    watermarkText: '',
    watermarkStyle: { ...defaultWatermarkStyle },
    bgMusicEnabled: false,
    bgMusicVolume: 0.04425,
    bgMusicFadeInDuration: 1,
    bgMusicFadeOutDuration: 1,
  });

  const handleLoadDraft = async () => {
    if (!draftPath) return;
    setLoading(true);
    try {
      const res = await draftAdjustApi.loadDraft({ draftPath });
      setDraftInfo(res.data);
    } catch (e) {
      console.error('Failed to load draft:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!draftPath) return;
    setApplying(true);
    try {
      const res = await draftAdjustApi.apply({ draftPath, config });
      if (res.data.success) {
        alert('应用成功！');
        onClose();
      } else {
        alert('应用失败: ' + res.data.error);
      }
    } catch (e) {
      console.error('Failed to apply:', e);
      alert('应用失败');
    } finally {
      setApplying(false);
    }
  };

  // 文件选择、上传等处理...

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="草稿调整" size="xl">
      {/* 草稿选择 */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">剪映草稿路径</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={draftPath}
              onChange={(e) => setDraftPath(e.target.value)}
              className="flex-1 px-3 py-2 border rounded"
              placeholder="/path/to/JianyingPro Drafts/MyDraft"
            />
            <button
              onClick={() => {
                // 打开文件选择器（使用 Electron 或其他方式）
              }}
              className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
            >
              选择...
            </button>
            <button
              onClick={handleLoadDraft}
              disabled={!draftPath || loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              加载
            </button>
          </div>
        </div>

        {/* 草稿信息 */}
        {draftInfo && draftInfo.success && (
          <div className="p-4 bg-gray-50 rounded">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-gray-500">草稿名称:</span>{' '}
                <span className="font-medium">{draftInfo.draftName}</span>
              </div>
              <div>
                <span className="text-gray-500">时长:</span>{' '}
                <span className="font-medium">{draftInfo.duration.toFixed(1)}秒</span>
              </div>
              <div>
                <span className="text-gray-500">轨道数:</span>{' '}
                <span className="font-medium">{draftInfo.trackCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* 封面 */}
        <div className="border-t pt-4">
          <h3 className="font-medium mb-3">封面</h3>
          {/* 封面上传、时长配置 */}
        </div>

        {/* 封面标题 */}
        <div className="border-t pt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.coverTitleEnabled}
              onChange={(e) => setConfig({ ...config, coverTitleEnabled: e.target.checked })}
            />
            <span className="font-medium">添加封面标题</span>
          </label>
          {config.coverTitleEnabled && (
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={config.coverTitle}
                onChange={(e) => setConfig({ ...config, coverTitle: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="输入标题..."
              />
              {/* 样式配置 */}
            </div>
          )}
        </div>

        {/* 文本 */}
        <div className="border-t pt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.textEnabled}
              onChange={(e) => setConfig({ ...config, textEnabled: e.target.checked })}
            />
            <span className="font-medium">添加文本</span>
          </label>
          {config.textEnabled && (
            <div className="mt-3 space-y-3">
              <textarea
                value={config.textContent}
                onChange={(e) => setConfig({ ...config, textContent: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                rows={3}
                placeholder="输入文本..."
              />
              {/* 样式配置 */}
            </div>
          )}
        </div>

        {/* 水印 */}
        <div className="border-t pt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.watermarkEnabled}
              onChange={(e) => setConfig({ ...config, watermarkEnabled: e.target.checked })}
            />
            <span className="font-medium">添加水印</span>
          </label>
          {config.watermarkEnabled && (
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={config.watermarkText}
                onChange={(e) => setConfig({ ...config, watermarkText: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="@用户名"
              />
              {/* 样式配置 */}
            </div>
          )}
        </div>

        {/* 配乐 */}
        <div className="border-t pt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.bgMusicEnabled}
              onChange={(e) => setConfig({ ...config, bgMusicEnabled: e.target.checked })}
            />
            <span className="font-medium">添加配乐</span>
          </label>
          {config.bgMusicEnabled && (
            <div className="mt-3 space-y-3">
              {/* 配乐上传 */}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
        <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">
          取消
        </button>
        <button
          onClick={handleApply}
          disabled={!draftInfo || !draftInfo.success || applying}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {applying ? '应用中...' : '应用调整'}
        </button>
      </div>
    </Modal>
  );
};
```

### 实现计划

1. **Step 1: 数据模型**
   - 在 `schemas.py` 中添加 DraftAdjustment 相关模型
   - 创建默认样式配置

2. **Step 2: DraftAdjuster 核心类**
   - 创建 `core/draft_adjuster.py`
   - 实现草稿加载和保存
   - 实现添加文本片段功能
   - 实现添加水印（带关键帧）功能
   - 实现添加配乐（重复、裁剪、淡入淡出）功能
   - 实现添加封面功能

3. **Step 3: 后端 API**
   - 创建 `api/draft_adjust.py`
   - 在 `main.py` 中注册路由

4. **Step 4: 前端 API**
   - 在 `services/api.ts` 中添加类型和方法

5. **Step 5: 前端 UI**
   - 创建 `DraftAdjustmentModal.tsx` 组件
   - 在项目页面集成该组件

6. **Step 6: 测试**
   - 完整功能测试
   - 修复问题
