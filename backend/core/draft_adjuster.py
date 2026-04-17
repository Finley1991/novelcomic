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

    def get_draft_info(self) -> Dict[str, Any]:
        """获取草稿信息"""
        duration_us = self.data.get('duration', 0)
        tracks = self.data.get('tracks', [])
        return {
            'draftName': self.data.get('name', ''),
            'duration': duration_us / 1_000_000,
            'trackCount': len(tracks)
        }

    def _get_total_duration_us(self) -> int:
        """获取草稿总时长（微秒）"""
        return self.data.get('duration', 0)

    def _add_text_segment_direct(self, content: str, style: TextStyleConfig,
                                   duration_us: int, start_us: int = 0,
                                   add_keyframes: bool = False,
                                   watermark_style: Optional[WatermarkStyleConfig] = None):
        """直接在 JSON 中添加文本片段（绕过 pyJianYingDraft 的限制）"""

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
        if style.strokeColor and style.strokeWidth > 0:
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
                if ri > max_render_index:
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

    def _create_watermark_keyframes(self, style: WatermarkStyleConfig, duration_us: int) -> List[Dict]:
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

    def _hex_to_rgb(self, hex_color: str) -> List[float]:
        """将 HEX 颜色转换为 RGB 三元组"""
        hex_color = hex_color.lstrip('#')
        if len(hex_color) == 3:
            hex_color = ''.join([c * 2 for c in hex_color])
        r = int(hex_color[0:2], 16) / 255.0
        g = int(hex_color[2:4], 16) / 255.0
        b = int(hex_color[4:6], 16) / 255.0
        return [r, g, b]

    def add_cover_image(self, image_path: str, duration: float = 3.0):
        """添加封面图片"""
        src_path = Path(image_path)
        if not src_path.exists():
            logger.error(f"Cover image not found: {image_path}")
            return

        duration_us = int(duration * 1_000_000)
        logger.info(f"Adding cover image: {image_path}, duration: {duration}s")

        # 复制图片到草稿目录
        ext = src_path.suffix or ".png"
        cover_id = uuid.uuid4().hex.replace('-', '')
        dst_path = self.draft_path / f"cover_{cover_id}{ext}"
        shutil.copy2(src_path, dst_path)

        # 创建视频素材（图片在剪映中作为视频素材处理）
        video_mat_id = uuid.uuid4().hex.replace('-', '')

        # 先检查是否有其他视频素材来获取参考结构
        reference_material = None
        if 'materials' in self.data and 'videos' in self.data['materials']:
            videos = self.data['materials']['videos']
            if videos:
                reference_material = videos[0]

        if reference_material:
            # 基于参考素材创建新素材
            video_material = reference_material.copy()
            video_material['id'] = video_mat_id
            video_material['file_Path'] = str(dst_path.name)
            video_material['path'] = str(dst_path)

            # 获取图片实际时长（图片通常时长很大）
            if 'duration' in video_material:
                video_material['duration'] = 10800000000  # 3小时
        else:
            # 创建基本的视频素材结构
            video_material = {
                "id": video_mat_id,
                "file_Path": str(dst_path.name),
                "path": str(dst_path),
                "type": "video",
                "duration": 10800000000,
                "width": 1080,
                "height": 1920
            }

        # 添加到 materials.videos
        if 'materials' not in self.data:
            self.data['materials'] = {}
        if 'videos' not in self.data['materials']:
            self.data['materials']['videos'] = []
        self.data['materials']['videos'].append(video_material)

        # 创建视频片段（在开头）
        seg_id = str(uuid.uuid4()).upper()

        # 计算最大 render_index
        max_render_index = 0
        tracks = self.data.get('tracks', [])
        for track in tracks:
            segs = track.get('segments', [])
            for seg in segs:
                ri = seg.get('render_index', 0)
                if ri > max_render_index:
                    max_render_index = ri

        segment = {
            "clip": {
                "alpha": 1.0,
                "flip": {"horizontal": False, "vertical": False},
                "rotation": 0.0,
                "scale": {"x": 1.0, "y": 1.0},
                "transform": {"x": 0.0, "y": 0.0}
            },
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
            "material_id": video_mat_id,
            "render_index": max_render_index + 1,
            "responsive_layout": {
                "enable": False,
                "horizontal_pos_layout": 0,
                "size_layout": 0,
                "target_follow": "",
                "vertical_pos_layout": 0
            },
            "reverse": False,
            "source_timerange": {"duration": duration_us, "start": 0},
            "speed": 1.0,
            "target_timerange": {"duration": duration_us, "start": 0},
            "template_id": "",
            "template_scene": "default",
            "track_attribute": 0,
            "track_render_index": 0,
            "uniform_scale": {"on": True, "value": 1.0},
            "visible": True,
            "volume": 1.0
        }

        # 找到或创建视频轨道
        video_track = None
        for track in tracks:
            if track.get('type') == 'video':
                video_track = track
                break

        if not video_track:
            # 创建新的视频轨道
            video_track = {
                "id": str(uuid.uuid4()).upper(),
                "is_mute": 0,
                "name": "video_track",
                "prev_seg_id": "",
                "relative_index": 0,
                "render_index": 0,
                "segments": [],
                "type": "video"
            }
            self.data['tracks'].insert(0, video_track)

        # 插入到片段列表开头
        video_track['segments'].insert(0, segment)

        # 更新其他所有片段的时间（向后推移封面时长）
        for track in tracks:
            if track is not video_track:
                segs = track.get('segments', [])
                for seg in segs:
                    tr = seg.get('target_timerange', {})
                    if 'start' in tr:
                        tr['start'] += duration_us

        # 更新总时长
        if 'duration' in self.data:
            self.data['duration'] += duration_us

        logger.info(f"Cover image added successfully")

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
        """添加配乐"""
        src_path = Path(music_path)
        if not src_path.exists():
            logger.error(f"Music file not found: {music_path}")
            return

        logger.info(f"Adding background music: {music_path}, volume: {volume}")

        # 复制音频到草稿目录
        ext = src_path.suffix or ".mp3"
        music_id = uuid.uuid4().hex.replace('-', '')
        dst_path = self.draft_path / f"bgm_{music_id}{ext}"
        shutil.copy2(src_path, dst_path)

        # 创建音频素材
        audio_mat_id = uuid.uuid4().hex.replace('-', '')

        # 先检查是否有其他音频素材来获取参考结构
        reference_material = None
        if 'materials' in self.data and 'audios' in self.data['materials']:
            audios = self.data['materials']['audios']
            if audios:
                reference_material = audios[0]

        if reference_material:
            # 基于参考素材创建新素材
            audio_material = reference_material.copy()
            audio_material['id'] = audio_mat_id
            audio_material['file_Path'] = str(dst_path.name)
            audio_material['path'] = str(dst_path)
        else:
            # 创建基本的音频素材结构
            audio_material = {
                "id": audio_mat_id,
                "file_Path": str(dst_path.name),
                "path": str(dst_path),
                "type": "audio"
            }

        # 添加到 materials.audios
        if 'materials' not in self.data:
            self.data['materials'] = {}
        if 'audios' not in self.data['materials']:
            self.data['materials']['audios'] = []
        self.data['materials']['audios'].append(audio_material)

        # 获取音频素材时长（需要读取实际音频文件信息）
        # 先尝试获取素材时长，默认 10 分钟
        audio_duration_us = 600_000_000  # 默认 10 分钟
        if 'duration' in audio_material:
            audio_duration_us = audio_material['duration']

        # 创建音频片段，循环填充直到目标时长
        current_start_us = 0
        tracks = self.data.get('tracks', [])

        # 计算最大 render_index
        max_render_index = 0
        for track in tracks:
            segs = track.get('segments', [])
            for seg in segs:
                ri = seg.get('render_index', 0)
                if ri > max_render_index:
                    max_render_index = ri

        # 找到或创建音频轨道（用于配乐）
        bgm_track = None
        for track in tracks:
            if track.get('type') == 'audio' and 'bgm' in track.get('name', '').lower():
                bgm_track = track
                break

        if not bgm_track:
            # 创建新的配乐音频轨道
            bgm_track = {
                "id": str(uuid.uuid4()).upper(),
                "is_mute": 0,
                "name": "bgm_track",
                "prev_seg_id": "",
                "relative_index": 1,
                "render_index": 1,
                "segments": [],
                "type": "audio"
            }
            self.data['tracks'].append(bgm_track)

        # 循环添加音频片段直到覆盖目标时长
        segment_index = 0
        while current_start_us < target_duration_us:
            remaining_duration = target_duration_us - current_start_us
            use_duration = min(audio_duration_us, remaining_duration)

            seg_id = str(uuid.uuid4()).upper()

            segment = {
                "clip": {
                    "alpha": 1.0,
                    "flip": {"horizontal": False, "vertical": False},
                    "rotation": 0.0,
                    "scale": {"x": 1.0, "y": 1.0},
                    "transform": {"x": 0.0, "y": 0.0}
                },
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
                "material_id": audio_mat_id,
                "render_index": max_render_index + 1 + segment_index,
                "responsive_layout": {
                    "enable": False,
                    "horizontal_pos_layout": 0,
                    "size_layout": 0,
                    "target_follow": "",
                    "vertical_pos_layout": 0
                },
                "reverse": False,
                "source_timerange": {"duration": use_duration, "start": 0},
                "speed": 1.0,
                "target_timerange": {"duration": use_duration, "start": current_start_us},
                "template_id": "",
                "template_scene": "default",
                "track_attribute": 0,
                "track_render_index": 0,
                "uniform_scale": {"on": True, "value": 1.0},
                "visible": True,
                "volume": volume
            }

            # 添加淡入淡出（TODO：完整的淡入淡出需要关键帧，这里先设置固定音量）
            # 如果是第一个片段，添加淡入
            # 如果是最后一个片段，添加淡出

            bgm_track['segments'].append(segment)
            current_start_us += use_duration
            segment_index += 1

        logger.info(f"Background music added successfully, {segment_index} segments")

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
