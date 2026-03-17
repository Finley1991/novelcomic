from typing import List, Optional, Dict, Any, Union
import logging

from models.schemas import GlobalSettings, LLMProvider
from core.ollama import OllamaClient
from core.openai_client import OpenAIClient

logger = logging.getLogger(__name__)

class LLMClient:
    """Unified LLM client that supports multiple providers"""

    def __init__(self, settings: GlobalSettings):
        self.settings = settings
        self.provider = settings.llm.provider if hasattr(settings, 'llm') else LLMProvider.OLLAMA
        self._client = self._create_client()

    def _create_client(self) -> Union[OllamaClient, OpenAIClient]:
        if self.provider == LLMProvider.OPENAI:
            logger.info("Using OpenAI LLM provider")
            openai_settings = self.settings.llm.openai if hasattr(self.settings, 'llm') else None
            return OpenAIClient(
                api_key=openai_settings.apiKey if openai_settings else None,
                base_url=openai_settings.baseUrl if openai_settings else None,
                model=openai_settings.model if openai_settings else None,
                proxy=openai_settings.proxy if openai_settings and hasattr(openai_settings, 'proxy') else None
            )
        else:
            logger.info("Using Ollama LLM provider")
            # Try new llm.ollama first, fall back to old ollama
            ollama_settings = None
            if hasattr(self.settings, 'llm') and hasattr(self.settings.llm, 'ollama'):
                ollama_settings = self.settings.llm.ollama
            elif hasattr(self.settings, 'ollama'):
                ollama_settings = self.settings.ollama

            return OllamaClient(
                api_url=ollama_settings.apiUrl if ollama_settings else None,
                model=ollama_settings.model if ollama_settings else None
            )

    async def extract_characters(
        self,
        novel_text: str,
        project: Optional[Any] = None,
        global_settings: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        return await self._client.extract_characters(novel_text, project, global_settings)

    async def split_storyboard(
        self,
        novel_text: str,
        characters: List[Dict[str, Any]] = None,
        project: Optional[Any] = None,
        global_settings: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        return await self._client.split_storyboard(novel_text, characters, project, global_settings)

    async def generate_image_prompt(
        self,
        scene_description: str,
        characters: List[Dict[str, Any]] = None,
        style_prompt: str = "",
        project: Optional[Any] = None,
        global_settings: Optional[Any] = None
    ) -> str:
        if hasattr(self._client, 'generate_image_prompt'):
            return await self._client.generate_image_prompt(
                scene_description,
                characters,
                style_prompt,
                project,
                global_settings
            )
        return scene_description

    async def test_connection(self) -> dict:
        """Test the LLM connection with a simple prompt"""
        test_prompt = "请用一句话介绍你自己。"
        system_prompt = "你是一个友好的AI助手。"

        try:
            # Direct call without retry decorator for better error reporting
            response = await self._client._generate(test_prompt, system_prompt)
            return {
                "success": True,
                "provider": self.provider.value if hasattr(self.provider, 'value') else self.provider,
                "response": response
            }
        except Exception as e:
            logger.error(f"LLM test failed: {e}")
            return {
                "success": False,
                "provider": self.provider.value if hasattr(self.provider, 'value') else self.provider,
                "error": str(e)
            }
