import aiohttp
from aiohttp import ClientTimeout
import asyncio
from typing import Optional, Dict, Any
from copy import deepcopy
import uuid
import logging

from config import settings
from core.retry import async_retry
from models.schemas import ComfyUINodeMappings, ComfyUIWorkflowParams

logger = logging.getLogger(__name__)


class BaseComfyUIClient:
    """Base class for ComfyUI clients"""

    async def check_connection(self) -> bool:
        """Check if connection is available"""
        raise NotImplementedError

    async def generate_image(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 1024,
        height: int = 1024,
        steps: int = 30,
        cfg: float = 7.0,
        sampler_name: Optional[str] = None,
        seed: int = 0,
        workflow_id: Optional[str] = None,
    ) -> Optional[bytes]:
        """Generate an image and return the bytes"""
        raise NotImplementedError


class LocalComfyUIClient(BaseComfyUIClient):
    """Local ComfyUI client"""

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
            logger.error(f"Local ComfyUI connection check failed: {e}")
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
        timeout = ClientTimeout(total=300, connect=60)
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=timeout) as resp:
                if resp.status == 200:
                    return await resp.read()
                logger.error(f"Failed to get image {filename}: status {resp.status}")
                return None

    def _apply_workflow_mappings(
        self,
        workflow: Dict[str, Any],
        mappings: ComfyUINodeMappings,
        prompt: str,
        negative_prompt: str = "",
        width: int = 1024,
        height: int = 1024,
        steps: int = 30,
        cfg: float = 7.0,
        sampler_name: Optional[str] = None,
        seed: int = 0,
        batch_size: int = 1,
        params: Optional[ComfyUIWorkflowParams] = None
    ) -> Dict[str, Any]:
        workflow_copy = deepcopy(workflow)

        # Track which parameters are explicitly provided
        apply_steps = False
        apply_cfg = False
        apply_sampler = False

        # Apply workflow default parameters if available
        if params:
            width = params.width
            height = params.height
            steps = params.steps
            apply_steps = True
            cfg = params.cfg
            apply_cfg = True
            if params.samplerName is not None:
                sampler_name = params.samplerName
                apply_sampler = True
            # Only use params.seed if it's not 0 (0 means random)
            if params.seed != 0:
                seed = params.seed
            batch_size = params.batchSize

            # Apply prompt prefix/suffix
            prompt = f"{params.positivePromptPrefix}{prompt}{params.positivePromptSuffix}"

            # Apply negative prompt override if set
            if params.negativePromptOverride is not None:
                negative_prompt = params.negativePromptOverride

        if mappings.positivePromptNodeId:
            node = workflow_copy.get(mappings.positivePromptNodeId, {})
            if "inputs" in node:
                node["inputs"][mappings.positivePromptField] = prompt

        if mappings.negativePromptNodeId:
            node = workflow_copy.get(mappings.negativePromptNodeId, {})
            if "inputs" in node:
                node["inputs"][mappings.negativePromptField] = negative_prompt or "bad anatomy, bad hands"

        if mappings.widthNodeId:
            node = workflow_copy.get(mappings.widthNodeId, {})
            if "inputs" in node:
                node["inputs"][mappings.widthField] = width

        if mappings.heightNodeId:
            node = workflow_copy.get(mappings.heightNodeId, {})
            if "inputs" in node:
                node["inputs"][mappings.heightField] = height

        if mappings.batchNodeId:
            node = workflow_copy.get(mappings.batchNodeId, {})
            if "inputs" in node:
                node["inputs"][mappings.batchSizeField] = batch_size

        # Apply sampler-related parameters - only seed is always applied for reproducibility
        # steps, cfg, sampler_name are only applied if explicitly configured in params
        if mappings.samplerNodeId:
            node = workflow_copy.get(mappings.samplerNodeId, {})
            if "inputs" in node:
                # Always apply seed for reproducibility/randomization
                node["inputs"][mappings.seedField] = seed
                # Only apply other parameters if explicitly provided
                if apply_steps:
                    node["inputs"][mappings.stepsField] = steps
                if apply_cfg:
                    node["inputs"][mappings.cfgField] = cfg
                if apply_sampler and sampler_name is not None:
                    node["inputs"][mappings.samplerField] = sampler_name

        return workflow_copy

    async def generate_image(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 1024,
        height: int = 1024,
        steps: int = 30,
        cfg: float = 7.0,
        sampler_name: Optional[str] = None,
        seed: int = 0,
        workflow_id: Optional[str] = None,
    ) -> Optional[bytes]:
        from core.storage import storage

        if workflow_id:
            workflow = storage.get_comfyui_workflow(workflow_id)
        else:
            settings_obj = storage.load_global_settings()
            if not settings_obj.comfyui.activeWorkflowId:
                raise Exception("No active ComfyUI workflow. Please upload and activate a workflow in Settings.")
            workflow = storage.get_comfyui_workflow(settings_obj.comfyui.activeWorkflowId)

        if not workflow:
            raise Exception("ComfyUI workflow not found")

        workflow_json = self._apply_workflow_mappings(
            workflow=workflow.workflowJson,
            mappings=workflow.nodeMappings,
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            steps=steps,
            cfg=cfg,
            sampler_name=sampler_name,
            seed=seed,
            batch_size=1,
            params=workflow.defaultParams
        )

        logger.info(f"Using seed: {seed}")
        prompt_id = await self._queue_prompt(workflow_json)
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
                        logger.info(f"Downloading image: {img_info['filename']}")
                        img_data = await self._get_image(
                            img_info["filename"],
                            img_info.get("subfolder", ""),
                            img_info.get("type", "output")
                        )
                        if img_data:
                            logger.info(f"Successfully got image data: {len(img_data)} bytes")
                            return img_data
                        else:
                            logger.error(f"Failed to get image data for {img_info}")

            await asyncio.sleep(poll_interval)
            waited += poll_interval

        raise Exception("Timeout waiting for ComfyUI generation")


