import aiohttp
import json
from typing import List, Optional, Dict, Any
import logging

from config import settings
from core.retry import async_retry
from core.prompt_templates import prompt_template_manager
from models.schemas import PromptType

logger = logging.getLogger(__name__)

class OpenAIClient:
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None, proxy: Optional[str] = None):
        self.api_key = api_key if api_key is not None else settings.openai_api_key
        self.base_url = base_url if base_url is not None else settings.openai_base_url
        self.model = model if model is not None else settings.openai_model
        self.proxy = proxy
        self.chunk_size = settings.openai_chunk_size
        self.overlap_size = 500
        logger.info(f"OpenAIClient initialized with base_url={self.base_url}, model={self.model}, proxy={self.proxy}, api_key_set={bool(self.api_key and self.api_key.strip())}")

    async def _generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        logger.info(f"Calling OpenAI API at {self.base_url} with model {self.model}")

        if not self.api_key or not self.api_key.strip():
            raise Exception("OpenAI API Key is not configured")

        url = f"{self.base_url}/chat/completions"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 2048
        }

        try:
            timeout = aiohttp.ClientTimeout(total=300)
            connector = None

            async with aiohttp.ClientSession(timeout=timeout, connector=connector, trust_env=True) as session:
                logger.info(f"Sending request to {url}" + (f" via proxy {self.proxy}" if self.proxy else ""))

                request_kwargs = {
                    "url": url,
                    "json": payload,
                    "headers": headers
                }

                if self.proxy and self.proxy.strip():
                    request_kwargs["proxy"] = self.proxy

                async with session.post(**request_kwargs) as resp:
                    logger.info(f"Response status: {resp.status}")
                    if resp.status != 200:
                        text = await resp.text()
                        logger.error(f"OpenAI API error: {resp.status} - {text}")
                        raise Exception(f"OpenAI API error: {resp.status} - {text}")
                    data = await resp.json()
                    result = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    logger.info(f"Response received successfully")
                    return result
        except Exception as e:
            logger.error(f"Error calling OpenAI: {e}")
            raise

    @async_retry(retries=settings.openai_max_retries, delay=1.0, backoff=2.0)
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

    async def extract_characters(
        self,
        novel_text: str,
        project: Optional[Any] = None,
        global_settings: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        chunks = self._chunk_text(novel_text)
        all_characters = []
        seen_names = set()

        template = prompt_template_manager.get_resolved_template(
            PromptType.CHARACTER_EXTRACTION,
            project,
            global_settings
        )

        for chunk in chunks:
            system_prompt, user_prompt = prompt_template_manager.render_template(
                template,
                chunk=chunk
            )

            try:
                response = await self.generate(user_prompt, system_prompt)
                logger.info(f"LLM response for character extraction: {response[:200]}...")

                # 移除可能的 markdown 代码块标记
                response = response.strip()
                if response.startswith("```json"):
                    response = response[7:]
                if response.startswith("```"):
                    response = response[3:]
                if response.endswith("```"):
                    response = response[:-3]
                response = response.strip()

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
                else:
                    logger.warning(f"No JSON array found in response: {response}")
            except Exception as e:
                logger.error(f"Failed to extract characters from chunk: {e}")

        return all_characters

    async def split_storyboard(
        self,
        novel_text: str,
        characters: List[Dict[str, Any]] = None,
        project: Optional[Any] = None,
        global_settings: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        chunks = self._chunk_text(novel_text)
        all_storyboards = []
        current_index = 0

        template = prompt_template_manager.get_resolved_template(
            PromptType.STORYBOARD_SPLIT,
            project,
            global_settings
        )

        for chunk_idx, chunk in enumerate(chunks):
            char_info = ""
            if characters:
                char_info = "角色列表：\n" + "\n".join([f"- {c.get('name', '')}: {c.get('description', '')}" for c in characters])

            system_prompt, user_prompt = prompt_template_manager.render_template(
                template,
                chunk=chunk,
                characters=char_info,
                current_index=str(current_index)
            )

            try:
                response = await self.generate(user_prompt, system_prompt)
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

    async def generate_image_prompt(
        self,
        scene_description: str,
        characters: List[Dict[str, Any]] = None,
        style_prompt: str = "",
        project: Optional[Any] = None,
        global_settings: Optional[Any] = None
    ) -> str:
        template = prompt_template_manager.get_resolved_template(
            PromptType.IMAGE_PROMPT,
            project,
            global_settings
        )

        char_info = ""
        if characters:
            char_info = "角色提示词：\n" + "\n".join([f"- {c.get('name', '')}: {c.get('characterPrompt', '')}" for c in characters])

        system_prompt, user_prompt = prompt_template_manager.render_template(
            template,
            scene_description=scene_description,
            characters=char_info,
            style_prompt=style_prompt
        )

        try:
            return await self.generate(user_prompt, system_prompt)
        except Exception as e:
            logger.error(f"Failed to generate image prompt: {e}")
            return scene_description

    async def extract_scenes(
        self,
        novel_text: str,
        project: Optional[Any] = None,
        global_settings: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        chunks = self._chunk_text(novel_text)
        all_scenes = []
        seen_names = set()

        from models.schemas import PromptType
        template = prompt_template_manager.get_resolved_template(
            PromptType.SCENE_EXTRACTION,
            project,
            global_settings
        )

        for chunk in chunks:
            system_prompt, user_prompt = prompt_template_manager.render_template(
                template,
                chunk=chunk
            )

            try:
                response = await self.generate(user_prompt, system_prompt)
                logger.info(f"Raw scene extraction response: {response[:500]}...")

                # 移除可能的 markdown 代码块标记
                response = response.strip()
                if response.startswith("```json"):
                    response = response[7:]
                if response.startswith("```"):
                    response = response[3:]
                if response.endswith("```"):
                    response = response[:-3]
                response = response.strip()

                json_start = response.find("[")
                json_end = response.rfind("]") + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response[json_start:json_end]
                    scenes = json.loads(json_str)
                    for scene in scenes:
                        name = scene.get("name", "")
                        if name and name not in seen_names:
                            seen_names.add(name)
                            all_scenes.append(scene)
            except Exception as e:
                logger.error(f"Failed to extract scenes from chunk: {e}")

        return all_scenes

    async def generate_image_prompt_enhanced(
        self,
        storyboard: Any,
        project: Any,
        surrounding_storyboards: List[Any],
        global_settings: Optional[Any] = None
    ) -> str:
        from models.schemas import PromptType

        template = prompt_template_manager.get_resolved_template(
            PromptType.IMAGE_PROMPT,
            project,
            global_settings
        )

        # 构建角色信息
        char_map = {c.id: c for c in project.characters}
        characters = [char_map[cid] for cid in storyboard.characterIds if cid in char_map]
        char_info = ""
        if characters:
            char_info = "角色信息：\n" + "\n".join([f"- {c.name}: {c.description}" for c in characters])

        # 构建场景信息
        scene_info = ""
        if storyboard.sceneId:
            scene = next((s for s in project.scenes if s.id == storyboard.sceneId), None)
            if scene:
                scene_info = f"场景：{scene.name}\n场景描述：{scene.description}"

        # 构建上下文分镜信息
        context_info = ""
        if surrounding_storyboards:
            current_idx = next((i for i, sb in enumerate(surrounding_storyboards) if sb.id == storyboard.id), 0)
            context_info = ""
            before_context = []
            after_context = []
            for i, sb in enumerate(surrounding_storyboards):
                if i < current_idx:
                    before_context.append(f"- {sb.sceneDescription}")
                elif i > current_idx:
                    after_context.append(f"- {sb.sceneDescription}")

            if before_context:
                context_info += f"前{len(before_context)}个分镜：\n" + "\n".join(before_context) + "\n\n"
            if after_context:
                context_info += f"后{len(after_context)}个分镜：\n" + "\n".join(after_context)

        system_prompt, user_prompt = prompt_template_manager.render_template(
            template,
            scene_description=storyboard.sceneDescription,
            characters=char_info,
            style_prompt=project.stylePrompt,
            scene_info=scene_info,
            context_storyboards=context_info
        )

        try:
            return await self.generate(user_prompt, system_prompt)
        except Exception as e:
            logger.error(f"Failed to generate enhanced image prompt: {e}")
            return storyboard.sceneDescription
