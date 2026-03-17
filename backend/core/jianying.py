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
        video_segments = []
        audio_segments = []

        current_time = 0

        for sb in self.project.storyboards:
            sb_material_id = str(uuid.uuid4()).upper()

            if sb.imagePath:
                img_path = Path(sb.imagePath)
                materials_videos.append({
                    "id": sb_material_id,
                    "type": "photo",
                    "file_path": f"image/{sb.id}.png",
                    "width": settings.jianying_canvas_width,
                    "height": settings.jianying_canvas_height,
                    "duration": 10800000000
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

            if sb.audioPath:
                audio_material_id = str(uuid.uuid4()).upper()
                materials_audios.append({
                    "id": audio_material_id,
                    "file_path": f"audio/{sb.id}.wav",
                    "duration": duration
                })
                audio_segments.append(self._build_audio_segment(
                    audio_material_id,
                    current_time,
                    duration
                ))

            current_time += duration

        return {
            "id": self.draft_id,
            "version": "1.0",
            "name": self.project.name,
            "fps": 30,
            "duration": current_time,
            "canvas_config": {
                "dom_width": 0,
                "dom_height": 0,
                "ratio": settings.jianying_canvas_ratio,
                "width": settings.jianying_canvas_width,
                "height": settings.jianying_canvas_height,
                "background": None
            },
            "materials": {
                "videos": materials_videos,
                "audios": materials_audios,
                "images": [],
                "texts": [],
                "effects": [],
                "stickers": [],
                "transitions": [],
                "audio_effects": []
            },
            "tracks": [
                {
                    "id": str(uuid.uuid4()).upper(),
                    "type": "video",
                    "name": "Screen",
                    "segments": video_segments
                },
                {
                    "id": str(uuid.uuid4()).upper(),
                    "type": "audio",
                    "name": "TTS",
                    "segments": audio_segments
                }
            ],
            "keyframes": {
                "videos": [],
                "audios": [],
                "texts": [],
                "stickers": [],
                "filters": [],
                "adjusts": []
            }
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
            "material_id": material_id,
            "target_timerange": {
                "start": start_time,
                "duration": duration
            },
            "source_timerange": {
                "start": 0,
                "duration": duration
            },
            "clip": {
                "rotation": 0,
                "alpha": 1,
                "scale": {"x": start_scale, "y": start_scale},
                "transform": {"x": start_x, "y": start_y},
                "flip": {"vertical": False, "horizontal": False}
            },
            "common_keyframes": common_keyframes
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
            "material_id": material_id,
            "target_timerange": {
                "start": start_time,
                "duration": duration
            },
            "source_timerange": {
                "start": 0,
                "duration": duration
            }
        }

    def _build_draft_meta(self, draft_dir: Path):
        meta = {
            "draft_id": self.draft_id,
            "draft_name": self.project.name,
            "draft_fold_path": str(draft_dir),
            "tm_draft_create": int(self.now.timestamp() * 1000000),
            "tm_draft_modified": int(self.now.timestamp() * 1000000),
            "tm_duration": 0
        }
        with open(draft_dir / "draft_meta_info.json", "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False)

        with open(draft_dir / "draft.extra", "w", encoding="utf-8") as f:
            f.write("{}")

    def _zip_directory(self, dir_path: Path, zip_path: Path):
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in dir_path.rglob('*'):
                if file_path.is_file():
                    arcname = file_path.relative_to(dir_path)
                    zipf.write(file_path, arcname)
