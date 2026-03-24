import json
import shutil
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional
import uuid

from config import settings
from models.schemas import Project, Storyboard

logger = logging.getLogger(__name__)


class JianyingExporter:
    """剪映草稿导出器"""

    def __init__(self, template_dir: Path, draft_base_path: Path):
        """
        初始化导出器

        Args:
            template_dir: 剪映模板目录路径
            draft_base_path: 剪映草稿保存基础路径
        """
        self.template_dir = template_dir
        self.draft_base_path = draft_base_path

    def export_project(self, project: Project, project_dir: Path) -> Dict[str, str]:
        """
        导出项目为剪映草稿

        Args:
            project: 项目数据
            project_dir: 项目文件目录

        Returns:
            包含 draft_id 和 draft_path 的字典
        """
        # 生成草稿 ID
        draft_id = f"{project.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        draft_dir = self.draft_base_path / draft_id

        logger.info(f"开始导出项目 {project.id} 到剪映草稿 {draft_id}")

        try:
            # 1. 创建草稿目录并复制模板
            self._copy_template(draft_dir)

            # 2. 复制素材文件
            materials_map = self._copy_materials(project, project_dir, draft_dir)

            # 3. 修改 draft_content.json
            self._modify_draft_content(draft_dir, project, materials_map, draft_id)

            logger.info(f"成功导出项目 {project.id} 到 {draft_dir}")

            return {
                "draft_id": draft_id,
                "draft_path": str(draft_dir)
            }

        except Exception as e:
            logger.error(f"导出失败: {e}", exc_info=True)
            # 清理部分创建的目录
            if draft_dir.exists():
                shutil.rmtree(draft_dir)
            raise

    def _copy_template(self, target_dir: Path):
        """复制模板文件到目标目录"""
        if target_dir.exists():
            shutil.rmtree(target_dir)

        shutil.copytree(self.template_dir, target_dir)
        logger.debug(f"已复制模板到 {target_dir}")

    def _copy_materials(self, project: Project, project_dir: Path, draft_dir: Path) -> Dict[str, Dict[str, str]]:
        """
        复制素材文件到草稿目录

        Returns:
            分镜 ID 到素材路径的映射
        """
        images_dir = draft_dir / "images"
        audio_dir = draft_dir / "audio"
        images_dir.mkdir(exist_ok=True)
        audio_dir.mkdir(exist_ok=True)

        materials_map = {}

        for storyboard in project.storyboards:
            sb_map = {}

            # 复制图片
            if storyboard.imagePath:
                src_img = project_dir / storyboard.imagePath
                if src_img.exists():
                    ext = src_img.suffix or ".jpg"
                    dst_img = images_dir / f"{storyboard.id}{ext}"
                    shutil.copy2(src_img, dst_img)
                    sb_map["image"] = f"images/{storyboard.id}{ext}"
                    logger.debug(f"已复制图片: {src_img} -> {dst_img}")

            # 复制音频
            if storyboard.audioPath:
                src_audio = project_dir / storyboard.audioPath
                if src_audio.exists():
                    ext = src_audio.suffix or ".wav"
                    dst_audio = audio_dir / f"{storyboard.id}{ext}"
                    shutil.copy2(src_audio, dst_audio)
                    sb_map["audio"] = f"audio/{storyboard.id}{ext}"
                    logger.debug(f"已复制音频: {src_audio} -> {dst_audio}")

            materials_map[storyboard.id] = sb_map

        return materials_map

    def _modify_draft_content(self, draft_dir: Path, project: Project, materials_map: Dict[str, Dict[str, str]], draft_id: str):
        """修改 draft_content.json 文件"""
        draft_content_path = draft_dir / "draft_content.json"

        with open(draft_content_path, 'r', encoding='utf-8') as f:
            draft_content = json.load(f)

        # 更新草稿 ID 和名称
        draft_content["id"] = str(uuid.uuid4()).upper()
        draft_content["name"] = project.name

        # 更新画布尺寸
        canvas_config = draft_content.get("canvas_config", {})
        canvas_config["width"] = settings.jianying_canvas_width
        canvas_config["height"] = settings.jianying_canvas_height
        canvas_config["ratio"] = "original"

        # 获取素材和轨道
        materials = draft_content.get("materials", {})
        tracks = draft_content.get("tracks", [])

        # 清空现有素材
        materials["videos"] = []
        materials["audios"] = []

        # 找到视频和音频轨道
        video_track = None
        audio_track = None
        for track in tracks:
            if track.get("type") == "video":
                video_track = track
            elif track.get("type") == "audio":
                audio_track = track

        # 清空轨道片段
        if video_track:
            video_track["segments"] = []
        if audio_track:
            audio_track["segments"] = []

        # 添加分镜素材和片段
        current_time = 0

        for storyboard in project.storyboards:
            sb_map = materials_map.get(storyboard.id, {})
            duration = int(max(storyboard.audioDuration, 3.0) * 1000000)  # 转换为微秒

            # 添加视频素材和片段
            if "image" in sb_map and video_track:
                video_material_id = str(uuid.uuid4()).upper()
                self._add_video_material(materials, video_material_id, sb_map["image"], draft_id)
                self._add_video_segment(video_track, video_material_id, current_time, duration)

            # 添加音频素材和片段
            if "audio" in sb_map and audio_track:
                audio_material_id = str(uuid.uuid4()).upper()
                self._add_audio_material(materials, audio_material_id, sb_map["audio"], draft_id, duration)
                self._add_audio_segment(audio_track, audio_material_id, current_time, duration)

            current_time += duration

        # 更新总时长
        draft_content["duration"] = current_time

        # 保存修改后的文件
        with open(draft_content_path, 'w', encoding='utf-8') as f:
            json.dump(draft_content, f, ensure_ascii=False, indent=2)

        logger.debug(f"已修改 draft_content.json")

    def _add_video_material(self, materials: Dict, material_id: str, path: str, draft_id: str):
        """添加视频素材"""
        materials["videos"].append({
            "aigc_type": "none",
            "audio_fade": None,
            "cartoon_path": "",
            "category_id": "",
            "category_name": "local",
            "check_flag": 63487,
            "crop": {
                "lower_left_x": 0.0,
                "lower_left_y": 1.0,
                "lower_right_x": 1.0,
                "lower_right_y": 1.0,
                "upper_left_x": 0.0,
                "upper_left_y": 0.0,
                "upper_right_x": 1.0,
                "upper_right_y": 0.0
            },
            "crop_ratio": "free",
            "crop_scale": 1.0,
            "duration": 10800000000,
            "extra_type_option": 0,
            "formula_id": "",
            "freeze": None,
            "has_audio": False,
            "height": settings.jianying_canvas_height,
            "id": material_id,
            "intensifies_audio_path": "",
            "intensifies_path": "",
            "is_ai_generate_content": False,
            "is_copyright": True,
            "is_text_edit_overdub": False,
            "is_unified_beauty_mode": False,
            "local_id": "",
            "local_material_id": "",
            "material_id": "",
            "material_name": Path(path).name,
            "material_url": "",
            "matting": {
                "flag": 0,
                "has_use_quick_brush": False,
                "has_use_quick_eraser": False,
                "interactiveTime": [],
                "path": "",
                "strokes": []
            },
            "media_path": "",
            "object_locked": None,
            "origin_material_id": "",
            "path": path,
            "picture_from": "none",
            "picture_set_category_id": "",
            "picture_set_category_name": "",
            "request_id": "",
            "reverse_intensifies_path": "",
            "reverse_path": "",
            "smart_motion": None,
            "source": 0,
            "source_platform": 0,
            "stable": {
                "matrix_path": "",
                "stable_level": 0,
                "time_range": {"duration": 0, "start": 0}
            },
            "team_id": "",
            "type": "photo",
            "video_algorithm": {
                "algorithms": [],
                "complement_frame_config": None,
                "deflicker": None,
                "gameplay_configs": [],
                "motion_blur_config": None,
                "noise_reduction": None,
                "path": "",
                "quality_enhance": None,
                "time_range": None
            },
            "width": settings.jianying_canvas_width
        })

    def _add_audio_material(self, materials: Dict, material_id: str, path: str, draft_id: str, duration: int):
        """添加音频素材"""
        materials["audios"].append({
            "app_id": 0,
            "category_id": "",
            "category_name": "local",
            "check_flag": 1,
            "copyright_limit_type": "none",
            "duration": duration,
            "effect_id": "",
            "formula_id": "",
            "id": material_id,
            "intensifies_path": "",
            "is_ai_clone_tone": False,
            "is_text_edit_overdub": False,
            "is_ugc": False,
            "local_material_id": str(uuid.uuid4()),
            "music_id": str(uuid.uuid4()),
            "name": Path(path).name,
            "path": path,
            "query": "",
            "request_id": "",
            "resource_id": "",
            "search_id": "",
            "source_from": "",
            "source_platform": 0,
            "team_id": "",
            "text_id": "",
            "tone_category_id": "",
            "tone_category_name": "",
            "tone_effect_id": "",
            "tone_effect_name": "",
            "tone_platform": "",
            "tone_second_category_id": "",
            "tone_second_category_name": "",
            "tone_speaker": "",
            "tone_type": "",
            "type": "extract_music",
            "video_id": "",
            "wave_points": []
        })

    def _add_video_segment(self, track: Dict, material_id: str, start: int, duration: int):
        """添加视频片段到轨道"""
        # 生成一些必需的 ID
        segment_id = str(uuid.uuid4()).upper()
        speed_id = str(uuid.uuid4()).upper()
        canvas_id = str(uuid.uuid4()).upper()

        track["segments"].append({
            "caption_info": None,
            "cartoon": False,
            "clip": {
                "alpha": 1.0,
                "flip": {"horizontal": False, "vertical": False},
                "rotation": 0.0,
                "scale": {"x": 1.0, "y": 1.0},
                "transform": {"x": 0.0, "y": 0.0}
            },
            "common_keyframes": [],
            "enable_adjust": True,
            "enable_color_correct_adjust": False,
            "enable_color_curves": True,
            "enable_color_match_adjust": False,
            "enable_color_wheels": True,
            "enable_lut": True,
            "enable_smart_color_adjust": False,
            "extra_material_refs": [speed_id, canvas_id],
            "group_id": "",
            "hdr_settings": {"intensity": 1.0, "mode": 1, "nits": 1000},
            "id": segment_id,
            "intensifies_audio": False,
            "is_placeholder": False,
            "is_tone_modify": False,
            "keyframe_refs": [],
            "last_nonzero_volume": 1.0,
            "material_id": material_id,
            "render_index": 0,
            "responsive_layout": {
                "enable": False,
                "horizontal_pos_layout": 0,
                "size_layout": 0,
                "target_follow": "",
                "vertical_pos_layout": 0
            },
            "reverse": False,
            "source_timerange": {"duration": duration, "start": 0},
            "speed": 1.0,
            "target_timerange": {"duration": duration, "start": start},
            "template_id": "",
            "template_scene": "default",
            "track_attribute": 0,
            "track_render_index": 1,
            "uniform_scale": {"on": True, "value": 1.0},
            "visible": True,
            "volume": 1.0
        })

    def _add_audio_segment(self, track: Dict, material_id: str, start: int, duration: int):
        """添加音频片段到轨道"""
        segment_id = str(uuid.uuid4()).upper()

        track["segments"].append({
            "caption_info": None,
            "cartoon": False,
            "clip": None,
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
            "id": segment_id,
            "intensifies_audio": False,
            "is_placeholder": False,
            "is_tone_modify": False,
            "keyframe_refs": [],
            "last_nonzero_volume": 1.0,
            "material_id": material_id,
            "render_index": 0,
            "responsive_layout": {
                "enable": False,
                "horizontal_pos_layout": 0,
                "size_layout": 0,
                "target_follow": "",
                "vertical_pos_layout": 0
            },
            "reverse": False,
            "source_timerange": {"duration": duration, "start": 0},
            "speed": 1.0,
            "target_timerange": {"duration": duration, "start": start + 200000},  # 音频稍微偏移一点
            "template_id": "",
            "template_scene": "default",
            "track_attribute": 0,
            "track_render_index": 0,
            "uniform_scale": None,
            "visible": True,
            "volume": 1.0
        })
