import json
import random
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

try:
    from pymediainfo import MediaInfo
    HAS_PYMEDIAINFO = True
except ImportError:
    HAS_PYMEDIAINFO = False
    logger.warning("pymediainfo not installed, video duration reading will not work")


class VideoScanner:
    """解压视频扫描器"""

    SUPPORTED_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv'}

    def __init__(self, cache_path: Path):
        self.cache_path = cache_path
        self._cache: Optional[Dict] = None

    def _load_cache(self) -> Dict:
        if self._cache is not None:
            return self._cache
        if self.cache_path.exists():
            try:
                with open(self.cache_path, 'r', encoding='utf-8') as f:
                    self._cache = json.load(f)
                    return self._cache
            except Exception:
                pass
        self._cache = {"videos": [], "last_scan": None}
        return self._cache

    def _save_cache(self):
        with open(self.cache_path, 'w', encoding='utf-8') as f:
            json.dump(self._cache, f, indent=2, ensure_ascii=False)

    def get_video_duration(self, video_path: Path) -> float:
        """获取视频时长（秒）"""
        if not HAS_PYMEDIAINFO:
            return 0.0
        try:
            media_info = MediaInfo.parse(str(video_path))
            for track in media_info.tracks:
                if track.track_type == "Video":
                    if track.duration:
                        return float(track.duration) / 1000.0
        except Exception as e:
            logger.warning(f"Failed to read duration for {video_path}: {e}")
        return 0.0

    def scan_videos(self, video_dir: Path, force_rescan: bool = False) -> List[Dict]:
        """扫描视频目录（递归扫描子目录）"""
        cache = self._load_cache()

        if not force_rescan and cache.get("last_scan"):
            return cache.get("videos", [])

        videos = []
        if not video_dir.exists():
            return videos

        # 先快速扫描文件，不读取时长
        for file_path in video_dir.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in self.SUPPORTED_EXTENSIONS:
                mtime = file_path.stat().st_mtime

                cached_video = next((v for v in cache.get("videos", [])
                                    if v["filePath"] == str(file_path)), None)

                if cached_video and cached_video.get("mtime") == mtime:
                    videos.append(cached_video)
                else:
                    # 先用默认时长30秒，后续选择视频时再读取真实时长
                    videos.append({
                        "filePath": str(file_path),
                        "fileName": file_path.name,
                        "duration": 30.0,  # 默认30秒
                        "mtime": mtime
                    })

        self._cache = {
            "videos": videos,
            "last_scan": datetime.now().isoformat()
        }
        self._save_cache()

        return videos

    def select_videos_for_duration(self, video_dir: Path, target_duration: float) -> List[Dict]:
        """选择视频直到达到目标时长"""
        videos = self.scan_videos(video_dir)
        if not videos:
            return []

        selected = []
        current_duration = 0.0
        used_indices = set()
        video_list = videos.copy()

        while current_duration < target_duration:
            available = [v for i, v in enumerate(video_list) if i not in used_indices]

            if not available:
                used_indices.clear()
                random.shuffle(video_list)
                available = video_list

            video = random.choice(available)
            idx = video_list.index(video)
            used_indices.add(idx)

            selected.append(video)
            current_duration += video["duration"]

        return selected


class StylePromptScanner:
    """风格提示词扫描器"""

    def __init__(self, style_prompts_dir: Path):
        self.style_prompts_dir = style_prompts_dir

    def scan_styles(self) -> List[str]:
        """扫描所有风格"""
        styles = []
        if not self.style_prompts_dir.exists():
            return styles

        for file_path in self.style_prompts_dir.iterdir():
            if file_path.is_file() and file_path.suffix.lower() == '.txt':
                styles.append(file_path.stem)

        return sorted(styles)

    def get_prompts_for_style(self, style_name: str) -> List[str]:
        """获取某风格的提示词列表"""
        file_path = self.style_prompts_dir / f"{style_name}.txt"
        if not file_path.exists():
            return []

        prompts = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    prompts.append(line)

        return prompts

    def select_random_prompts(self, style_name: str, count: int) -> List[str]:
        """随机选择提示词"""
        prompts = self.get_prompts_for_style(style_name)
        if not prompts:
            return []

        selected = []
        prompt_list = prompts.copy()
        used_indices = set()

        while len(selected) < count:
            available = [p for i, p in enumerate(prompt_list) if i not in used_indices]

            if not available:
                used_indices.clear()
                random.shuffle(prompt_list)
                available = prompt_list

            prompt = random.choice(available)
            idx = prompt_list.index(prompt)
            used_indices.add(idx)
            selected.append(prompt)

        return selected
