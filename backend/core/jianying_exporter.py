import json
import shutil
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, List
import uuid
import sys

from config import settings
from models.schemas import Project, Storyboard

logger = logging.getLogger(__name__)

# 添加 pyJianYingDraft 库的路径
CAPCUT_MATE_PATH = Path("/Users/wyf-mac/Documents/code/claudecode/capcut-mate/src")
sys.path.insert(0, str(CAPCUT_MATE_PATH.parent))


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
            # 1. 使用 pyJianYingDraft 创建草稿
            import src.pyJianYingDraft as draft
            from src.pyJianYingDraft.draft_folder import DraftFolder

            # 创建草稿文件夹管理器
            draft_folder = DraftFolder(str(self.draft_base_path))

            # 创建草稿
            script = draft_folder.create_draft(
                draft_id,
                settings.jianying_canvas_width,
                settings.jianying_canvas_height,
                fps=30,
                allow_replace=True
            )

            # 添加视频轨道和音频轨道
            script.add_track(draft.TrackType.video, "main_video")
            script.add_track(draft.TrackType.audio, "main_audio")

            # 2. 复制素材文件到草稿目录
            materials_map = self._copy_materials(project, project_dir, draft_dir)

            # 3. 添加素材和片段到草稿
            from src.pyJianYingDraft.time_util import trange

            current_time = 0

            for storyboard in project.storyboards:
                sb_map = materials_map.get(storyboard.id, {})

                # 添加视频素材和片段
                if "image" in sb_map:
                    img_path = str(draft_dir / sb_map["image"])
                    img_material = draft.VideoMaterial(img_path)
                    script.add_material(img_material)

                # 添加音频素材和片段
                audio_duration = 0
                audio_material = None
                if "audio" in sb_map:
                    audio_path = str(draft_dir / sb_map["audio"])
                    audio_material = draft.AudioMaterial(audio_path)
                    script.add_material(audio_material)
                    audio_duration = audio_material.duration
                    logger.info(f"分镜 {storyboard.index}: 音频素材时长 = {audio_duration / 1000000:.3f}秒, storyboard音频时长 = {storyboard.audioDuration:.3f}秒")

                # 使用音频实际时长作为图片时长
                # 优先使用 storyboard.audioDuration（我们存储的实际音频时长）
                # 其次使用 audio_material.duration
                # 如果都没有，使用至少3秒
                if "audio" in sb_map:
                    if storyboard.audioDuration > 0:
                        duration = int(storyboard.audioDuration * 1000000)
                        logger.info(f"分镜 {storyboard.index}: 使用storyboard音频时长 = {duration / 1000000:.3f}秒")
                    elif audio_duration > 0:
                        duration = int(audio_duration)
                        logger.info(f"分镜 {storyboard.index}: 使用音频素材时长 = {duration / 1000000:.3f}秒")
                    else:
                        duration = 3000000
                        logger.info(f"分镜 {storyboard.index}: 使用最小时长 = {duration / 1000000:.3f}秒")
                else:
                    duration = int(max(storyboard.audioDuration * 1000000, 3000000))
                    logger.info(f"分镜 {storyboard.index}: 无音频，使用时长 = {duration / 1000000:.3f}秒")

                # 添加视频片段（图片可以任意时长）
                if "image" in sb_map:
                    video_seg = draft.VideoSegment(
                        img_material,
                        trange(start=current_time, duration=duration)
                    )
                    script.add_segment(video_seg, "main_video")

                # 添加音频片段（使用音频实际时长）
                if "audio" in sb_map:
                    # 音频片段时长不能超过素材实际时长
                    audio_seg_duration = min(duration, audio_duration)
                    audio_seg = draft.AudioSegment(
                        audio_material,
                        trange(start=current_time, duration=audio_seg_duration)
                    )
                    script.add_segment(audio_seg, "main_audio")

                current_time += duration

            # 保存草稿
            script.save()

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

    def _copy_materials(self, project: Project, project_dir: Path, draft_dir: Path) -> Dict[str, Dict[str, str]]:
        """
        复制素材文件到草稿目录

        Returns:
            分镜 ID 到素材路径的映射
        """
        video_dir = draft_dir / "video"
        audio_dir = draft_dir / "audio"
        video_dir.mkdir(exist_ok=True)
        audio_dir.mkdir(exist_ok=True)

        materials_map = {}

        for storyboard in project.storyboards:
            sb_map = {}

            # 复制图片（放在 video 目录）
            if storyboard.imagePath:
                src_img = project_dir / storyboard.imagePath
                if src_img.exists():
                    ext = src_img.suffix or ".jpg"
                    dst_img = video_dir / f"{storyboard.id}{ext}"
                    shutil.copy2(src_img, dst_img)
                    sb_map["image"] = f"video/{storyboard.id}{ext}"
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
