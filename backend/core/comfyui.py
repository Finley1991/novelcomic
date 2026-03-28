import aiohttp
import asyncio
from typing import Optional, Dict, Any, List
from copy import deepcopy
import uuid
import logging

from config import settings
from core.retry import async_retry
from models.schemas import ComfyUINodeMappings, ComfyUIWorkflowParams

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
        sampler_name: str = "dpmpp_2m_sde_karras",
        seed: int = 0,
        batch_size: int = 1,
        params: Optional[ComfyUIWorkflowParams] = None
    ) -> Dict[str, Any]:
        workflow_copy = deepcopy(workflow)

        # Apply workflow default parameters if available
        if params:
            width = params.width
            height = params.height
            steps = params.steps
            cfg = params.cfg
            if params.samplerName is not None:
                sampler_name = params.samplerName
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

        return workflow_copy

    async def generate_image(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 1024,
        height: int = 1024,
        steps: int = 30,
        cfg: float = 7.0,
        sampler_name: str = "dpmpp_2m_sde_karras",
        seed: int = 0,
        workflow_id: Optional[str] = None
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
