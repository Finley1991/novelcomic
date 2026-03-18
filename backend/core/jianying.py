import json
import uuid
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
import zipfile
import logging

from models.schemas import Project, Storyboard, MotionType
from config import settings

logger = logging.getLogger(__name__)

class JianyingGenerator:
    def __init__(self, project: Project, output_dir: Path):
        self.project = project
        self.output_dir = output_dir
        self.draft_id = str(uuid.uuid4()).upper()
        self.now = datetime.now()

    def generate(self) -> Path:
        draft_dir = self.output_dir / f"jianying_draft_{self.project.id[:8]}"
        if draft_dir.exists():
            shutil.rmtree(draft_dir)
        draft_dir.mkdir(parents=True)

        (draft_dir / "video").mkdir()
        (draft_dir / "image").mkdir()
        (draft_dir / "audio").mkdir()

        self._copy_assets(draft_dir)
        draft_content = self._build_draft_content(draft_dir)

        with open(draft_dir / "draft_content.json", "w", encoding="utf-8") as f:
            json.dump(draft_content, f, ensure_ascii=False)

        self._build_draft_meta(draft_dir)
        self._build_other_files(draft_dir)

        zip_path = self.output_dir / f"jianying_draft_{self.project.id[:8]}.zip"
        self._zip_directory(draft_dir, zip_path)

        shutil.rmtree(draft_dir)
        return zip_path

    def _copy_assets(self, draft_dir: Path):
        proj_dir = Path(settings.data_dir) / "projects" / self.project.id

        for sb in self.project.storyboards:
            if sb.imagePath:
                src_path = proj_dir / sb.imagePath
                if src_path.exists():
                    dst_name = f"{sb.id}.png"
                    shutil.copy2(src_path, draft_dir / "image" / dst_name)

            if sb.audioPath:
                src_path = proj_dir / sb.audioPath
                if src_path.exists():
                    dst_name = f"{sb.id}.wav"
                    shutil.copy2(src_path, draft_dir / "audio" / dst_name)

    def _build_draft_content(self, draft_dir: Path) -> Dict[str, Any]:
        materials_videos = []
        materials_audios = []
        materials_texts = []
        video_segments = []
        audio_segments = []
        text_segments = []

        current_time = 0

        for sb in self.project.storyboards:
            sb_material_id = str(uuid.uuid4()).upper()

            if sb.imagePath:
                img_path = Path(sb.imagePath)
                materials_videos.append({
                    "id": sb_material_id,
                    "type": "photo",
                    "path": f"##_draftpath_placeholder_{self.draft_id}_##/image/{sb.id}.png",
                    "media_path": "",
                    "local_id": "",
                    "has_audio": False,
                    "reverse_path": "",
                    "intensifies_path": "",
                    "reverse_intensifies_path": "",
                    "intensifies_audio_path": "",
                    "cartoon_path": "",
                    "width": settings.jianying_canvas_width,
                    "height": settings.jianying_canvas_height,
                    "category_id": "",
                    "category_name": "",
                    "material_id": "",
                    "material_name": f"{sb.id}.png",
                    "material_url": "",
                    "crop_ratio": "free",
                    "crop_scale": 1,
                    "extra_type_option": 0,
                    "source": 7,
                    "source_platform": 19,
                    "formula_id": "",
                    "check_flag": 65535,
                    "is_unified_beauty_mode": False,
                    "picture_from": "none",
                    "picture_set_category_id": "",
                    "picture_set_category_name": "",
                    "team_id": "",
                    "local_material_id": "",
                    "origin_material_id": "",
                    "request_id": "",
                    "has_sound_separated": False,
                    "is_text_edit_overdub": False,
                    "is_ai_generate_content": False,
                    "aigc_type": "none",
                    "is_copyright": False,
                    "aigc_history_id": "",
                    "aigc_item_id": "",
                    "local_material_from": "",
                    "beauty_body_preset_id": "",
                    "live_photo_cover_path": "",
                    "duration": 10800000000,
                    "live_photo_timestamp": -1,
                    "crop": {
                        "upper_left_x": 0,
                        "upper_left_y": 0,
                        "upper_right_x": 1,
                        "upper_right_y": 0,
                        "lower_left_x": 0,
                        "lower_left_y": 1,
                        "lower_right_x": 1,
                        "lower_right_y": 1
                    },
                    "audio_fade": None,
                    "stable": {
                        "stable_level": 0,
                        "matrix_path": "",
                        "time_range": {"start": 0, "duration": 0}
                    },
                    "matting": {
                        "path": "",
                        "has_use_quick_brush": False,
                        "has_use_quick_eraser": False,
                        "reverse": False,
                        "custom_matting_id": "",
                        "blendMode": 0,
                        "blendColor": "",
                        "flag": 0,
                        "expansion": 0,
                        "feather": 0,
                        "interactiveTime": [],
                        "strokes": []
                    },
                    "video_algorithm": {
                        "path": "",
                        "time_range": None,
                        "complement_frame_config": None,
                        "motion_blur_config": None,
                        "deflicker": None,
                        "noise_reduction": None,
                        "quality_enhance": None,
                        "super_resolution": None,
                        "smart_complement_frame": None,
                        "aigc_generate": None,
                        "mouth_shape_driver": None,
                        "ai_expression_driven": None,
                        "ai_motion_driven": None,
                        "algorithms": [],
                        "gameplay_configs": [],
                        "ai_background_configs": []
                    },
                    "object_locked": None,
                    "smart_motion": None,
                    "multi_camera_info": None,
                    "freeze": None,
                    "smart_match_info": {"type": 0, "query": "", "is_hd": False},
                    "beauty_face_preset_infos": []
                })

            duration = int((sb.audioDuration or 3.0) * 1000000)

            start_scale, end_scale, start_x, end_x, start_y, end_y = self._calculate_motion_params(sb, duration)
            motion_type = sb.motion.type if sb.motion else MotionType.NONE

            video_segments.append(self._build_video_segment(
                sb_material_id,
                current_time,
                duration,
                start_scale, end_scale, start_x, end_x, start_y, end_y,
                motion_type
            ))

            # 添加字幕文本
            text_content = sb.dialogue or sb.narration or ""
            if text_content and text_content.strip():
                text_material_id = str(uuid.uuid4()).upper()
                materials_texts.append(self._build_text_material(text_material_id, text_content))
                text_segments.append(self._build_text_segment(
                    text_material_id,
                    current_time,
                    duration
                ))

            if sb.audioPath:
                audio_material_id = str(uuid.uuid4()).upper()
                materials_audios.append(self._build_audio_material(
                    audio_material_id,
                    sb.id,
                    duration
                ))
                audio_segments.append(self._build_audio_segment(
                    audio_material_id,
                    current_time,
                    duration
                ))

            current_time += duration

        return {
            "id": self.draft_id,
            "version": 400000,
            "new_version": "127.0.0",
            "name": self.project.name,
            "fps": 30,
            "is_drop_frame_timecode": False,
            "color_space": -1,
            "render_index_track_mode_on": True,
            "free_render_index_mode_on": False,
            "static_cover_image_path": "",
            "source": "default",
            "path": "",
            "duration": current_time,
            "create_time": int(self.now.timestamp() * 1000000),
            "update_time": int(self.now.timestamp() * 1000000),
            "config": {
                "video_mute": False,
                "record_audio_last_index": 0,
                "extract_audio_last_index": 0,
                "original_sound_last_index": 0,
                "subtitle_recognition_id": "",
                "lyrics_recognition_id": "",
                "subtitle_sync": False,
                "lyrics_sync": False,
                "sticker_max_index": 0,
                "adjust_max_index": 0,
                "material_save_mode": 0,
                "maintrack_adsorb": False,
                "combination_max_index": 0,
                "multi_language_mode": "",
                "multi_language_main": "",
                "multi_language_current": "",
                "export_range": None,
                "zoom_info_params": None,
                "subtitle_keywords_config": None,
                "subtitle_taskinfo": [],
                "lyrics_taskinfo": [],
                "attachment_info": [],
                "system_font_list": [],
                "multi_language_list": []
            },
            "canvas_config": {
                "dom_width": 0,
                "dom_height": 0,
                "ratio": settings.jianying_canvas_ratio,
                "width": settings.jianying_canvas_width,
                "height": settings.jianying_canvas_height,
                "background": None
            },
            "group_container": None,
            "materials": {
                "videos": materials_videos,
                "audios": materials_audios,
                "images": [],
                "texts": materials_texts,
                "effects": [],
                "stickers": [],
                "transitions": [],
                "audio_effects": [],
                "audio_fades": [],
                "beats": [],
                "canvases": [],
                "speeds": [],
                "common_mask": [],
                "chromas": [],
                "text_templates": [],
                "realtime_denoises": [],
                "video_trackings": [],
                "hsl": [],
                "drafts": [],
                "color_curves": [],
                "primary_color_wheels": [],
                "log_color_wheels": [],
                "video_effects": [],
                "audio_balances": [],
                "handwrites": [],
                "manual_deformations": [],
                "plugin_effects": [],
                "sound_channel_mappings": [],
                "green_screens": [],
                "shapes": [],
                "material_colors": [],
                "digital_humans": [],
                "smart_crops": [],
                "ai_translates": [],
                "audio_track_indexes": [],
                "loudnesses": [],
                "vocal_beautifys": [],
                "vocal_separations": [],
                "smart_relights": [],
                "time_marks": [],
                "multi_language_refs": [],
                "flowers": [],
                "tail_leaders": [],
                "material_animations": [],
                "placeholders": [],
                "placeholder_infos": []
            },
            "keyframes": {
                "videos": [],
                "audios": [],
                "texts": [],
                "stickers": [],
                "filters": [],
                "adjusts": [],
                "handwrites": [],
                "effects": []
            },
            "platform": {
                "os": "Windows",
                "os_version": "10.0.22631",
                "app_version": "12.7.0",
                "app_source": "official",
                "device_id": "",
                "hard_disk_id": "",
                "mac_address": "",
                "app_id": 5
            },
            "last_modified_platform": {
                "os": "Windows",
                "os_version": "10.0.22631",
                "app_version": "12.7.0",
                "app_source": "official",
                "device_id": "",
                "hard_disk_id": "",
                "mac_address": "",
                "app_id": 5
            },
            "mutable_config": None,
            "cover": None,
            "retouch_cover": None,
            "extra_info": {
                "text_to_video": {
                    "version": "",
                    "type": 0,
                    "template_id": "",
                    "video_generator_type": 0,
                    "picture_set_id": "",
                    "recommend_info": {
                        "title": "",
                        "link": "",
                        "custom_title": "",
                        "event_id": 0,
                        "section_segment_relationship": []
                    },
                    "text": [],
                    "video": [],
                    "bgm": [],
                    "mismatch_audio_ids": []
                },
                "track_info": None,
                "subtitle_fragment_info_list": []
            },
            "time_marks": None,
            "tracks": [
                {
                    "id": str(uuid.uuid4()).upper(),
                    "type": "video",
                    "flag": 0,
                    "attribute": 0,
                    "name": "Screen",
                    "is_default_name": False,
                    "segments": video_segments
                },
                {
                    "id": str(uuid.uuid4()).upper(),
                    "type": "text",
                    "flag": 0,
                    "attribute": 0,
                    "name": "Subtitle",
                    "is_default_name": False,
                    "segments": text_segments
                },
                {
                    "id": str(uuid.uuid4()).upper(),
                    "type": "text",
                    "flag": 0,
                    "attribute": 0,
                    "name": "ScreenTitle",
                    "is_default_name": False,
                    "segments": []
                },
                {
                    "id": str(uuid.uuid4()).upper(),
                    "type": "audio",
                    "flag": 0,
                    "attribute": 0,
                    "name": "TTS",
                    "is_default_name": False,
                    "segments": audio_segments
                },
                {
                    "id": str(uuid.uuid4()).upper(),
                    "type": "audio",
                    "flag": 0,
                    "attribute": 0,
                    "name": "Music",
                    "is_default_name": False,
                    "segments": []
                }
            ],
            "keyframe_graph_list": [],
            "relationships": [],
            "lyrics_effects": []
        }

    def _calculate_motion_params(self, sb: Storyboard, duration_us: int):
        if not sb.motion:
            return 1.0, 1.0, 0.0, 0.0, 0.0, 0.0

        motion = sb.motion
        duration_scale = min(1.0, (duration_us / 1000000) / 5.0)

        start_scale = motion.startScale
        end_scale = motion.endScale
        start_x = motion.startX
        end_x = motion.endX * duration_scale
        start_y = motion.startY
        end_y = motion.endY * duration_scale

        return start_scale, end_scale, start_x, end_x, start_y, end_y

    def _build_video_segment(
        self,
        material_id: str,
        start_time: int,
        duration: int,
        start_scale: float, end_scale: float,
        start_x: float, end_x: float,
        start_y: float, end_y: float,
        motion_type: MotionType
    ) -> Dict[str, Any]:
        segment_id = str(uuid.uuid4()).upper()

        common_keyframes = []

        if motion_type == MotionType.PAN_LEFT and end_x != 0:
            common_keyframes.append(self._build_position_keyframe(segment_id, "KFTypePositionX", 0, duration, start_x, end_x))
        elif motion_type == MotionType.PAN_RIGHT and end_x != 0:
            common_keyframes.append(self._build_position_keyframe(segment_id, "KFTypePositionX", 0, duration, start_x, end_x))
        elif motion_type == MotionType.PAN_UP and end_y != 0:
            common_keyframes.append(self._build_position_keyframe(segment_id, "KFTypePositionY", 0, duration, start_y, end_y))
        elif motion_type == MotionType.PAN_DOWN and end_y != 0:
            common_keyframes.append(self._build_position_keyframe(segment_id, "KFTypePositionY", 0, duration, start_y, end_y))
        elif motion_type in [MotionType.ZOOM_IN, MotionType.ZOOM_OUT] and start_scale != end_scale:
            common_keyframes.append(self._build_scale_keyframe(segment_id, 0, duration, start_scale, end_scale))

        return {
            "id": segment_id,
            "desc": "",
            "state": 0,
            "speed": 1.0,
            "is_loop": False,
            "is_tone_modify": False,
            "reverse": False,
            "intensifies_audio": False,
            "cartoon": False,
            "volume": 1,
            "last_nonzero_volume": 1,
            "material_id": material_id,
            "render_index": 1,
            "enable_lut": True,
            "enable_adjust": True,
            "enable_hsl": True,
            "visible": True,
            "group_id": "",
            "enable_color_curves": True,
            "track_render_index": 1,
            "enable_color_wheels": True,
            "track_attribute": 0,
            "is_placeholder": False,
            "template_id": "",
            "enable_smart_color_adjust": False,
            "template_scene": "default",
            "enable_color_match_adjust": False,
            "enable_color_correct_adjust": False,
            "enable_adjust_mask": True,
            "raw_segment_id": "",
            "enable_video_mask": True,
            "offset": 0,
            "source_timerange": {
                "start": 0,
                "duration": duration
            },
            "target_timerange": {
                "start": start_time,
                "duration": duration
            },
            "render_timerange": {
                "start": 0,
                "duration": 0
            },
            "clip": {
                "rotation": 0,
                "alpha": 1,
                "scale": {"x": start_scale, "y": start_scale},
                "transform": {"x": start_x, "y": start_y},
                "flip": {"vertical": False, "horizontal": False}
            },
            "hdr_settings": {
                "mode": 1,
                "intensity": 1.0,
                "nits": 1000
            },
            "caption_info": None,
            "responsive_layout": {
                "enable": False,
                "size_layout": 0,
                "vertical_pos_layout": 0,
                "horizontal_pos_layout": 0,
                "target_follow": ""
            },
            "lyric_keyframes": None,
            "extra_material_refs": [],
            "keyframe_refs": [],
            "common_keyframes": common_keyframes,
            "uniform_scale": {
                "on": True,
                "value": 1.0
            }
        }

    def _build_text_material(self, material_id: str, text: str) -> Dict[str, Any]:
        return {
            "recognize_task_id": "",
            "id": material_id,
            "name": "",
            "type": "text",
            "content": text,
            "base_content": text,
            "global_alpha": 1.0,
            "background_color": "#000000",
            "background_alpha": 0,
            "background_style": 0,
            "layer_weight": 4,
            "letter_spacing": 0,
            "line_spacing": 1.0,
            "has_shadow": False,
            "shadow_color": "#000000",
            "shadow_alpha": 0.5,
            "shadow_smoothing": 4,
            "shadow_distance": 4,
            "shadow_angle": 135,
            "border_alpha": 0,
            "border_color": "#000000",
            "border_width": 8.0,
            "style_name": "",
            "text_color": "#FFFFFF",
            "text_alpha": 1.0,
            "font_name": "Microsoft YaHei",
            "font_title": "微软雅黑",
            "font_size": 60,
            "font_path": "",
            "font_id": "",
            "font_resource_id": "",
            "initial_scale": 1,
            "font_url": "",
            "typesetting": 0,
            "alignment": 2,
            "line_feed": 0,
            "use_effect_default_color": True,
            "is_rich_text": False,
            "shape_clip_x": False,
            "shape_clip_y": False,
            "ktv_color": "#FFFFFFFF",
            "bold_width": 0,
            "italic_degree": 0,
            "underline": False,
            "underline_width": 4.0,
            "underline_offset": 4.0,
            "sub_type": 0,
            "check_flag": 65535,
            "text_size": 0,
            "font_category_name": "",
            "font_source_platform": 0,
            "font_third_resource_id": "",
            "font_category_id": "",
            "add_type": 0,
            "recognize_type": 0,
            "background_round_radius": 30.0,
            "background_width": 0.0,
            "background_height": 0.0,
            "background_vertical_offset": 0,
            "background_horizontal_offset": 0,
            "background_fill": "#000000",
            "font_team_id": "",
            "tts_auto_update": False,
            "text_preset_resource_id": "",
            "group_id": "",
            "preset_id": "",
            "preset_name": "",
            "preset_category": "",
            "preset_category_id": "",
            "preset_index": 0,
            "preset_has_set_alignment": False,
            "force_apply_line_max_width": False,
            "language": "zh-CN",
            "fixed_width": 0,
            "fixed_height": 0,
            "line_max_width": 0.0,
            "oneline_cutoff": False,
            "cutoff_postfix": "",
            "subtitle_template_original_fontsize": 0,
            "inner_padding": 30,
            "multi_language_current": "",
            "source_from": "",
            "is_lyric_effect": False,
            "lyric_group_id": "",
            "is_words_linear": False,
            "ssml_content": "",
            "is_blank_text": False,
            "text": text,
            "words": {
                "start_time": [],
                "end_time": [],
                "text": []
            },
            "combo_info": {
                "text_templates": []
            },
            "caption_template_info": {
                "resource_id": "",
                "third_resource_id": "",
                "resource_name": "",
                "category_id": "",
                "category_name": "",
                "effect_id": "",
                "request_id": "",
                "path": "",
                "is_new": False,
                "source_platform": 0
            },
            "text_curve": None,
            "shadow_point": {
                "x": 0.0,
                "y": 0.0
            },
            "subtitle_keywords": None,
            "lyrics_template": {
                "resource_id": "",
                "resource_name": "",
                "panel": "",
                "effect_id": "",
                "path": "",
                "category_id": "",
                "category_name": "",
                "request_id": ""
            },
            "rich_text_command": {
                "isDirty": False,
                "exeState": 0,
                "iOpCode": 0,
                "iParam1": 0,
                "iParam2": 0,
                "iParam3": 0,
                "iParam4": 0,
                "iParam5": ""
            },
            "text_to_audio_ids": [],
            "fonts": [],
            "relevance_segment": [],
            "original_size": []
        }

    def _build_text_segment(
        self,
        material_id: str,
        start_time: int,
        duration: int
    ) -> Dict[str, Any]:
        return {
            "id": str(uuid.uuid4()).upper(),
            "desc": "",
            "state": 0,
            "speed": 1.0,
            "is_loop": False,
            "is_tone_modify": False,
            "reverse": False,
            "intensifies_audio": False,
            "cartoon": False,
            "volume": 1,
            "last_nonzero_volume": 1,
            "material_id": material_id,
            "render_index": 1,
            "enable_lut": True,
            "enable_adjust": True,
            "enable_hsl": True,
            "visible": True,
            "group_id": "",
            "enable_color_curves": True,
            "track_render_index": 1,
            "enable_color_wheels": True,
            "track_attribute": 0,
            "is_placeholder": False,
            "template_id": "",
            "enable_smart_color_adjust": False,
            "template_scene": "default",
            "enable_color_match_adjust": False,
            "enable_color_correct_adjust": False,
            "enable_adjust_mask": True,
            "raw_segment_id": "",
            "enable_video_mask": True,
            "offset": 0,
            "source_timerange": {
                "start": 0,
                "duration": duration
            },
            "target_timerange": {
                "start": start_time,
                "duration": duration
            },
            "render_timerange": {
                "start": 0,
                "duration": 0
            },
            "clip": {
                "rotation": 0,
                "alpha": 1,
                "scale": {"x": 1.0, "y": 1.0},
                "transform": {"x": 0.0, "y": 0.6},
                "flip": {"vertical": False, "horizontal": False}
            },
            "hdr_settings": {
                "mode": 1,
                "intensity": 1.0,
                "nits": 1000
            },
            "caption_info": None,
            "responsive_layout": {
                "enable": False,
                "size_layout": 0,
                "vertical_pos_layout": 0,
                "horizontal_pos_layout": 0,
                "target_follow": ""
            },
            "lyric_keyframes": None,
            "extra_material_refs": [],
            "keyframe_refs": [],
            "common_keyframes": [],
            "uniform_scale": {
                "on": True,
                "value": 1.0
            }
        }

    def _build_audio_material(
        self,
        material_id: str,
        sb_id: str,
        duration: int
    ) -> Dict[str, Any]:
        return {
            "id": material_id,
            "type": "text_to_audio",
            "name": "",
            "path": f"##_draftpath_placeholder_{self.draft_id}_##/audio/{sb_id}.wav",
            "category_name": "",
            "music_id": "",
            "text_id": "",
            "tone_type": "",
            "source_platform": 1,
            "video_id": "",
            "effect_id": "",
            "resource_id": "",
            "third_resource_id": "",
            "category_id": "",
            "intensifies_path": "",
            "formula_id": "",
            "check_flag": 1,
            "team_id": "",
            "local_material_id": "",
            "tone_speaker": "",
            "tone_effect_id": "",
            "tone_effect_name": "",
            "tone_platform": "",
            "tone_category_id": "",
            "tone_category_name": "",
            "tone_second_category_id": "",
            "tone_second_category_name": "",
            "tone_emotion_name_key": "",
            "tone_emotion_style": "",
            "tone_emotion_role": "",
            "tone_emotion_selection": "",
            "tone_emotion_scale": 0,
            "request_id": "",
            "query": "",
            "search_id": "",
            "sound_separate_type": "",
            "is_text_edit_overdub": False,
            "is_ugc": False,
            "is_ai_clone_tone": False,
            "is_ai_clone_tone_post": False,
            "source_from": "",
            "copyright_limit_type": "none",
            "aigc_history_id": "",
            "aigc_item_id": "",
            "music_source": "",
            "pgc_id": "",
            "pgc_name": "",
            "ai_music_type": 0,
            "lyric_type": 0,
            "tts_task_id": "",
            "tts_generate_scene": "",
            "ai_music_generate_scene": 0,
            "duration": duration,
            "app_id": 0,
            "similiar_music_info": {
                "original_song_id": "",
                "original_song_name": ""
            },
            "wave_points": []
        }

    def _build_position_keyframe(self, segment_id: str, property_type: str, start_time: int, duration: int, start_val: float, end_val: float) -> Dict[str, Any]:
        return {
            "id": str(uuid.uuid4()).upper(),
            "material_id": "",
            "property_type": property_type,
            "keyframe_list": [
                {
                    "id": str(uuid.uuid4()).upper(),
                    "curveType": "Line",
                    "time_offset": start_time,
                    "values": [start_val]
                },
                {
                    "id": str(uuid.uuid4()).upper(),
                    "curveType": "Line",
                    "time_offset": duration,
                    "values": [end_val]
                }
            ]
        }

    def _build_scale_keyframe(self, segment_id: str, start_time: int, duration: int, start_val: float, end_val: float) -> Dict[str, Any]:
        return {
            "id": str(uuid.uuid4()).upper(),
            "material_id": "",
            "property_type": "KFTypeScale",
            "keyframe_list": [
                {
                    "id": str(uuid.uuid4()).upper(),
                    "curveType": "Line",
                    "time_offset": start_time,
                    "values": [start_val]
                },
                {
                    "id": str(uuid.uuid4()).upper(),
                    "curveType": "Line",
                    "time_offset": duration,
                    "values": [end_val]
                }
            ]
        }

    def _build_audio_segment(self, material_id: str, start_time: int, duration: int) -> Dict[str, Any]:
        return {
            "id": str(uuid.uuid4()).upper(),
            "desc": "",
            "state": 0,
            "speed": 1.0,
            "is_loop": False,
            "is_tone_modify": False,
            "reverse": False,
            "intensifies_audio": False,
            "cartoon": False,
            "volume": 1,
            "last_nonzero_volume": 1,
            "material_id": material_id,
            "render_index": 0,
            "enable_lut": True,
            "enable_adjust": True,
            "enable_hsl": True,
            "visible": True,
            "group_id": "",
            "enable_color_curves": True,
            "track_render_index": 0,
            "enable_color_wheels": True,
            "track_attribute": 0,
            "is_placeholder": False,
            "template_id": "",
            "enable_smart_color_adjust": False,
            "template_scene": "default",
            "enable_color_match_adjust": False,
            "enable_color_correct_adjust": False,
            "enable_adjust_mask": True,
            "raw_segment_id": "",
            "enable_video_mask": True,
            "offset": 0,
            "source_timerange": {
                "start": 0,
                "duration": duration
            },
            "target_timerange": {
                "start": start_time,
                "duration": duration
            },
            "render_timerange": {
                "start": 0,
                "duration": 0
            },
            "hdr_settings": {
                "mode": 1,
                "intensity": 1.0,
                "nits": 1000
            },
            "caption_info": None,
            "responsive_layout": {
                "enable": False,
                "size_layout": 0,
                "vertical_pos_layout": 0,
                "horizontal_pos_layout": 0,
                "target_follow": ""
            },
            "lyric_keyframes": None,
            "extra_material_refs": [],
            "keyframe_refs": [],
            "common_keyframes": [],
            "uniform_scale": {
                "on": True,
                "value": 1.0
            }
        }

    def _build_draft_meta(self, draft_dir: Path):
        meta = {
            "cloud_draft_cover": False,
            "cloud_draft_sync": False,
            "cloud_package_completed_time": "",
            "draft_cloud_capcut_purchase_info": "",
            "draft_cloud_last_action_download": False,
            "draft_cloud_package_type": "",
            "draft_cloud_purchase_info": "",
            "draft_cloud_template_id": "",
            "draft_cloud_tutorial_info": "",
            "draft_cloud_videocut_purchase_info": "",
            "draft_cover": "",
            "draft_deeplink_url": "",
            "draft_enterprise_info": {
                "draft_enterprise_extra": "",
                "draft_enterprise_id": "",
                "draft_enterprise_name": "",
                "enterprise_material": []
            },
            "draft_fold_path": str(draft_dir),
            "draft_id": self.draft_id,
            "draft_is_ae_produce": False,
            "draft_is_ai_packaging_used": False,
            "draft_is_ai_shorts": False,
            "draft_is_ai_translate": False,
            "draft_is_article_video_draft": False,
            "draft_is_cloud_temp_draft": False,
            "draft_is_from_deeplink": "false",
            "draft_is_invisible": False,
            "draft_is_web_article_video": False,
            "draft_materials": [
                {"type": 3, "value": []},
                {"type": 6, "value": []},
                {"type": 7, "value": []},
                {"type": 8, "value": []}
            ],
            "draft_materials_copied_info": [],
            "draft_name": self.project.name,
            "draft_need_rename_folder": False,
            "draft_new_version": "",
            "draft_removable_storage_device": "",
            "draft_root_path": "",
            "draft_segment_extra_info": [],
            "draft_timeline_materials_size_": 0,
            "draft_type": "",
            "draft_web_article_video_enter_from": "",
            "tm_draft_cloud_completed": "",
            "tm_draft_cloud_entry_id": -1,
            "tm_draft_cloud_modified": 0,
            "tm_draft_cloud_parent_entry_id": -1,
            "tm_draft_cloud_space_id": -1,
            "tm_draft_cloud_user_id": -1,
            "tm_draft_create": int(self.now.timestamp() * 1000000),
            "tm_draft_modified": int(self.now.timestamp() * 1000000),
            "tm_draft_removed": 0,
            "tm_duration": 0
        }
        with open(draft_dir / "draft_meta_info.json", "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False)

    def _build_other_files(self, draft_dir: Path):
        # draft.extra
        with open(draft_dir / "draft.extra", "w", encoding="utf-8") as f:
            f.write("{}")

        # attachment_editing.json
        with open(draft_dir / "attachment_editing.json", "w", encoding="utf-8") as f:
            json.dump({}, f, ensure_ascii=False)

        # common_attachment 目录
        (draft_dir / "common_attachment").mkdir(exist_ok=True)

        # cover 目录
        (draft_dir / "cover").mkdir(exist_ok=True)

    def _zip_directory(self, dir_path: Path, zip_path: Path):
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in dir_path.rglob('*'):
                if file_path.is_file():
                    arcname = file_path.relative_to(dir_path)
                    zipf.write(file_path, arcname)
