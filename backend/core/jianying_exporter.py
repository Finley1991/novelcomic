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
from core.capcut_mate import init_capcut_mate

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
            # 初始化 capcut-mate 路径
            if not init_capcut_mate():
                raise ValueError("capcut-mate path not configured or invalid. Please set capcut_mate_path in settings.")

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

            logger.info("=" * 50)
            logger.info("开始导出剪映草稿")
            logger.info(f"项目分镜数量: {len(project.storyboards)}")

            current_time = 0

            for storyboard in project.storyboards:
                sb_map = materials_map.get(storyboard.id, {})
                logger.info(f"--- 分镜 {storyboard.index} ---")
                logger.info(f"  素材: {list(sb_map.keys())}")
                logger.info(f"  storyboard.audioDuration: {storyboard.audioDuration}")

                # 添加视频素材和片段
                img_material = None
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
                    logger.info(f"  音频素材时长: {audio_duration / 1000000:.3f}秒")

                # 确定时长 - 优先使用音频素材时长
                duration = 3000000  # 默认3秒
                if "audio" in sb_map and audio_duration > 0:
                    duration = int(audio_duration)
                    logger.info(f"  使用音频素材时长: {duration / 1000000:.3f}秒")
                elif storyboard.audioDuration > 0:
                    duration = int(storyboard.audioDuration * 1000000)
                    logger.info(f"  使用storyboard音频时长: {duration / 1000000:.3f}秒")
                else:
                    logger.info(f"  使用默认3秒")

                # 添加视频片段（图片可以任意时长）
                if "image" in sb_map and img_material:
                    logger.info(f"  创建视频片段, start={current_time / 1000000:.3f}s, duration={duration / 1000000:.3f}s")
                    video_seg = draft.VideoSegment(
                        img_material,
                        trange(start=current_time, duration=duration)
                    )
                    script.add_segment(video_seg, "main_video")

                # 添加音频片段（使用音频实际时长）
                if "audio" in sb_map and audio_material:
                    audio_seg_duration = min(duration, audio_duration)
                    logger.info(f"  创建音频片段, start={current_time / 1000000:.3f}s, duration={audio_seg_duration / 1000000:.3f}s")
                    audio_seg = draft.AudioSegment(
                        audio_material,
                        trange(start=current_time, duration=audio_seg_duration)
                    )
                    script.add_segment(audio_seg, "main_audio")

                current_time += duration
                logger.info(f"  current_time 增加到: {current_time / 1000000:.3f}s")

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
