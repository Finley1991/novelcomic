"""
Capcut Mate 辅助模块

用于动态设置 capcut-mate 库的路径，避免硬编码。
"""
import sys
import logging
from pathlib import Path
from typing import Optional

from config import settings
from core.storage import storage

logger = logging.getLogger(__name__)

_capcut_mate_initialized = False


def init_capcut_mate(custom_path: Optional[str] = None) -> bool:
    """
    初始化 capcut-mate 库路径

    Args:
        custom_path: 自定义 capcut-mate 路径（覆盖配置文件中的设置）

    Returns:
        是否成功初始化
    """
    global _capcut_mate_initialized

    if _capcut_mate_initialized:
        return True

    # 确定 capcut-mate 路径的优先级：
    # 1. custom_path 参数
    # 2. 全局设置中的 jianying.capcutMatePath
    # 3. config.py 中的 settings.capcut_mate_path
    capcut_mate_path_str = custom_path

    if not capcut_mate_path_str:
        try:
            global_settings = storage.load_global_settings()
            if global_settings.jianying and global_settings.jianying.capcutMatePath:
                capcut_mate_path_str = global_settings.jianying.capcutMatePath
        except Exception as e:
            logger.debug(f"Failed to load global settings: {e}")

    if not capcut_mate_path_str:
        capcut_mate_path_str = settings.capcut_mate_path

    if not capcut_mate_path_str:
        logger.warning("capcut_mate_path not configured, pyJianYingDraft may not work")
        return False

    capcut_mate_path = Path(capcut_mate_path_str)

    # 检查路径是否存在
    if not capcut_mate_path.exists():
        logger.error(f"capcut-mate path does not exist: {capcut_mate_path}")
        return False

    # 添加到 sys.path
    parent_path = str(capcut_mate_path.parent)
    if parent_path not in sys.path:
        sys.path.insert(0, parent_path)
        logger.info(f"Added capcut-mate path to sys.path: {parent_path}")

    _capcut_mate_initialized = True
    return True


def get_capcut_mate_path() -> Optional[Path]:
    """
    获取当前配置的 capcut-mate 路径

    Returns:
        capcut-mate 路径，如果未配置则返回 None
    """
    # 优先从全局设置中获取
    try:
        global_settings = storage.load_global_settings()
        if global_settings.jianying and global_settings.jianying.capcutMatePath:
            return Path(global_settings.jianying.capcutMatePath)
    except Exception as e:
        logger.debug(f"Failed to load global settings: {e}")

    # 其次从 config.py 中获取
    if settings.capcut_mate_path:
        return Path(settings.capcut_mate_path)

    return None


def is_capcut_mate_available() -> bool:
    """
    检查 capcut-mate 是否可用

    Returns:
        capcut-mate 是否可用
    """
    path = get_capcut_mate_path()
    if path is None:
        return False
    return path.exists()
