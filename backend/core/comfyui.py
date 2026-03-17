import aiohttp
import asyncio
from typing import Optional, Dict, Any, List
import uuid
import logging

from config import settings
from core.retry import async_retry

logger = logging.getLogger(__name__)

class ComfyUIClient:
    def __init__(self, api_url: Optional[str] = None):
        self.api_url = api_url or settings.comfyui_api_url
        self.client_id = str(uuid.uuid4())

    async def check_connection(self) -> bool:
        try:
            url = f"{self.api_url}/system_stats"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as resp:
                    return resp.status == 200
        except Exception as e:
            logger.error(f"ComfyUI connection check failed: {e}")
            return False

    @async_retry(retries=settings.comfyui_max_retries, delay=2.0, backoff=2.0)
    async def _queue_prompt(self, workflow: Dict[str, Any]) -> str:
        url = f"{self.api_url}/prompt"
        payload = {
            "prompt": workflow,
            "client_id": self.client_id
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=settings.comfyui_timeout) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise Exception(f"ComfyUI API error: {resp.status} - {text}")
                data = await resp.json()
                return data.get("prompt_id")

    async def _get_history(self, prompt_id: str) -> Optional[Dict[str, Any]]:
        url = f"{self.api_url}/history/{prompt_id}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=30) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get(prompt_id)
                return None

    async def _get_image(self, filename: str, subfolder: str = "", type: str = "output") -> Optional[bytes]:
        url = f"{self.api_url}/view"
        params = {"filename": filename, "subfolder": subfolder, "type": type}
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=30) as resp:
                if resp.status == 200:
                    return await resp.read()
                return None

    async def generate_image(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 1024,
        height: int = 1024,
        steps: int = 30,
        cfg: float = 7.0,
        sampler_name: str = "dpmpp_2m_sde_karras"
    ) -> Optional[bytes]:
        workflow = self._build_text_to_image_workflow(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            steps=steps,
            cfg=cfg,
            sampler_name=sampler_name
        )

        prompt_id = await self._queue_prompt(workflow)
        logger.info(f"Queued ComfyUI prompt: {prompt_id}")

        max_wait = settings.comfyui_timeout
        poll_interval = 2.0
        waited = 0.0

        while waited < max_wait:
            history = await self._get_history(prompt_id)
            if history and "outputs" in history:
                outputs = history["outputs"]
                for node_id, node_output in outputs.items():
                    if "images" in node_output and node_output["images"]:
                        img_info = node_output["images"][0]
                        img_data = await self._get_image(
                            img_info["filename"],
                            img_info.get("subfolder", ""),
                            img_info.get("type", "output")
                        )
                        if img_data:
                            return img_data

            await asyncio.sleep(poll_interval)
            waited += poll_interval

        raise Exception("Timeout waiting for ComfyUI generation")

    def _build_text_to_image_workflow(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 1024,
        height: int = 1024,
        steps: int = 30,
        cfg: float = 7.0,
        sampler_name: str = "dpmpp_2m_sde_karras"
    ) -> Dict[str, Any]:
        return {
            "3": {
                "inputs": {
                    "seed": 0,
                    "steps": steps,
                    "cfg": cfg,
                    "sampler_name": sampler_name,
                    "scheduler": "karras",
                    "denoise": 1.0,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["5", 0]
                },
                "class_type": "KSampler"
            },
            "4": {
                "inputs": {
                    "ckpt_name": "v1-5-pruned-emaonly.ckpt"
                },
                "class_type": "CheckpointLoaderSimple"
            },
            "5": {
                "inputs": {
                    "width": width,
                    "height": height,
                    "batch_size": 1
                },
                "class_type": "EmptyLatentImage"
            },
            "6": {
                "inputs": {
                    "text": prompt,
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "7": {
                "inputs": {
                    "text": negative_prompt or "bad anatomy, bad hands",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "8": {
                "inputs": {
                    "samples": ["3", 0],
                    "vae": ["4", 2]
                },
                "class_type": "VAEDecode"
            },
            "9": {
                "inputs": {
                    "filename_prefix": "ComfyUI",
                    "images": ["8", 0]
                },
                "class_type": "SaveImage"
            }
        }
