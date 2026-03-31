
# 剪映草稿调整功能 Implementation Plan

&gt; **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现剪映草稿调整功能，支持加载已导出的草稿并添加封面、文本、水印、配乐等元素

**Architecture:** 在后端创建 DraftAdjuster 类来操作剪映草稿 JSON，前端通过弹窗提供配置界面

**Tech Stack:** FastAPI + Python (后端), React + TypeScript (前端), pyJianYingDraft 库

---

## File Structure

| File | Purpose |
|------|---------|
| `backend/models/schemas.py` | 添加草稿调整相关数据模型 |
| `backend/core/draft_adjuster.py` | DraftAdjuster 核心类，负责加载/修改/保存草稿 |
| `backend/api/draft_adjust.py` | 草稿调整 API 端点 |
| `backend/main.py` | 注册 draft_adjust 路由 |
| `frontend/src/services/api.ts` | 添加草稿调整 API 类型和方法 |
| `frontend/src/components/DraftAdjustmentModal.tsx` | 草稿调整弹窗组件 |
| `frontend/src/pages/DecompressionVideoEditor.tsx` | 集成草稿调整按钮 |

---

## Task 1: 添加数据模型

**Files:**
- Modify: `backend/models/schemas.py`

- [ ] **Step 1: 在 schemas.py 末尾添加草稿调整相关模型**

在 `backend/models/schemas.py` 的末尾（TestImageResponse 之后）添加：

```python
# ===== Draft Adjustment Schemas =====
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
    strokeColor: Optional[str] = None
    strokeWidth: float = 0.0
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
        strokeColor=None,
        strokeWidth=0.0,
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

- [ ] **Step 2: 验证文件修改**

Read the file to verify the changes are correct.

- [ ] **Step 3: Commit**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add backend/models/schemas.py
git commit -m "feat: add draft adjustment data models"
```

---

## Task 2: 创建 DraftAdjuster 核心类

**Files:**
- Create: `backend/core/draft_adjuster.py`

- [ ] **Step 1: 创建 draft_adjuster.py 文件**