class RunningHubComfyUIClient(LocalComfyUIClient):
    """RunningHub cloud ComfyUI client using native proxy API"""

    def __init__(self, api_key: Optional[str] = None):
        from core.storage import storage

        settings_obj = storage.load_global_settings()

        self.api_key = api_key or settings_obj.comfyui.runninghub.apiKey

        if not self.api_key:
            raise ValueError("RunningHub API key is required")

        # Use RunningHub proxy URL - works exactly like local ComfyUI
        # Format: https://www.runninghub.cn/proxy/{api_key}
        proxy_url = f"https://www.runninghub.cn/proxy/{self.api_key}"
        self.api_url = proxy_url
        self.client_id = str(uuid.uuid4())

        logger.info(f"RunningHub client initialized with proxy: {proxy_url}")


class ComfyUIClient(BaseComfyUIClient):
    """Unified ComfyUI client that supports both local and RunningHub"""

    def __init__(self, provider: Optional[str] = None):
        from core.storage import storage

        settings_obj = storage.load_global_settings()
        self.provider = provider or settings_obj.comfyui.provider.value

        if self.provider == "runninghub":
            self._client = RunningHubComfyUIClient()
        else:
            self._client = LocalComfyUIClient()

    async def check_connection(self) -> bool:
        """Check if connection is available"""
        return await self._client.check_connection()

    async def generate_image(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 1024,
        height: int = 1024,
        steps: int = 30,
        cfg: float = 7.0,
        sampler_name: Optional[str] = None,
        seed: int = 0,
        workflow_id: Optional[str] = None,
    ) -> Optional[bytes]:
        """Generate an image and return the bytes"""
        return await self._client.generate_image(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            steps=steps,
            cfg=cfg,
            sampler_name=sampler_name,
            seed=seed,
            workflow_id=workflow_id,
        )


# Singleton instance
_comfyui_client: Optional[ComfyUIClient] = None


def get_comfyui_client() -> ComfyUIClient:
    """Get ComfyUI client singleton"""
    global _comfyui_client
    if _comfyui_client is None:
        _comfyui_client = ComfyUIClient()
    return _comfyui_client


def reset_comfyui_client() -> None:
    """Reset ComfyUI client singleton"""
    global _comfyui_client
    _comfyui_client = None
