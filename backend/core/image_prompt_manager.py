import json
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from pathlib import Path
import logging
import uuid

from config import settings
from models.schemas import (
    PromptSnippet, PromptSnippetCategory, ImagePromptTemplate
)

logger = logging.getLogger(__name__)


def _get_preset_snippets() -> List[PromptSnippet]:
    now = datetime.now()
    return [
        PromptSnippet(
            id="preset_style_anime",
            name="动漫风格",
            description="适合动漫风格的提示词",
            category=PromptSnippetCategory.STYLE,
            content="anime style, cel shading, vibrant colors",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_style_photorealistic",
            name="写实风格",
            description="写实风格提示词",
            category=PromptSnippetCategory.STYLE,
            content="photorealistic, sharp focus, ultra detailed",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_style_wuxia",
            name="古风武侠",
            description="古风武侠风格提示词",
            category=PromptSnippetCategory.STYLE,
            content="traditional Chinese art, wuxia style, ink painting",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_quality_masterpiece",
            name="高质量",
            description="高质量提示词",
            category=PromptSnippetCategory.QUALITY,
            content="masterpiece, best quality",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_quality_8k",
            name="8K超高清",
            description="8K分辨率提示词",
            category=PromptSnippetCategory.QUALITY,
            content="8k, ultra detailed, high resolution",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_lighting_cinematic",
            name="电影光感",
            description="电影光感提示词",
            category=PromptSnippetCategory.LIGHTING,
            content="cinematic lighting, dramatic shadows",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_lighting_natural",
            name="自然光",
            description="自然光提示词",
            category=PromptSnippetCategory.LIGHTING,
            content="natural lighting, soft shadows",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_composition_closeup",
            name="特写",
            description="特写构图提示词",
            category=PromptSnippetCategory.COMPOSITION,
            content="close-up, portrait, detailed face",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptSnippet(
            id="preset_composition_wide",
            name="广角",
            description="广角构图提示词",
            category=PromptSnippetCategory.COMPOSITION,
            content="wide angle, full body, environment",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
    ]


def _get_preset_templates() -> List[ImagePromptTemplate]:
    now = datetime.now()
    return [
        ImagePromptTemplate(
            id="preset_template_anime_quality",
            name="动漫高质量",
            description="动漫风格高质量提示词",
            template="{quality}, {lighting}, {scene}, {style}",
            snippetIds=[
                "preset_quality_masterpiece",
                "preset_lighting_cinematic",
                "preset_style_anime"
            ],
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        ImagePromptTemplate(
            id="preset_template_photorealistic",
            name="写实电影感",
            description="写实风格电影光感提示词",
            template="{quality}, {lighting}, {scene}, {style}",
            snippetIds=[
                "preset_quality_masterpiece",
                "preset_lighting_cinematic",
                "preset_style_photorealistic"
            ],
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        ImagePromptTemplate(
            id="preset_template_wuxia",
            name="古风武侠",
            description="古风武侠风格提示词",
            template="{quality}, {scene}, {style}",
            snippetIds=[
                "preset_quality_masterpiece",
                "preset_style_wuxia"
            ],
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
    ]


class ImagePromptManager:
    def __init__(self):
        self._storage_file = settings.data_dir / "image_prompts.json"
        self._preset_snippets = {s.id: s for s in _get_preset_snippets()}
        self._preset_templates = {t.id: t for t in _get_preset_templates()}
        self._user_snippets, self._user_templates = self._load_user_data()

    def _load_user_data(self) -> Tuple[Dict[str, PromptSnippet], Dict[str, ImagePromptTemplate]]:
        if not self._storage_file.exists():
            return {}, {}
        try:
            data = json.loads(self._storage_file.read_text())
            snippets = {}
            for s_data in data.get("snippets", []):
                if not s_data.get("isPreset", False):
                    s_data["category"] = PromptSnippetCategory(s_data["category"])
                    snippets[s_data["id"]] = PromptSnippet(**s_data)
            templates = {}
            for t_data in data.get("templates", []):
                if not t_data.get("isPreset", False):
                    templates[t_data["id"]] = ImagePromptTemplate(**t_data)
            return snippets, templates
        except Exception as e:
            logger.error(f"Failed to load user image prompts: {e}")
            return {}, {}

    def _save_user_data(self):
        data = {
            "snippets": [s.model_dump() for s in self._user_snippets.values()],
            "templates": [t.model_dump() for t in self._user_templates.values()]
        }
        self._storage_file.parent.mkdir(parents=True, exist_ok=True)
        self._storage_file.write_text(json.dumps(data, ensure_ascii=False, indent=2))

    # ===== Snippet Methods =====
    def load_all_snippets(self, category: Optional[PromptSnippetCategory] = None) -> List[PromptSnippet]:
        all_snippets = list(self._preset_snippets.values()) + list(self._user_snippets.values())
        if category:
            all_snippets = [s for s in all_snippets if s.category == category]
        return sorted(all_snippets, key=lambda s: (not s.isPreset, s.name))

    def get_snippet(self, snippet_id: str) -> Optional[PromptSnippet]:
        if snippet_id in self._preset_snippets:
            return self._preset_snippets[snippet_id]
        return self._user_snippets.get(snippet_id)

    def create_snippet(self, name: str, description: str, category: PromptSnippetCategory, content: str) -> PromptSnippet:
        snippet = PromptSnippet(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            category=category,
            content=content,
            isPreset=False
        )
        self._user_snippets[snippet.id] = snippet
        self._save_user_data()
        return snippet

    def update_snippet(self, snippet_id: str, **kwargs) -> Optional[PromptSnippet]:
        snippet = self.get_snippet(snippet_id)
        if not snippet or snippet.isPreset:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(snippet, key):
                setattr(snippet, key, value)
        snippet.updatedAt = datetime.now()
        self._user_snippets[snippet.id] = snippet
        self._save_user_data()
        return snippet

    def delete_snippet(self, snippet_id: str) -> bool:
        if snippet_id in self._preset_snippets or snippet_id not in self._user_snippets:
            return False
        del self._user_snippets[snippet_id]
        self._save_user_data()
        return True

    def duplicate_snippet(self, snippet_id: str, new_name: str) -> Optional[PromptSnippet]:
        original = self.get_snippet(snippet_id)
        if not original:
            return None
        snippet = PromptSnippet(
            id=str(uuid.uuid4()),
            name=new_name,
            description=original.description,
            category=original.category,
            content=original.content,
            isPreset=False
        )
        self._user_snippets[snippet.id] = snippet
        self._save_user_data()
        return snippet

    # ===== Template Methods =====
    def load_all_templates(self) -> List[ImagePromptTemplate]:
        all_templates = list(self._preset_templates.values()) + list(self._user_templates.values())
        return sorted(all_templates, key=lambda t: (not t.isPreset, t.name))

    def get_template(self, template_id: str) -> Optional[ImagePromptTemplate]:
        if template_id in self._preset_templates:
            return self._preset_templates[template_id]
        return self._user_templates.get(template_id)

    def create_template(self, name: str, description: str, template: str, snippet_ids: List[str]) -> ImagePromptTemplate:
        tpl = ImagePromptTemplate(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            template=template,
            snippetIds=snippet_ids,
            isPreset=False
        )
        self._user_templates[tpl.id] = tpl
        self._save_user_data()
        return tpl

    def update_template(self, template_id: str, **kwargs) -> Optional[ImagePromptTemplate]:
        tpl = self.get_template(template_id)
        if not tpl or tpl.isPreset:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(tpl, key):
                setattr(tpl, key, value)
        tpl.updatedAt = datetime.now()
        self._user_templates[tpl.id] = tpl
        self._save_user_data()
        return tpl

    def delete_template(self, template_id: str) -> bool:
        if template_id in self._preset_templates or template_id not in self._user_templates:
            return False
        del self._user_templates[template_id]
        self._save_user_data()
        return True

    def duplicate_template(self, template_id: str, new_name: str) -> Optional[ImagePromptTemplate]:
        original = self.get_template(template_id)
        if not original:
            return None
        tpl = ImagePromptTemplate(
            id=str(uuid.uuid4()),
            name=new_name,
            description=original.description,
            template=original.template,
            snippetIds=original.snippetIds.copy(),
            isPreset=False
        )
        self._user_templates[tpl.id] = tpl
        self._save_user_data()
        return tpl

    # ===== Render Method =====
    def render_template(self, template_id: str, **kwargs) -> Optional[str]:
        tpl = self.get_template(template_id)
        if not tpl:
            return None

        # 1. 收集片段内容，按分类分组
        snippets_by_category = {}
        for sid in tpl.snippetIds:
            snippet = self.get_snippet(sid)
            if snippet:
                cat = snippet.category.value
                if cat not in snippets_by_category:
                    snippets_by_category[cat] = []
                snippets_by_category[cat].append(snippet.content)

        # 同分类多个片段用逗号连接
        category_content = {}
        for cat, contents in snippets_by_category.items():
            category_content[cat] = ", ".join(contents)

        # 2. 准备变量映射
        variables = {
            "quality": category_content.get("quality", ""),
            "lighting": category_content.get("lighting", ""),
            "composition": category_content.get("composition", ""),
            "style": category_content.get("style", ""),
            "scene": kwargs.get("scene", ""),
            "characters": kwargs.get("characterPrompts", ""),
            "style_prompt": kwargs.get("stylePrompt", ""),
            "custom": kwargs.get("custom", ""),
        }

        # 3. 替换变量
        result = tpl.template
        for var_name, var_value in variables.items():
            result = result.replace(f"{{{var_name}}}", var_value)

        # 4. 添加额外片段
        additional_snippets = kwargs.get("additionalSnippets", [])
        for sid in additional_snippets:
            snippet = self.get_snippet(sid)
            if snippet:
                if result:
                    result += ", "
                result += snippet.content

        # 5. 清理多余的逗号和空格
        parts = [p.strip() for p in result.split(",") if p.strip()]
        result = ", ".join(parts)

        return result


image_prompt_manager = ImagePromptManager()