```python
import json
import shutil
import logging
from pathlib import Path
from typing import Dict, Optional, List, Any
import uuid
import sys

from config import settings
from models.schemas import (
    DraftAdjustmentConfig,
    TextStyleConfig,
    WatermarkStyleConfig
)

logger = logging.getLogger(__name__)

# 添加 pyJianYingDraft 库的路径
CAPCUT_MATE_PATH = Path("/Users/wyf-mac/Documents/code/claudecode/capcut-mate/src")
sys.path.insert(0, str(CAPCUT_MATE_PATH.parent))


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

    def get_draft_info(self) -&gt; Dict[str, Any]:
        """获取草稿信息"""
        duration_us = self.data.get('duration', 0)
        tracks = self.data.get('tracks', [])
        return {
            'draftName': self.data.get('name', ''),
            'duration': duration_us / 1_000_000,
            'trackCount': len(tracks)
        }

    def _get_total_duration_us(self) -&gt; int:
        """获取草稿总时长（微秒）"""
        return self.data.get('duration', 0)

    def _add_text_segment_direct(self, content: str, style: TextStyleConfig,
                                   duration_us: int, start_us: int = 0,
                                   add_keyframes: bool = False,
                                   watermark_style: Optional[WatermarkStyleConfig] = None):
        """直接在 JSON 中添加文本片段（绕过 pyJianYingDraft 的限制）"""
        import src.pyJianYingDraft as draft
        from src.pyJianYingDraft.metadata import FontType

        # 创建文本素材
        text_mat_id = uuid.uuid4().hex.replace('-', '')

        # 构建 styles
        styles = [{
            "fill": {
                "content": {
                    "render_type": "solid",
                    "solid": {
                        "alpha": 1.0,
                        "color": self._hex_to_rgb(style.fontColor)
                    }
                }
            },
            "range": [0, len(content.encode('utf-16-le'))],
            "size": style.fontSize,
        }]

        # 添加字体
        styles[0]["font"] = {
            "id": "6740435892441190919",
            "path": "/Applications/VideoFusion-macOS.app/Contents/Resources/Font/新青年体.ttf"
        }

        # 添加描边
        if style.strokeColor and style.strokeWidth &gt; 0:
            styles[0]["strokes"] = [{
                "alpha": 1.0,
                "content": {
                    "render_type": "solid",
                    "solid": {
                        "alpha": 1.0,
                        "color": self._hex_to_rgb(style.strokeColor)
                    }
                },
                "width": style.strokeWidth
            }]
            styles[0]["useLetterColor"] = True

        content_json = {
            "styles": styles,
            "text": content
        }

        # 创建文本素材
        text_material = {
            "add_type": 0,
            "alignment": style.align,
            "background_alpha": 1.0,
            "background_color": "",
            "background_height": 0.14,
            "background_horizontal_offset": 0.0,
            "background_round_radius": 0.0,
            "background_style": 0,
            "background_vertical_offset": 0.0,
            "background_width": 0.14,
            "base_content": "",
            "bold_width": 0.0,
            "border_alpha": 1.0,
            "border_color": style.strokeColor or "",
            "border_width": style.strokeWidth,
            "check_flag": 15 if style.strokeColor else 7,
            "combo_info": {"text_templates": []},
            "content": json.dumps(content_json, ensure_ascii=False),
            "fixed_height": -1.0,
            "fixed_width": -1.0,
            "font_category_id": "",
            "font_category_name": "",
            "font_id": "",
            "font_name": "",
            "font_path": "/Applications/VideoFusion-macOS.app/Contents/Resources/Font/新青年体.ttf",
            "font_resource_id": "6740435892441190919",
            "font_size": style.fontSize,
            "font_source_platform": 0,
            "font_team_id": "",
            "font_title": "none",
            "font_url": "",
            "fonts": [{
                "category_id": "user",
                "category_name": "最近使用",
                "effect_id": "6740435892441190919",
                "file_uri": "",
                "id": str(uuid.uuid4()).upper(),
                "path": "/Applications/VideoFusion-macOS.app/Contents/Resources/Font/新青年体.ttf",
                "request_id": "",
                "resource_id": "6740435892441190919",
                "source_platform": 0,
                "team_id": "",
                "title": "新青年体"
            }],
            "force_apply_line_max_width": False,
            "global_alpha": style.alpha,
            "group_id": "",
            "has_shadow": False,
            "id": text_mat_id,
            "initial_scale": 1.0,
            "inner_padding": -1.0,
            "is_rich_text": False,
            "italic_degree": 0,
            "ktv_color": "",
            "language": "",
            "layer_weight": 1,
            "letter_spacing": 0.0,
            "line_feed": 1,
            "line_max_width": 0.82,
            "line_spacing": 0.02,
            "multi_language_current": "none",
            "name": "",
            "original_size": [],
            "preset_category": "",
            "preset_category_id": "",
            "preset_has_set_alignment": False,
            "preset_id": "",
            "preset_index": 0,
            "preset_name": "",
            "recognize_task_id": "",
            "recognize_type": 0,
            "relevance_segment": [],
            "shadow_alpha": 0.9,
            "shadow_angle": -45.0,
            "shadow_color": "",
            "shadow_distance": 5.0,
            "shadow_point": {"x": 0.6363961030678928, "y": -0.6363961030678927},
            "shadow_smoothing": 0.45,
            "shape_clip_x": False,
            "shape_clip_y": False,
            "source_from": "",
            "style_name": "",
            "sub_type": 0,
            "subtitle_keywords": None,
            "subtitle_template_original_fontsize": 0.0,
            "text_alpha": 1.0,
            "text_color": style.fontColor,
            "text_curve": None,
            "text_preset_resource_id": "",
            "text_size": 30,
            "text_to_audio_ids": [],
            "tts_auto_update": False,
            "type": "text",
            "typesetting": 0,
            "underline": False,
            "underline_offset": 0.22,
            "underline_width": 0.05,
            "use_effect_default_color": True,
            "words": {"end_time": [], "start_time": [], "text": []}
        }

        # 添加到 materials.texts
        if 'materials' not in self.data:
            self.data['materials'] = {}
        if 'texts' not in self.data['materials']:
            self.data['materials']['texts'] = []
        self.data['materials']['texts'].append(text_material)

        # 创建文本片段
        seg_id = str(uuid.uuid4()).upper()

        # 计算最大 render_index
        max_render_index = 15000
        tracks = self.data.get('tracks', [])
        for track in tracks:
            segs = track.get('segments', [])
            for seg in segs:
                ri = seg.get('render_index', 0)
                if ri &gt; max_render_index:
                    max_render_index = ri

        segment = {
            "caption_info": None,
            "cartoon": False,
            "clip": {
                "alpha": 1.0,
                "flip": {"horizontal": False, "vertical": False},
                "rotation": 0.0,
                "scale": {"x": 1.0, "y": 1.0},
                "transform": {"x": style.positionX, "y": style.positionY}
            },
            "common_keyframes": [],
            "enable_adjust": False,
            "enable_color_correct_adjust": False,
            "enable_color_curves": True,
            "enable_color_match_adjust": False,
            "enable_color_wheels": True,
            "enable_lut": False,
            "enable_smart_color_adjust": False,
            "extra_material_refs": [],
            "group_id": "",
            "hdr_settings": None,
            "id": seg_id,
            "intensifies_audio": False,
            "is_placeholder": False,
            "is_tone_modify": False,
            "keyframe_refs": [],
            "last_nonzero_volume": 1.0,
            "material_id": text_mat_id,
            "render_index": max_render_index + 1,
            "responsive_layout": {
                "enable": False,
                "horizontal_pos_layout": 0,
                "size_layout": 0,
                "target_follow": "",
                "vertical_pos_layout": 0
            },
            "reverse": False,
            "source_timerange": None,
            "speed": 1.0,
            "target_timerange": {"duration": duration_us, "start": start_us},
            "template_id": "",
            "template_scene": "default",
            "track_attribute": 0,
            "track_render_index": 0,
            "uniform_scale": {"on": True, "value": 1.0},
            "visible": True,
            "volume": 1.0
        }

        # 添加关键帧（水印）
        if add_keyframes and watermark_style:
            segment["common_keyframes"] = self._create_watermark_keyframes(
                watermark_style, duration_us
            )

        # 找到或创建文本轨道
        text_track = None
        for track in tracks:
            if track.get('type') == 'text':
                text_track = track
                break

        if not text_track:
            # 创建新的文本轨道
            text_track = {
                "id": str(uuid.uuid4()).upper(),
                "is_mute": 0,
                "name": "text_track",
                "prev_seg_id": "",
                "relative_index": 999,
                "render_index": 999,
                "segments": [],
                "type": "text"
            }
            self.data['tracks'].append(text_track)

        text_track['segments'].append(segment)

    def _create_watermark_keyframes(self, style: WatermarkStyleConfig, duration_us: int) -&gt; List[Dict]:
        """创建水印关键帧"""
        kf_list = []

        # 位置 X 关键帧
        kf_list.append({
            "id": str(uuid.uuid4()).upper(),
            "keyframe_list": [
                {
                    "curveType": "Line",
                    "graphID": "",
                    "id": str(uuid.uuid4()).upper(),
                    "left_control": {"x": 0.0, "y": 0.0},
                    "right_control": {"x": 0.0, "y": 0.0},
                    "time_offset": 0,
                    "values": [style.startPositionX]
                },
                {
                    "curveType": "Line",
                    "graphID": "",
                    "id": str(uuid.uuid4()).upper(),
                    "left_control": {"x": 0.0, "y": 0.0},
                    "right_control": {"x": 0.0, "y": 0.0},
                    "time_offset": duration_us,
                    "values": [style.endPositionX]
                }
            ],
            "material_id": "",
            "property_type": "KFTypePositionX"
        })

        # 位置 Y 关键帧
        kf_list.append({
            "id": str(uuid.uuid4()).upper(),
            "keyframe_list": [
                {
                    "curveType": "Line",
                    "graphID": "",
                    "id": str(uuid.uuid4()).upper(),
                    "left_control": {"x": 0.0, "y": 0.0},
                    "right_control": {"x": 0.0, "y": 0.0},
                    "time_offset": 0,
                    "values": [style.startPositionY]
                },
                {
                    "curveType": "Line",
                    "graphID": "",
                    "id": str(uuid.uuid4()).upper(),
                    "left_control": {"x": 0.0, "y": 0.0},
                    "right_control": {"x": 0.0, "y": 0.0},
                    "time_offset": duration_us,
                    "values": [style.endPositionY]
                }
            ],
            "material_id": "",
            "property_type": "KFTypePositionY"
        })

        # Scale X 关键帧
        kf_list.append({
            "id": str(uuid.uuid4()).upper(),
            "keyframe_list": [
                {
                    "curveType": "Line",
                    "graphID": "",
                    "id": str(uuid.uuid4()).upper(),
                    "left_control": {"x": 0.0, "y": 0.0},
                    "right_control": {"x": 0.0, "y": 0.0},
                    "time_offset": 0,
                    "values": [1.0]
                },
                {
                    "curveType": "Line",
                    "graphID": "",
                    "id": str(uuid.uuid4()).upper(),
                    "left_control": {"x": 0.0, "y": 0.0},
                    "right_control": {"x": 0.0, "y": 0.0},
                    "time_offset": duration_us,
                    "values": [1.0]
                }
            ],
            "material_id": "",
            "property_type": "KFTypeScaleX"
        })

        # Rotation 关键帧
        kf_list.append({
            "id": str(uuid.uuid4()).upper(),
            "keyframe_list": [
                {
                    "curveType": "Line",
                    "graphID": "",
                    "id": str(uuid.uuid4()).upper(),
                    "left_control": {"x": 0.0, "y": 0.0},
                    "right_control": {"x": 0.0, "y": 0.0},
                    "time_offset": 0,
                    "values": [0.0]
                },
                {
                    "curveType": "Line",
                    "graphID": "",
                    "id": str(uuid.uuid4()).upper(),
                    "left_control": {"x": 0.0, "y": 0.0},
                    "right_control": {"x": 0.0, "y": 0.0},
                    "time_offset": duration_us,
                    "values": [0.0]
                }
            ],
            "material_id": "",
            "property_type": "KFTypeRotation"
        })

        return kf_list

    def _hex_to_rgb(self, hex_color: str) -&gt; List[float]:
        """将 HEX 颜色转换为 RGB 三元组"""
        hex_color = hex_color.lstrip('#')
        if len(hex_color) == 3:
            hex_color = ''.join([c * 2 for c in hex_color])
        r = int(hex_color[0:2], 16) / 255.0
        g = int(hex_color[2:4], 16) / 255.0
        b = int(hex_color[4:6], 16) / 255.0
        return [r, g, b]

    def add_cover_image(self, image_path: str, duration: float = 3.0):
        """添加封面图片（TODO：待完善）"""
        logger.info("Cover image feature not fully implemented yet")
        pass

    def add_text(self, content: str, style: TextStyleConfig, duration_us: int):
        """添加文本片段"""
        if not content.strip():
            return
        self._add_text_segment_direct(content, style, duration_us)
        logger.info(f"Added text: {content[:50]}...")

    def add_watermark(self, content: str, style: WatermarkStyleConfig, duration_us: int):
        """添加水印（带动画）"""
        if not content.strip():
            return
        self._add_text_segment_direct(
            content, style, duration_us,
            add_keyframes=True, watermark_style=style
        )
        logger.info(f"Added watermark: {content[:50]}...")

    def add_background_music(self, music_path: str, volume: float,
                               fade_in: float, fade_out: float,
                               target_duration_us: int):
        """添加配乐（TODO：待完善）"""
        logger.info("Background music feature not fully implemented yet")
        pass

    def apply(self, config: DraftAdjustmentConfig):
        """应用所有调整"""
        total_duration_us = self._get_total_duration_us()
        logger.info(f"Applying adjustments, total duration: {total_duration_us / 1_000_000:.2f}s")

        # 封面
        if config.coverImagePath:
            self.add_cover_image(config.coverImagePath, config.coverDuration)

        # 封面标题
        if config.coverTitleEnabled and config.coverTitle:
            self.add_text(config.coverTitle, config.coverTitleStyle, total_duration_us)

        # 文本
        if config.textEnabled and config.textContent:
            self.add_text(config.textContent, config.textStyle, total_duration_us)

        # 水印
        if config.watermarkEnabled and config.watermarkText:
            self.add_watermark(config.watermarkText, config.watermarkStyle, total_duration_us)

        # 配乐
        if config.bgMusicEnabled and config.bgMusicPath:
            self.add_background_music(
                config.bgMusicPath,
                config.bgMusicVolume,
                config.bgMusicFadeInDuration,
                config.bgMusicFadeOutDuration,
                total_duration_us
            )

        self._save()
        logger.info("Draft adjustments applied and saved")
```

