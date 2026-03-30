import json
import logging
from pathlib import Path
from typing import List, Optional, Dict
from datetime import datetime
import uuid
import re

from config import settings
from models.schemas import StylePromptList

logger = logging.getLogger(__name__)


def _chinese_to_pinyin(text: str) -> str:
    """简单的中文转拼音/英文映射"""
    # 预定义常见风格名称映射
    mapping = {
        "动漫风格": "anime_style",
        "写实风格": "photorealistic",
        "古风武侠": "wuxia_style",
        "通用风格": "general_style",
        "电影风格": "cinematic_style",
        "水彩风格": "watercolor_style",
        "油画风格": "oil_painting_style",
        "像素风格": "pixel_style",
        "3D渲染": "3d_render",
    }
    if text in mapping:
        return mapping[text]
    # fallback: 移除非字母数字，空格转下划线，转小写
    simplified = re.sub(r'[^\w\s]', '', text)
    simplified = re.sub(r'\s+', '_', simplified)
    return simplified.lower() or "style"


class StylePromptManager:
    def __init__(self):
        self.style_dir = Path(settings.style_prompts_path)
        self.tmp_dir = Path(settings.data_dir) / "tmp"
        self._mapping_file = self.style_dir / "_mapping.json"
        self._ensure_dirs()
        self._style_mapping = self._load_mapping()

    def _ensure_dirs(self):
        self.style_dir.mkdir(parents=True, exist_ok=True)
        self.tmp_dir.mkdir(parents=True, exist_ok=True)

    def _load_mapping(self) -> Dict[str, str]:
        """加载风格名称到文件名的映射"""
        if self._mapping_file.exists():
            try:
                return json.loads(self._mapping_file.read_text(encoding='utf-8'))
            except Exception as e:
                logger.error(f"Failed to load style mapping: {e}")
        return {}

    def _save_mapping(self):
        """保存映射"""
        self._mapping_file.write_text(
            json.dumps(self._style_mapping, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )

    def _get_file_path(self, style_name: str) -> Optional[Path]:
        """获取风格文件路径"""
        if style_name not in self._style_mapping:
            return None
        return self.style_dir / self._style_mapping[style_name]

    def _read_prompts(self, file_path: Path) -> List[str]:
        """读取提示词文件，返回非空行列表"""
        if not file_path.exists():
            return []
        try:
            lines = file_path.read_text(encoding='utf-8').splitlines()
            return [line.strip() for line in lines if line.strip()]
        except Exception as e:
            logger.error(f"Failed to read prompts from {file_path}: {e}")
            return []

    def _write_prompts(self, file_path: Path, prompts: List[str]):
        """写入提示词文件"""
        file_path.write_text('\n'.join(prompts) + '\n', encoding='utf-8')

    # ===== 风格管理 =====
    def list_styles(self) -> List[StylePromptList]:
        """列出所有风格"""
        result = []
        for style_name, file_name in self._style_mapping.items():
            file_path = self.style_dir / file_name
            prompts = self._read_prompts(file_path)
            result.append(StylePromptList(
                styleName=style_name,
                fileName=file_name,
                prompts=prompts
            ))
        # 按风格名称排序
        result.sort(key=lambda x: x.styleName)
        return result

    def create_style(self, style_name: str) -> StylePromptList:
        """创建新风格"""
        if style_name in self._style_mapping:
            raise ValueError(f"Style '{style_name}' already exists")

        file_name = _chinese_to_pinyin(style_name)
        # 确保文件名唯一
        base_name = file_name
        counter = 1
        while (self.style_dir / f"{file_name}.txt").exists():
            file_name = f"{base_name}_{counter}"
            counter += 1
        file_name += ".txt"

        # 创建空文件
        file_path = self.style_dir / file_name
        file_path.touch()

        # 更新映射
        self._style_mapping[style_name] = file_name
        self._save_mapping()

        return StylePromptList(
            styleName=style_name,
            fileName=file_name,
            prompts=[]
        )

    def rename_style(self, old_name: str, new_name: str) -> StylePromptList:
        """重命名风格"""
        if old_name not in self._style_mapping:
            raise ValueError(f"Style '{old_name}' not found")
        if new_name in self._style_mapping and new_name != old_name:
            raise ValueError(f"Style '{new_name}' already exists")

        file_name = self._style_mapping.pop(old_name)
        self._style_mapping[new_name] = file_name
        self._save_mapping()

        prompts = self._read_prompts(self.style_dir / file_name)
        return StylePromptList(
            styleName=new_name,
            fileName=file_name,
            prompts=prompts
        )

    def delete_style(self, style_name: str) -> bool:
        """删除风格"""
        if style_name not in self._style_mapping:
            return False

        file_name = self._style_mapping[style_name]
        file_path = self.style_dir / file_name

        # 删除文件
        if file_path.exists():
            file_path.unlink()

        # 更新映射
        del self._style_mapping[style_name]
        self._save_mapping()

        return True

    # ===== 提示词管理 =====
    def get_prompts(self, style_name: str) -> List[str]:
        """获取风格下的所有提示词"""
        file_path = self._get_file_path(style_name)
        if not file_path:
            raise ValueError(f"Style '{style_name}' not found")
        return self._read_prompts(file_path)

    def add_prompt(self, style_name: str, prompt: str) -> List[str]:
        """添加新提示词"""
        file_path = self._get_file_path(style_name)
        if not file_path:
            raise ValueError(f"Style '{style_name}' not found")

        prompts = self._read_prompts(file_path)
        prompts.append(prompt.strip())
        self._write_prompts(file_path, prompts)
        return prompts

    def update_prompt(self, style_name: str, index: int, new_prompt: str) -> List[str]:
        """修改提示词（按索引）"""
        file_path = self._get_file_path(style_name)
        if not file_path:
            raise ValueError(f"Style '{style_name}' not found")

        prompts = self._read_prompts(file_path)
        if index < 0 or index >= len(prompts):
            raise ValueError(f"Index {index} out of range")

        prompts[index] = new_prompt.strip()
        self._write_prompts(file_path, prompts)
        return prompts

    def delete_prompt(self, style_name: str, index: int) -> List[str]:
        """删除提示词（按索引）"""
        file_path = self._get_file_path(style_name)
        if not file_path:
            raise ValueError(f"Style '{style_name}' not found")

        prompts = self._read_prompts(file_path)
        if index < 0 or index >= len(prompts):
            raise ValueError(f"Index {index} out of range")

        prompts.pop(index)
        self._write_prompts(file_path, prompts)
        return prompts

    def batch_append_prompts(self, style_name: str, prompts: List[str]) -> List[str]:
        """批量追加提示词"""
        file_path = self._get_file_path(style_name)
        if not file_path:
            raise ValueError(f"Style '{style_name}' not found")

        existing = self._read_prompts(file_path)
        existing.extend([p.strip() for p in prompts if p.strip()])
        self._write_prompts(file_path, existing)
        return existing

    # ===== 仿写功能 =====
    async def paraphrase_prompt(
        self,
        original: str,
        count: int,
        requirement: str
    ) -> List[str]:
        """大模型仿写提示词"""
        from core.ollama import ollama_client
        from core.openai_client import openai_client
        from config import settings

        system_prompt = """你是一个专业的 AI 绘画提示词工程师。
请根据以下原始提示词，生成 {count} 个类似但不同的提示词。

原始提示词：
{original_prompt}

额外要求：
{requirement}

请只返回提示词列表，每行一个，不要任何解释。"""

        user_prompt = system_prompt.format(
            count=count,
            original_prompt=original,
            requirement=requirement or "无额外要求，只要类似但有变化"
        )

        # 尝试使用 Ollama，失败则用 OpenAI
        try:
            result = await ollama_client.generate(
                system_prompt="",
                user_prompt=user_prompt,
                model=settings.ollama_model
            )
        except Exception as e:
            logger.warning(f"Ollama failed, trying OpenAI: {e}")
            result = await openai_client.generate(
                system_prompt="",
                user_prompt=user_prompt
            )

        # 解析结果，按行分割，过滤空行
        lines = [line.strip() for line in result.splitlines() if line.strip()]
        # 只返回前 count 个
        return lines[:count]

    # ===== 测试生图功能 =====
    async def test_generate_image(self, prompt: str) -> str:
        """测试提示词生图，返回文件名"""
        from core.comfyui import ComfyUIClient

        # 使用简单的通用场景 + 风格提示词
        full_prompt = f"1girl, simple background, {prompt}"

        # 生成图片
        comfyui = ComfyUIClient()
        image_data = await comfyui.generate_image(
            prompt=full_prompt,
            width=512,
            height=512,
            seed=int(datetime.now().timestamp()) % 1000000
        )

        # 保存到 tmp 目录
        filename = f"test_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}.png"
        file_path = self.tmp_dir / filename
        file_path.write_bytes(image_data)

        return filename


style_prompt_manager = StylePromptManager()
