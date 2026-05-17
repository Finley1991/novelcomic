"""
解压视频混剪项目剪映导出器

根据 pyJianYingDraft 库调研结果，确认支持多视频轨道。
轨道安排（方案 A）:
- Screen (index 0): 解压视频（下层，按顺序完整拼接）
- 额外视频轨道 (index 1): 图片素材（上层，每张 15 秒，带 MotionConfig 动效，叠加在视频上）
- Subtitle (index 2): 字幕（按配音文本时间线）
- TTS (index 3): 音频（按配音时间线）
"""
import json
import shutil
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, List
import uuid
import sys

from config import settings
from models.schemas import Project
from core.capcut_mate import init_capcut_mate, get_capcut_mate_path

logger = logging.getLogger(__name__)

# ==================== Flag: pyJianYingDraft 多轨道支持 ====================
# 调研结果：pyJianYingDraft 库确实支持多视频轨道
# - add_track() 方法支持 relative_index 参数，可以创建多个同类型轨道
# - 每个轨道有独立的 render_index，排序后导出
# - 注释明确说明："相对(同类型轨道的)图层位置, 越高越接近前景"
SUPPORT_MULTIPLE_VIDEO_TRACKS = True
# ============================================================================


class DecompressionJianyingExporter:
    """解压视频混剪项目剪映导出器"""

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
        导出解压视频混剪项目为剪映草稿

        Args:
            project: 项目数据
            project_dir: 项目文件目录

        Returns:
            包含 draft_id 和 draft_path 的字典
        """
        if project.type != "decompression_video" or not project.decompressionData:
            raise ValueError("Project is not a decompression video project")

        data = project.decompressionData

        # 检查是否有音频片段
        if not data.audioClips or len(data.audioClips) == 0:
            raise ValueError("No audio clips found. Please generate audio first.")

        # 生成草稿 ID
        draft_id = f"{project.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        draft_dir = self.draft_base_path / draft_id

        logger.info(f"开始导出解压视频项目 {project.id} 到剪映草稿 {draft_id}")
        logger.info(f"草稿目录: {draft_dir}")

        try:
            # 初始化 capcut-mate 路径
            if not init_capcut_mate():
                raise ValueError("capcut-mate path not configured or invalid. Please set capcut_mate_path in settings.")

            # 1. 使用 pyJianYingDraft 创建草稿
            import src.pyJianYingDraft as draft
            from src.pyJianYingDraft.draft_folder import DraftFolder
            from src.pyJianYingDraft.time_util import trange

            logger.info("创建草稿文件夹管理器...")
            # 创建草稿文件夹管理器
            draft_folder = DraftFolder(str(self.draft_base_path))

            logger.info("创建草稿...")
            # 创建草稿 - 默认使用 9:16 竖屏比例 (1080x1920)
            canvas_width = 1080
            canvas_height = 1920
            script = draft_folder.create_draft(
                draft_id,
                canvas_width,
                canvas_height,
                fps=30,
                allow_replace=True
            )

            logger.info("添加轨道...")
            # 添加轨道
            script.add_track(draft.TrackType.video, "video_track", relative_index=0)
            if SUPPORT_MULTIPLE_VIDEO_TRACKS:
                script.add_track(draft.TrackType.video, "image_track", relative_index=1)
            script.add_track(draft.TrackType.audio, "audio_track")
            script.add_track(draft.TrackType.text, "subtitle_track", relative_index=999)

            # 2. 复制素材文件到草稿目录
            logger.info("复制素材文件...")
            materials_map = self._copy_materials(project, project_dir, draft_dir)

            logger.info("=" * 50)
            logger.info("开始导出解压视频剪映草稿")
            logger.info(f"视频素材数量: {len(data.videoClips)}")
            logger.info(f"图片素材数量: {len(data.imageClips)}")
            logger.info(f"音频片段数量: {len(data.audioClips)}")

            # 先添加音频和字幕，获取总音频时长
            logger.info("添加音频和字幕...")
            total_audio_duration_us = self._add_audio_and_subtitles(script, data.audioClips, data.subtitleSegments, materials_map, draft, draft_dir, trange)
            logger.info(f"总音频时长: {total_audio_duration_us / 1_000_000:.2f}s")

            # 添加视频素材（下层轨道）- 确保视频时长至少达到音频时长
            if data.videoClips and len(data.videoClips) > 0:
                logger.info("添加视频素材...")
                self._add_video_clips(script, data.videoClips, materials_map, draft, draft_dir, trange, total_audio_duration_us)
            else:
                logger.warning("没有视频素材，跳过视频轨道")

            # 添加图片素材（上层轨道，如果支持多轨道）
            if SUPPORT_MULTIPLE_VIDEO_TRACKS and data.imageClips and len(data.imageClips) > 0:
                logger.info("添加图片素材...")
                self._add_image_clips(script, data.imageClips, materials_map, draft, draft_dir, trange)
            else:
                logger.warning("没有图片素材或不支持多轨道，跳过图片轨道")

            # 保存草稿
            logger.info("保存草稿...")
            script.save()

            logger.info(f"成功导出解压视频项目 {project.id} 到 {draft_dir}")

            return {
                "draft_id": draft_id,
                "draftPath": str(draft_dir)
            }

        except ImportError as e:
            logger.error(f"导入 pyJianYingDraft 失败: {e}", exc_info=True)
            if draft_dir.exists():
                shutil.rmtree(draft_dir)
            raise ValueError(f"Failed to import pyJianYingDraft: {e}. Please check if capcut-mate is correctly installed.")
        except Exception as e:
            logger.error(f"导出失败: {e}", exc_info=True)
            # 清理部分创建的目录
            if draft_dir.exists():
                try:
                    shutil.rmtree(draft_dir)
                except:
                    logger.warning(f"Failed to clean up draft directory: {draft_dir}")
            raise

    def _copy_materials(self, project: Project, project_dir: Path, draft_dir: Path) -> Dict[str, Dict[str, str]]:
        """
        复制素材文件到草稿目录

        Returns:
            素材 ID 到素材路径的映射
        """
        video_dir = draft_dir / "video"
        audio_dir = draft_dir / "audio"
        video_dir.mkdir(exist_ok=True)
        audio_dir.mkdir(exist_ok=True)

        materials_map = {}

        if not project.decompressionData:
            return materials_map

        data = project.decompressionData

        # 复制视频素材
        for clip in data.videoClips:
            if not clip.filePath:
                logger.warning(f"视频素材 {clip.id} 的 filePath 为空，跳过")
                continue
            src_video = Path(clip.filePath)
            if not src_video.exists():
                logger.warning(f"视频源文件不存在，跳过: {src_video}")
                continue
            try:
                ext = src_video.suffix or ".mp4"
                dst_video = video_dir / f"{clip.id}{ext}"
                shutil.copy2(src_video, dst_video)
                materials_map[clip.id] = {"video": f"video/{clip.id}{ext}"}
                logger.debug(f"已复制视频: {src_video} -> {dst_video}")
            except Exception as e:
                logger.warning(f"复制视频文件失败: {src_video}, 错误: {e}")

        # 复制图片素材
        for clip in data.imageClips:
            if not clip.imagePath:
                continue
            src_img = project_dir / clip.imagePath
            if not src_img.exists():
                logger.warning(f"图片源文件不存在，跳过: {src_img}")
                continue
            try:
                ext = src_img.suffix or ".png"
                dst_img = video_dir / f"{clip.id}{ext}"
                shutil.copy2(src_img, dst_img)
                if clip.id not in materials_map:
                    materials_map[clip.id] = {}
                materials_map[clip.id]["image"] = f"video/{clip.id}{ext}"
                logger.debug(f"已复制图片: {src_img} -> {dst_img}")
            except Exception as e:
                logger.warning(f"复制图片文件失败: {src_img}, 错误: {e}")

        # 复制音频素材
        for clip in data.audioClips:
            if not clip.audioPath:
                continue
            src_audio = project_dir / clip.audioPath
            if not src_audio.exists():
                logger.warning(f"音频源文件不存在，跳过: {src_audio}")
                continue
            try:
                ext = src_audio.suffix or ".wav"
                dst_audio = audio_dir / f"{clip.id}{ext}"
                shutil.copy2(src_audio, dst_audio)
                if clip.id not in materials_map:
                    materials_map[clip.id] = {}
                materials_map[clip.id]["audio"] = f"audio/{clip.id}{ext}"
                logger.debug(f"已复制音频: {src_audio} -> {dst_audio}")
            except Exception as e:
                logger.warning(f"复制音频文件失败: {src_audio}, 错误: {e}")

        return materials_map

    def _add_video_clips(self, script, video_clips, materials_map, draft, draft_dir: Path, trange, target_duration_us: int = 0):
        """添加视频素材到轨道（优先使用不重复的视频，不够再循环）"""
        current_start_us = 0

        # 先加载所有视频素材并获取它们的时长
        video_materials = []
        for clip in video_clips:
            clip_map = materials_map.get(clip.id, {})
            if "video" not in clip_map:
                logger.warning(f"视频素材 {clip.id} 未在 materials_map 中找到，跳过")
                continue

            img_path = str(draft_dir / clip_map["video"])
            try:
                img_material = draft.VideoMaterial(img_path)
                script.add_material(img_material)
            except Exception as e:
                logger.warning(f"加载视频素材失败: {img_path}, 错误: {e}")
                continue

            material_duration_us = img_material.duration
            if material_duration_us <= 0:
                logger.warning(f"视频素材时长为0或无法读取，跳过: {img_path}")
                continue

            use_duration_us = max(material_duration_us - 10000, 100000)

            video_materials.append({
                "material": img_material,
                "path": img_path,
                "duration": use_duration_us
            })

        if not video_materials:
            logger.warning("没有可用的视频素材，跳过视频轨道")
            return

        total_available_us = sum(v["duration"] for v in video_materials)
        need_loop = target_duration_us > 0 and total_available_us < target_duration_us
        logger.info(f"已加载 {len(video_materials)} 个视频素材，总可用时长 {total_available_us / 1_000_000:.2f}s")

        if need_loop:
            logger.warning(f"视频素材总时长 ({total_available_us / 1_000_000:.2f}s) 不足目标 ({target_duration_us / 1_000_000:.2f}s)，将循环复用")

        def _add_one_video(video_info, use_dur, start_us):
            """添加一个视频片段到轨道"""
            source_timerange = trange(start=0, duration=use_dur)
            target_timerange = trange(start=start_us, duration=use_dur)
            video_seg = draft.VideoSegment(
                video_info["material"],
                target_timerange,
                source_timerange=source_timerange,
                speed=1.0
            )
            script.add_segment(video_seg, "video_track")
            logger.info(f"视频素材: {video_info['path']}, {use_dur / 1_000_000:.2f}s @ {start_us / 1_000_000:.2f}s")

        # 第一轮：每个视频用一次，不重复
        for video_info in video_materials:
            if target_duration_us > 0 and current_start_us >= target_duration_us:
                break

            use_duration_us = video_info["duration"]
            remaining = target_duration_us - current_start_us
            if target_duration_us > 0 and remaining < use_duration_us:
                use_duration_us = remaining
                logger.info(f"裁剪末尾视频片段到 {use_duration_us / 1_000_000:.2f}s")

            _add_one_video(video_info, use_duration_us, current_start_us)
            current_start_us += use_duration_us

        # 如果还不够，循环复用直到填满
        round_num = 1
        while target_duration_us > 0 and current_start_us < target_duration_us and round_num < 100:
            round_num += 1
            logger.info(f"视频素材不足，第 {round_num} 轮循环复用")
            for video_info in video_materials:
                if current_start_us >= target_duration_us:
                    break
                use_duration_us = video_info["duration"]
                remaining = target_duration_us - current_start_us
                if remaining < use_duration_us:
                    use_duration_us = remaining

                _add_one_video(video_info, use_duration_us, current_start_us)
                current_start_us += use_duration_us

        logger.info(f"视频轨道总时长: {current_start_us / 1_000_000:.2f}s")

    def _add_image_clips(self, script, image_clips, materials_map, draft, draft_dir: Path, trange):
        """添加图片素材到上层轨道"""
        try:
            from src.pyJianYingDraft.keyframe import KeyframeProperty
        except ImportError:
            KeyframeProperty = None
            logger.warning("无法导入 KeyframeProperty，图片动效将被跳过")

        for clip in image_clips:
            clip_map = materials_map.get(clip.id, {})
            if "image" not in clip_map:
                logger.warning(f"图片素材 {clip.id} 未在 materials_map 中找到，跳过")
                continue

            img_path = str(draft_dir / clip_map["image"])
            try:
                img_material = draft.VideoMaterial(img_path)
                script.add_material(img_material)
            except Exception as e:
                logger.warning(f"加载图片素材失败: {img_path}, 错误: {e}")
                continue

            duration_us = int(clip.duration * 1_000_000)
            start_us = int(clip.startTime * 1_000_000)

            if duration_us <= 0:
                logger.warning(f"图片素材时长为0，跳过: {img_path}")
                continue

            source_duration_us = duration_us

            logger.info(f"图片素材: {img_path}")
            logger.info(f"  使用时长: {duration_us}us, 开始时间: {start_us}us")

            try:
                source_timerange = trange(start=0, duration=source_duration_us)
                target_timerange = trange(start=start_us, duration=duration_us)

                video_seg = draft.VideoSegment(
                    img_material,
                    target_timerange,
                    source_timerange=source_timerange,
                    speed=1.0
                )
                # 添加关键帧动画：从140%缩放（1.4）到100%缩放（1.0）
                if KeyframeProperty is not None:
                    try:
                        video_seg.add_keyframe(KeyframeProperty.uniform_scale, 0, 1.4)
                        video_seg.add_keyframe(KeyframeProperty.uniform_scale, duration_us, 1.0)
                    except Exception as e:
                        logger.warning(f"添加关键帧失败: {e}，继续添加图片素材")
                script.add_segment(video_seg, "image_track")
            except Exception as e:
                logger.warning(f"添加图片素材到轨道失败: {img_path}, 错误: {e}")

    def _add_audio_and_subtitles(self, script, audio_clips, subtitle_segments, materials_map, draft, draft_dir: Path, trange) -> int:
        """添加音频和字幕到轨道

        Returns:
            总音频时长（微秒）
        """
        current_start_us = 0

        # 先添加所有音频片段
        for clip_idx, clip in enumerate(audio_clips):
            clip_map = materials_map.get(clip.id, {})

            # 添加音频
            if "audio" not in clip_map:
                logger.warning(f"音频素材 {clip.id} 未在 materials_map 中找到，跳过")
                continue

            audio_path = str(draft_dir / clip_map["audio"])
            try:
                audio_material = draft.AudioMaterial(audio_path)
                script.add_material(audio_material)
            except Exception as e:
                logger.warning(f"加载音频素材失败: {audio_path}, 错误: {e}")
                continue

            material_duration_us = audio_material.duration
            if material_duration_us <= 0:
                logger.warning(f"音频素材时长为0或无法读取，跳过: {audio_path}")
                continue

            # 使用素材的实际时长，减去安全余量
            use_duration_us = max(material_duration_us - 10000, 100000)  # 最少0.1秒

            logger.info(f"音频素材: {audio_path}")
            logger.info(f"  素材时长: {material_duration_us}us, 使用时长: {use_duration_us}us")

            try:
                source_timerange = trange(start=0, duration=use_duration_us)
                target_timerange = trange(start=current_start_us, duration=use_duration_us)

                audio_seg = draft.AudioSegment(
                    audio_material,
                    target_timerange,
                    source_timerange=source_timerange,
                    speed=1.0
                )
                script.add_segment(audio_seg, "audio_track")
            except Exception as e:
                logger.warning(f"添加音频片段到轨道失败: {audio_path}, 错误: {e}")
                # 仍推进时间线，保持与其他轨道的对齐
                logger.info(f"跳过失败音频片段，时间线推进 {use_duration_us}us")

            # 更新下一个片段的开始时间，在片段之间添加1ms间隙防止重叠
            current_start_us += use_duration_us
            if clip_idx < len(audio_clips) - 1:
                current_start_us += 1000  # 添加1ms间隙

        total_audio_duration_us = current_start_us

        # 添加上传的字幕片段
        if subtitle_segments and len(subtitle_segments) > 0:
            logger.info(f"添加 {len(subtitle_segments)} 个上传的字幕片段...")
            try:
                from src.pyJianYingDraft.metadata import FontType
            except ImportError:
                FontType = None
            text_style = draft.TextStyle(size=13.0, align=1, auto_wrapping=True)

            prev_end_us = 0
            for seg in subtitle_segments:
                start_us = int(seg.startTime * 1_000_000)
                end_us = int(seg.endTime * 1_000_000)
                duration_us = end_us - start_us

                if duration_us <= 0:
                    continue

                # 防止与前一个字幕重叠（SRT 字幕时间轴也可能有微小重叠）
                if start_us < prev_end_us:
                    start_us = prev_end_us
                    duration_us = max(end_us - start_us, 100000)  # 最少 0.1 秒

                logger.info(f"字幕: {seg.text}, 开始: {start_us}us, 时长: {duration_us}us")

                try:
                    font = FontType.新青年体 if FontType is not None else None
                    text_seg = draft.TextSegment(
                        seg.text,
                        trange(start=start_us, duration=duration_us),
                        font=font,
                        style=text_style
                    )
                    script.add_segment(text_seg, "subtitle_track")
                    prev_end_us = start_us + duration_us
                except Exception as e:
                    # 字幕与其他段重叠时，把起始时间推到上一个段的结尾后重试
                    if "overlap" in str(e).lower():
                        logger.warning(f"字幕重叠，尝试调整时间: {seg.text}, 错误: {e}")
                        try:
                            adjusted_start = prev_end_us + 1000
                            text_seg = draft.TextSegment(
                                seg.text,
                                trange(start=adjusted_start, duration=duration_us),
                                font=font,
                                style=text_style
                            )
                            script.add_segment(text_seg, "subtitle_track")
                            prev_end_us = adjusted_start + duration_us
                        except Exception as retry_error:
                            logger.warning(f"字幕添加重试失败，跳过: {seg.text}, 错误: {retry_error}")
                    else:
                        logger.warning(f"添加字幕失败，跳过: {seg.text}, 错误: {e}")
        else:
            logger.warning("没有上传的字幕片段，跳过字幕轨道")

        return total_audio_duration_us