- [ ] **Step 2: 验证文件创建**

- [ ] **Step 3: Commit**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add backend/core/draft_adjuster.py
git commit -m "feat: add DraftAdjuster core class with text and watermark support"
```

---

## Task 3: 创建后端 API

**Files:**
- Create: `backend/api/draft_adjust.py`
- Modify: `backend/main.py`

- [ ] **Step 1: 创建 draft_adjust.py API 文件**

```python
from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import shutil
import logging
import uuid

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


@router.post("/upload-cover")
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


@router.post("/upload-music")
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

- [ ] **Step 2: 在 main.py 中注册路由**

在 `backend/main.py` 中，添加：

```python
from api import draft_adjust
```

并在 `app.include_router()` 部分添加：

```python
app.include_router(draft_adjust.router)
```

- [ ] **Step 3: 验证文件修改**

- [ ] **Step 4: Commit**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add backend/api/draft_adjust.py backend/main.py
git commit -m "feat: add draft adjustment API endpoints"
```

---

## Task 4: 添加前端 API 类型和方法

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: 在 api.ts 中添加草稿调整相关类型**

在文件末尾（stylePromptsApi 之后）添加：

```typescript
// ===== Draft Adjustment API =====
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

export const draftAdjustApi = {
  loadDraft: (data: LoadDraftRequest) =&gt;
    api.post&lt;LoadDraftResponse&gt;('/draft-adjust/load', data),

  uploadCover: (file: File) =&gt; {
    const formData = new FormData();
    formData.append('file', file);
    return api.post&lt;{ path: string }&gt;('/draft-adjust/upload-cover', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  uploadMusic: (file: File) =&gt; {
    const formData = new FormData();
    formData.append('file', file);
    return api.post&lt;{ path: string }&gt;('/draft-adjust/upload-music', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  apply: (data: ApplyDraftAdjustmentRequest) =&gt;
    api.post&lt;ApplyDraftAdjustmentResponse&gt;('/draft-adjust/apply', data),
};
```

同时在文件开头的 export 部分添加这些类型：

```typescript
export type {
  // ... 现有类型 ...
  TextStyleConfig,
  WatermarkStyleConfig,
  DraftAdjustmentConfig,
  LoadDraftRequest,
  LoadDraftResponse,
  ApplyDraftAdjustmentRequest,
  ApplyDraftAdjustmentResponse,
};
```

并且在末尾的 export 部分添加：

```typescript
export {
  // ... 现有导出 ...
  draftAdjustApi,
};
```

- [ ] **Step 2: 验证文件修改**

- [ ] **Step 3: Commit**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add frontend/src/services/api.ts
git commit -m "feat: add draft adjustment frontend API types and methods"
```

---

## Task 5: 创建 DraftAdjustmentModal 组件

**Files:**
- Create: `frontend/src/components/DraftAdjustmentModal.tsx`

- [ ] **Step 1: 创建 DraftAdjustmentModal.tsx 组件**

```tsx
import React, { useState } from 'react';
import { Modal } from './common/Modal';
import {
  draftAdjustApi,
  type Project,
  type DraftAdjustmentConfig,
  type TextStyleConfig,
  type WatermarkStyleConfig,
} from '../services/api';

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

const defaultConfig: DraftAdjustmentConfig = {
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
};

interface DraftAdjustmentModalProps {
  isOpen: boolean;
  onClose: () =&gt; void;
  project: Project;
}

export const DraftAdjustmentModal: React.FC&lt;DraftAdjustmentModalProps&gt; = ({
  isOpen,
  onClose,
  project,
}) =&gt; {
  const [draftPath, setDraftPath] = useState('');
  const [draftInfo, setDraftInfo] = useState&lt;{
    success: boolean;
    draftName: string;
    duration: number;
    trackCount: number;
    error?: string;
  } | null&gt;(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [config, setConfig] = useState&lt;DraftAdjustmentConfig&gt;({ ...defaultConfig });

  const handleLoadDraft = async () =&gt; {
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

  const handleApply = async () =&gt; {
    if (!draftPath || !draftInfo?.success) return;
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

  const handleReset = () =&gt; {
    setDraftPath('');
    setDraftInfo(null);
    setConfig({ ...defaultConfig });
  };

  return (
    &lt;Modal isOpen={isOpen} onClose={onClose} title="草稿调整" size="xl"&gt;
      &lt;div className="space-y-4 max-h-[80vh] overflow-y-auto"&gt;
        {/* 草稿选择 */}
        &lt;div&gt;
          &lt;label className="block text-sm font-medium mb-1"&gt;剪映草稿路径&lt;/label&gt;
          &lt;div className="flex gap-2"&gt;
            &lt;input
              type="text"
              value={draftPath}
              onChange={(e) =&gt; setDraftPath(e.target.value)}
              className="flex-1 px-3 py-2 border rounded"
              placeholder="/path/to/JianyingPro Drafts/MyDraft"
            /&gt;
            &lt;button
              onClick={handleLoadDraft}
              disabled={!draftPath || loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            &gt;
              {loading ? '加载中...' : '加载'}
            &lt;/button&gt;
          &lt;/div&gt;
        &lt;/div&gt;

        {/* 草稿信息 */}
        {draftInfo &amp;&amp; (
          &lt;div className={`p-4 rounded ${draftInfo.success ? 'bg-green-50' : 'bg-red-50'}`}&gt;
            {draftInfo.success ? (
              &lt;div className="grid grid-cols-3 gap-4"&gt;
                &lt;div&gt;
                  &lt;span className="text-gray-500"&gt;草稿名称:&lt;/span&gt;{' '}
                  &lt;span className="font-medium"&gt;{draftInfo.draftName}&lt;/span&gt;
                &lt;/div&gt;
                &lt;div&gt;
                  &lt;span className="text-gray-500"&gt;时长:&lt;/span&gt;{' '}
                  &lt;span className="font-medium"&gt;{draftInfo.duration.toFixed(1)}秒&lt;/span&gt;
                &lt;/div&gt;
                &lt;div&gt;
                  &lt;span className="text-gray-500"&gt;轨道数:&lt;/span&gt;{' '}
                  &lt;span className="font-medium"&gt;{draftInfo.trackCount}&lt;/span&gt;
                &lt;/div&gt;
              &lt;/div&gt;
            ) : (
              &lt;div className="text-red-600"&gt;
                加载失败: {draftInfo.error}
              &lt;/div&gt;
            )}
          &lt;/div&gt;
        )}

        {draftInfo?.success &amp;&amp; (
          &lt;&gt;
            {/* 封面标题 */}
            &lt;div className="border-t pt-4"&gt;
              &lt;label className="flex items-center gap-2"&gt;
                &lt;input
                  type="checkbox"
                  checked={config.coverTitleEnabled}
                  onChange={(e) =&gt; setConfig({ ...config, coverTitleEnabled: e.target.checked })}
                /&gt;
                &lt;span className="font-medium"&gt;添加封面标题&lt;/span&gt;
              &lt;/label&gt;
              {config.coverTitleEnabled &amp;&amp; (
                &lt;div className="mt-3 space-y-3"&gt;
                  &lt;input
                    type="text"
                    value={config.coverTitle}
                    onChange={(e) =&gt; setConfig({ ...config, coverTitle: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="输入标题..."
                  /&gt;
                &lt;/div&gt;
              )}
            &lt;/div&gt;

            {/* 文本 */}
            &lt;div className="border-t pt-4"&gt;
              &lt;label className="flex items-center gap-2"&gt;
                &lt;input
                  type="checkbox"
                  checked={config.textEnabled}
                  onChange={(e) =&gt; setConfig({ ...config, textEnabled: e.target.checked })}
                /&gt;
                &lt;span className="font-medium"&gt;添加文本&lt;/span&gt;
              &lt;/label&gt;
              {config.textEnabled &amp;&amp; (
                &lt;div className="mt-3 space-y-3"&gt;
                  &lt;textarea
                    value={config.textContent}
                    onChange={(e) =&gt; setConfig({ ...config, textContent: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    rows={3}
                    placeholder="输入文本..."
                  /&gt;
                &lt;/div&gt;
              )}
            &lt;/div&gt;

            {/* 水印 */}
            &lt;div className="border-t pt-4"&gt;
              &lt;label className="flex items-center gap-2"&gt;
                &lt;input
                  type="checkbox"
                  checked={config.watermarkEnabled}
                  onChange={(e) =&gt; setConfig({ ...config, watermarkEnabled: e.target.checked })}
                /&gt;
                &lt;span className="font-medium"&gt;添加水印&lt;/span&gt;
              &lt;/label&gt;
              {config.watermarkEnabled &amp;&amp; (
                &lt;div className="mt-3 space-y-3"&gt;
                  &lt;input
                    type="text"
                    value={config.watermarkText}
                    onChange={(e) =&gt; setConfig({ ...config, watermarkText: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="@用户名"
                  /&gt;
                &lt;/div&gt;
              )}
            &lt;/div&gt;

            {/* 配乐 */}
            &lt;div className="border-t pt-4"&gt;
              &lt;label className="flex items-center gap-2"&gt;
                &lt;input
                  type="checkbox"
                  checked={config.bgMusicEnabled}
                  onChange={(e) =&gt; setConfig({ ...config, bgMusicEnabled: e.target.checked })}
                /&gt;
                &lt;span className="font-medium"&gt;添加配乐&lt;/span&gt;
                &lt;span className="text-gray-400 text-sm ml-2"&gt;(待实现)&lt;/span&gt;
              &lt;/label&gt;
            &lt;/div&gt;
          &lt;/&gt;
        )}
      &lt;/div&gt;

      &lt;div className="flex justify-between mt-6 pt-4 border-t"&gt;
        &lt;button
          onClick={handleReset}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        &gt;
          重置
        &lt;/button&gt;
        &lt;div className="flex gap-3"&gt;
          &lt;button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50"&gt;
            取消
          &lt;/button&gt;
          &lt;button
            onClick={handleApply}
            disabled={!draftInfo?.success || applying}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          &gt;
            {applying ? '应用中...' : '应用调整'}
          &lt;/button&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/Modal&gt;
  );
};
```

- [ ] **Step 2: 验证文件创建**

- [ ] **Step 3: Commit**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add frontend/src/components/DraftAdjustmentModal.tsx
git commit -m "feat: add DraftAdjustmentModal component"
```

---

## Task 6: 在解压视频编辑器中集成

**Files:**
- Modify: `frontend/src/pages/DecompressionVideoEditor.tsx`

- [ ] **Step 1: 导入 DraftAdjustmentModal 组件**

在文件顶部导入部分添加：

```typescript
import { DraftAdjustmentModal } from '../components/DraftAdjustmentModal';
```

- [ ] **Step 2: 添加状态和按钮**

在组件内部添加：

```typescript
const [showDraftAdjustModal, setShowDraftAdjustModal] = useState(false);
```

在"导出交付"步骤区域，添加"草稿调整"按钮：

```tsx
&lt;button
  onClick={() =&gt; setShowDraftAdjustModal(true)}
  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
&gt;
  草稿调整
&lt;/button&gt;
```

- [ ] **Step 3: 添加 Modal**

在组件末尾的 JSX 中添加：

```tsx
&lt;DraftAdjustmentModal
  isOpen={showDraftAdjustModal}
  onClose={() =&gt; setShowDraftAdjustModal(false)}
  project={project}
/&gt;
```

- [ ] **Step 4: 验证文件修改**

- [ ] **Step 5: Commit**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add frontend/src/pages/DecompressionVideoEditor.tsx
git commit -m "feat: integrate draft adjustment modal in decompression editor"
```

---

## Task 7: 测试和完善

**Files:**
- Test: 手动功能测试

- [ ] **Step 1: 启动后端服务**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic/backend
source venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- [ ] **Step 2: 启动前端服务**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic/frontend
npm run dev
```

- [ ] **Step 3: 测试文本和水印功能**

- 加载一个已导出的剪映草稿
- 添加封面标题
- 添加文本
- 添加水印
- 应用调整
- 在剪映中打开验证

- [ ] **Step 4: 修复发现的问题**

根据测试结果修复任何问题。

- [ ] **Step 5: Commit fixes (if needed)**

```bash
cd /Users/wyf-mac/Documents/code/claudecode/novelcomic
git add &lt;modified-files&gt;
git commit -m "fix: adjust draft adjustment feature based on testing"
```

---

## Plan Complete

Plan written and saved to `docs/superpowers/plans/2026-03-30-draft-adjustment.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
