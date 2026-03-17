import aiohttp
import json
from typing import List, Optional, Dict, Any
import logging

from config import settings
from core.retry import async_retry

logger = logging.getLogger(__name__)

class OllamaClient:
    def __init__(self, api_url: Optional[str] = None, model: Optional[str] = None):
        self.api_url = api_url or settings.ollama_api_url
        self.model = model or settings.ollama_model
        self.chunk_size = settings.ollama_chunk_size
        self.overlap_size = 500

    async def _generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        url = f"{self.api_url}/api/generate"

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "num_predict": 2048
            }
        }

        if system_prompt:
            payload["system"] = system_prompt

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=settings.ollama_timeout) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise Exception(f"Ollama API error: {resp.status} - {text}")
                data = await resp.json()
                return data.get("response", "")

    @async_retry(retries=settings.ollama_max_retries, delay=1.0, backoff=2.0)
    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        return await self._generate(prompt, system_prompt)

    def _chunk_text(self, text: str) -> List[str]:
        if len(text) <= self.chunk_size:
            return [text]

        chunks = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = min(start + self.chunk_size, text_len)
            if start > 0:
                start = max(0, start - self.overlap_size)
            chunk = text[start:end]
            chunks.append(chunk)
            start = end

        return chunks

    async def extract_characters(self, novel_text: str) -> List[Dict[str, Any]]:
        chunks = self._chunk_text(novel_text)
        all_characters = []
        seen_names = set()

        for chunk in chunks:
            system_prompt = "你是一个专业的小说角色提取助手。从小说文本中提取所有主要角色。"

            prompt = f"""从以下小说文本中提取所有主要角色。对每个角色提供：
1. name: 姓名
2. description: 外貌描述
3. personality: 性格特点

仅返回JSON数组，格式如下：
[
  {{
    "name": "角色名",
    "description": "外貌描述",
    "personality": "性格特点"
  }}
]

小说文本：
{chunk}
"""

            try:
                response = await self.generate(prompt, system_prompt)
                json_start = response.find("[")
                json_end = response.rfind("]") + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response[json_start:json_end]
                    chars = json.loads(json_str)
                    for char in chars:
                        name = char.get("name", "")
                        if name and name not in seen_names:
                            seen_names.add(name)
                            all_characters.append(char)
            except Exception as e:
                logger.error(f"Failed to extract characters from chunk: {e}")

        return all_characters

    async def split_storyboard(self, novel_text: str, characters: List[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        chunks = self._chunk_text(novel_text)
        all_storyboards = []
        current_index = 0

        for chunk_idx, chunk in enumerate(chunks):
            system_prompt = "你是一个专业的漫剧分镜师。将小说拆分为多个分镜。"

            char_info = ""
            if characters:
                char_info = "角色列表：\n" + "\n".join([f"- {c.get('name', '')}: {c.get('description', '')}" for c in characters])

            prompt = f"""{char_info}

将以下小说文本拆分为多个分镜。每个分镜应该有3-5秒的画面时长。

对每个分镜提供：
1. index: 序号（从{current_index}开始）
2. sceneDescription: 画面描述（详细的视觉描述，用于AI绘画）
3. dialogue: 角色台词（如果有）
4. narration: 旁白（如果有）
5. characterNames: 出现的角色名数组

仅返回JSON数组，格式如下：
[
  {{
    "index": 0,
    "sceneDescription": "画面描述...",
    "dialogue": "台词",
    "narration": "旁白",
    "characterNames": ["角色1", "角色2"]
  }}
]

小说文本：
{chunk}
"""

            try:
                response = await self.generate(prompt, system_prompt)
                json_start = response.find("[")
                json_end = response.rfind("]") + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response[json_start:json_end]
                    sbs = json.loads(json_str)
                    for sb in sbs:
                        sb["index"] = current_index
                        all_storyboards.append(sb)
                        current_index += 1
            except Exception as e:
                logger.error(f"Failed to split storyboard from chunk: {e}")

        return all_storyboards

    async def generate_image_prompt(self, scene_description: str, characters: List[Dict[str, Any]] = None, style_prompt: str = "") -> str:
        system_prompt = "你是一个专业的AI绘画提示词工程师。将画面描述转换为Stable Diffusion提示词。"

        char_info = ""
        if characters:
            char_info = "角色提示词：\n" + "\n".join([f"- {c.get('name', '')}: {c.get('characterPrompt', '')}" for c in characters])

        prompt = f"""{char_info}
风格提示词：{style_prompt}

将以下画面描述转换为详细的Stable Diffusion英文提示词。要求：
- 详细的视觉描述
- 包含光影、氛围、构图等元素
- 使用英文

画面描述：
{scene_description}

仅返回提示词内容，不要其他说明。
"""

        try:
            return await self.generate(prompt, system_prompt)
        except Exception as e:
            logger.error(f"Failed to generate image prompt: {e}")
            return scene_description
