import json
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from pathlib import Path
import logging

from config import settings
from models.schemas import (
    PromptTemplate, PromptType, PromptVariable
)

logger = logging.getLogger(__name__)

# 预设模板定义
def _get_preset_templates() -> List[PromptTemplate]:
    now = datetime.now()
    return [
        # ========== 角色提取预设 ==========
        PromptTemplate(
            id="preset_character_extraction_1",
            name="通用版",
            description="通用的角色提取模板，适合大多数小说",
            type=PromptType.CHARACTER_EXTRACTION,
            systemPrompt="你是一个专业的小说角色提取助手。从小说文本中提取所有主要角色。",
            userPrompt="""从以下小说文本中提取所有主要角色。对每个角色提供：
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
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_character_extraction_2",
            name="动漫风格",
            description="注重动漫化视觉特征的角色提取",
            type=PromptType.CHARACTER_EXTRACTION,
            systemPrompt="你是一个专业的动漫角色设计助手。从小说文本中提取角色，注重动漫化的视觉特征。",
            userPrompt="""从以下小说文本中提取所有主要角色，以动漫风格进行描述。对每个角色提供：
1. name: 姓名
2. description: 外貌描述（包括发色、瞳色、发型、服装风格等动漫特征）
3. personality: 性格特点

仅返回JSON数组，格式如下：
[
  {{
    "name": "角色名",
    "description": "外貌描述，包含动漫特征",
    "personality": "性格特点"
  }}
]

小说文本：
{chunk}
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_character_extraction_3",
            name="写实风格",
            description="注重真实人物描写的角色提取",
            type=PromptType.CHARACTER_EXTRACTION,
            systemPrompt="你是一个专业的角色分析助手。从小说文本中提取角色，注重真实的人物描写。",
            userPrompt="""从以下小说文本中提取所有主要角色，以写实风格进行描述。对每个角色提供：
1. name: 姓名
2. description: 外貌描述（包括真实的年龄特征、气质、身材等）
3. personality: 性格特点

仅返回JSON数组，格式如下：
[
  {{
    "name": "角色名",
    "description": "真实的外貌描述",
    "personality": "性格特点"
  }}
]

小说文本：
{chunk}
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_character_extraction_4",
            name="古风/武侠",
            description="适合古风/武侠小说的角色提取",
            type=PromptType.CHARACTER_EXTRACTION,
            systemPrompt="你是一个专业的古风小说角色设计助手。从小说文本中提取武侠/古风角色。",
            userPrompt="""从以下小说文本中提取所有主要角色，以古风/武侠风格进行描述。对每个角色提供：
1. name: 姓名
2. description: 外貌描述（包括古风服饰、发型、武器、门派特征等）
3. personality: 性格特点

仅返回JSON数组，格式如下：
[
  {{
    "name": "角色名",
    "description": "古风外貌描述",
    "personality": "性格特点"
  }}
]

小说文本：
{chunk}
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),

        # ========== 分镜拆分预设 ==========
        PromptTemplate(
            id="preset_storyboard_split_1",
            name="通用版",
            description="通用的分镜拆分模板",
            type=PromptType.STORYBOARD_SPLIT,
            systemPrompt="你是一个专业的漫剧分镜师。将小说拆分为多个分镜。",
            userPrompt="""{characters}

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
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_storyboard_split_2",
            name="动漫风格",
            description="注重动漫视觉效果的分镜拆分",
            type=PromptType.STORYBOARD_SPLIT,
            systemPrompt="你是一个专业的动漫分镜师。将小说拆分为适合动漫表现的分镜。",
            userPrompt="""{characters}

将以下小说文本拆分为多个动漫分镜。每个分镜应该有3-5秒的画面时长。
注重：
- 画面的视觉冲击力
- 角色表情特写
- 动漫典型构图（低角度、大特写、动态模糊等）
- 动态感和表现力

对每个分镜提供：
1. index: 序号（从{current_index}开始）
2. sceneDescription: 画面描述（详细的动漫风格视觉描述）
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
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_storyboard_split_3",
            name="写实风格",
            description="注重电影感的分镜拆分",
            type=PromptType.STORYBOARD_SPLIT,
            systemPrompt="你是一个专业的电影分镜师。将小说拆分为适合电影表现的分镜。",
            userPrompt="""{characters}

将以下小说文本拆分为多个电影分镜。每个分镜应该有3-5秒的画面时长。
注重：
- 真实场景描写
- 光影效果（cinematic lighting）
- 摄影构图（三分法、景深等）
- 真实的镜头语言

对每个分镜提供：
1. index: 序号（从{current_index}开始）
2. sceneDescription: 画面描述（详细的电影风格视觉描述）
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
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_storyboard_split_4",
            name="古风/武侠",
            description="适合古风/武侠的分镜拆分",
            type=PromptType.STORYBOARD_SPLIT,
            systemPrompt="你是一个专业的武侠剧分镜师。将小说拆分为适合武侠/古风表现的分镜。",
            userPrompt="""{characters}

将以下小说文本拆分为多个武侠/古风分镜。每个分镜应该有3-5秒的画面时长。
注重：
- 古风场景（古建筑、山水、园林等）
- 武侠动作描写
- 古风构图和意境
- 武器和招式的视觉表现

对每个分镜提供：
1. index: 序号（从{current_index}开始）
2. sceneDescription: 画面描述（详细的古风/武侠风格视觉描述）
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
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),

        # ========== 图像生成预设 ==========
        PromptTemplate(
            id="preset_image_prompt_1",
            name="通用版",
            description="通用的图像生成提示词模板",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="你是一个专业的AI绘画提示词工程师。将画面描述转换为Stable Diffusion提示词。",
            userPrompt="""{characters}
风格提示词：{style_prompt}

将以下画面描述转换为详细的Stable Diffusion英文提示词。要求：
- 详细的视觉描述
- 包含光影、氛围、构图等元素
- 使用英文

画面描述：
{scene_description}

仅返回提示词内容，不要其他说明。
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_image_prompt_2",
            name="动漫风格",
            description="动漫风格的图像生成",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="你是一个专业的动漫AI绘画提示词工程师。将画面描述转换为动漫风格的Stable Diffusion提示词。",
            userPrompt="""{characters}
风格提示词：{style_prompt}

将以下画面描述转换为详细的Stable Diffusion英文提示词。要求：
- 动漫风格 (anime style, cel shading)
- 鲜艳的色彩 (vibrant colors)
- 详细的视觉描述
- 包含光影、氛围、构图等元素
- 使用英文

画面描述：
{scene_description}

仅返回提示词内容，不要其他说明。请在开头自动添加 "anime style, cel shading, vibrant colors, "。
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_image_prompt_3",
            name="写实风格",
            description="写实风格的图像生成",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="你是一个专业的写实摄影提示词工程师。将画面描述转换为写实风格的Stable Diffusion提示词。",
            userPrompt="""{characters}
风格提示词：{style_prompt}

将以下画面描述转换为详细的Stable Diffusion英文提示词。要求：
- 写实风格 (photorealistic)
- 电影光感 (cinematic lighting)
- 锐焦 (sharp focus)
- 详细的视觉描述
- 包含光影、氛围、构图等元素
- 使用英文

画面描述：
{scene_description}

仅返回提示词内容，不要其他说明。请在开头自动添加 "photorealistic, cinematic lighting, sharp focus, ultra detailed, "。
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_image_prompt_4",
            name="古风/武侠",
            description="古风/武侠风格的图像生成",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="你是一个专业的古风绘画提示词工程师。将画面描述转换为古风/武侠风格的Stable Diffusion提示词。",
            userPrompt="""{characters}
风格提示词：{style_prompt}

将以下画面描述转换为详细的Stable Diffusion英文提示词。要求：
- 中国传统艺术风格 (traditional Chinese art)
- 武侠风格 (wuxia)
- 水墨效果 (ink painting)
- 详细的视觉描述
- 包含古风建筑、服饰、山水等元素
- 使用英文

画面描述：
{scene_description}

仅返回提示词内容，不要其他说明。请在开头自动添加 "traditional Chinese art, wuxia style, ink painting, "。
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),

        # ========== 场景提取预设 ==========
        PromptTemplate(
            id="preset_scene_extraction_1",
            name="通用版",
            description="通用的场景提取模板",
            type=PromptType.SCENE_EXTRACTION,
            systemPrompt="你是一个专业的小说场景提取助手。从小说文本中提取所有主要场景。",
            userPrompt="""从以下小说文本中提取所有主要场景。对每个场景提供：
1. name: 场景名称（简洁描述性名称，如"森林中的小屋"）
2. description: 场景详细视觉描述（用于AI绘画的详细描述）

仅返回JSON数组，格式如下：
[
  {
    "name": "场景名称",
    "description": "详细的视觉描述"
  }
]

小说文本：
{chunk}
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_scene_extraction_2",
            name="动漫风格",
            description="注重动漫化视觉特征的场景提取",
            type=PromptType.SCENE_EXTRACTION,
            systemPrompt="你是一个专业的动漫场景设计助手。从小说文本中提取场景，注重动漫化的视觉特征。",
            userPrompt="""从以下小说文本中提取所有主要场景，以动漫风格进行描述。对每个场景提供：
1. name: 场景名称（简洁描述性名称，如"森林中的小屋"）
2. description: 场景详细视觉描述（包含动漫风格的色彩、光影、构图等）

仅返回JSON数组，格式如下：
[
  {
    "name": "场景名称",
    "description": "动漫风格的详细视觉描述"
  }
]

小说文本：
{chunk}
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_scene_extraction_3",
            name="写实风格",
            description="注重真实场景描写的场景提取",
            type=PromptType.SCENE_EXTRACTION,
            systemPrompt="你是一个专业的电影场景设计助手。从小说文本中提取场景，注重真实的场景描写。",
            userPrompt="""从以下小说文本中提取所有主要场景，以写实风格进行描述。对每个场景提供：
1. name: 场景名称（简洁描述性名称，如"森林中的小屋"）
2. description: 场景详细视觉描述（包含真实的光影、材质、建筑细节等）

仅返回JSON数组，格式如下：
[
  {
    "name": "场景名称",
    "description": "写实风格的详细视觉描述"
  }
]

小说文本：
{chunk}
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_scene_extraction_4",
            name="古风/武侠",
            description="适合古风/武侠小说的场景提取",
            type=PromptType.SCENE_EXTRACTION,
            systemPrompt="你是一个专业的古风小说场景设计助手。从小说文本中提取武侠/古风场景。",
            userPrompt="""从以下小说文本中提取所有主要场景，以古风/武侠风格进行描述。对每个场景提供：
1. name: 场景名称（简洁描述性名称，如"山间凉亭"）
2. description: 场景详细视觉描述（包含古风建筑、山水、园林、武器等元素）

仅返回JSON数组，格式如下：
[
  {
    "name": "场景名称",
    "description": "古风风格的详细视觉描述"
  }
]

小说文本：
{chunk}
""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
    ]


def _get_variables_for_type(prompt_type: PromptType) -> List[PromptVariable]:
    if prompt_type == PromptType.CHARACTER_EXTRACTION:
        return [
            PromptVariable(
                name="chunk",
                description="当前处理的小说文本片段",
                example="第一章 初遇..."
            )
        ]
    elif prompt_type == PromptType.STORYBOARD_SPLIT:
        return [
            PromptVariable(
                name="chunk",
                description="当前处理的小说文本片段",
                example="第一章 初遇..."
            ),
            PromptVariable(
                name="characters",
                description="角色列表信息",
                example="角色：\n- 张三：..."
            ),
            PromptVariable(
                name="current_index",
                description="当前分镜起始序号",
                example="0"
            )
        ]
    elif prompt_type == PromptType.IMAGE_PROMPT:
        return [
            PromptVariable(
                name="scene_description",
                description="分镜画面描述",
                example="森林中的小屋..."
            ),
            PromptVariable(
                name="characters",
                description="角色提示词列表",
                example="角色提示词：\n- 张三：..."
            ),
            PromptVariable(
                name="style_prompt",
                description="风格提示词",
                example="anime style..."
            )
        ]
    elif prompt_type == PromptType.SCENE_EXTRACTION:
        return [
            PromptVariable(
                name="chunk",
                description="当前处理的小说文本片段",
                example="第一章 初遇..."
            )
        ]
    return []


class PromptTemplateManager:
    def __init__(self):
        self._storage_file = settings.data_dir / "prompt_templates.json"
        self._presets = {t.id: t for t in _get_preset_templates()}
        self._user_templates = self._load_user_templates()

    def _load_user_templates(self) -> Dict[str, PromptTemplate]:
        if not self._storage_file.exists():
            return {}
        try:
            data = json.loads(self._storage_file.read_text())
            templates = {}
            for t_data in data:
                if not t_data.get("isPreset", False):
                    t_data["type"] = PromptType(t_data["type"])
                    templates[t_data["id"]] = PromptTemplate(**t_data)
            return templates
        except Exception as e:
            logger.error(f"Failed to load user templates: {e}")
            return {}

    def _save_user_templates(self):
        data = [t.model_dump() for t in self._user_templates.values()]
        self._storage_file.parent.mkdir(parents=True, exist_ok=True)
        self._storage_file.write_text(json.dumps(data, ensure_ascii=False, indent=2))

    def load_all_templates(self, prompt_type: Optional[PromptType] = None) -> List[PromptTemplate]:
        all_templates = list(self._presets.values()) + list(self._user_templates.values())
        if prompt_type:
            all_templates = [t for t in all_templates if t.type == prompt_type]
        return sorted(all_templates, key=lambda t: (not t.isPreset, t.name))

    def get_template(self, template_id: str) -> Optional[PromptTemplate]:
        if template_id in self._presets:
            return self._presets[template_id]
        return self._user_templates.get(template_id)

    def get_preset_by_id(self, preset_id: str) -> Optional[PromptTemplate]:
        return self._presets.get(preset_id)

    def save_template(self, template: PromptTemplate) -> PromptTemplate:
        if template.isPreset:
            raise ValueError("Cannot modify preset templates")
        template.updatedAt = datetime.now()
        self._user_templates[template.id] = template
        self._save_user_templates()
        return template

    def get_template_usages(self, template_id: str) -> List[str]:
        usages = []
        try:
            from core.storage import storage
            global_settings = storage.load_global_settings()
            for prompt_type, tid in global_settings.defaultPromptTemplates.items():
                if tid == template_id:
                    usages.append(f"全局设置: {prompt_type.value}")

            for project in storage.list_projects():
                if project.useCustomPrompts:
                    for prompt_type, tid in project.projectPromptTemplates.items():
                        if tid == template_id:
                            usages.append(f"项目 [{project.name}]: {prompt_type.value}")
        except Exception as e:
            logger.error(f"Failed to check template usages: {e}")
        return usages

    def delete_template(self, template_id: str, cascade: bool = False) -> Tuple[bool, List[str]]:
        if template_id in self._presets:
            raise ValueError("Cannot delete preset templates")
        if template_id not in self._user_templates:
            return False, []

        usages = self.get_template_usages(template_id)
        if usages and not cascade:
            return False, usages

        if cascade and usages:
            try:
                from core.storage import storage
                global_settings = storage.load_global_settings()
                for prompt_type, tid in list(global_settings.defaultPromptTemplates.items()):
                    if tid == template_id:
                        global_settings.defaultPromptTemplates[prompt_type] = ""
                storage.save_global_settings(global_settings)

                for project in storage.list_projects():
                    if project.useCustomPrompts:
                        updated = False
                        for prompt_type, tid in list(project.projectPromptTemplates.items()):
                            if tid == template_id:
                                project.projectPromptTemplates[prompt_type] = ""
                                updated = True
                        if updated:
                            storage.save_project(project)
            except Exception as e:
                logger.error(f"Failed to cascade template deletion: {e}")

        del self._user_templates[template_id]
        self._save_user_templates()
        return True, usages

    def duplicate_template(self, template_id: str, new_name: str) -> PromptTemplate:
        template = self.get_template(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")

        import uuid
        new_template = PromptTemplate(
            id=str(uuid.uuid4()),
            name=new_name,
            description=template.description,
            type=template.type,
            systemPrompt=template.systemPrompt,
            userPrompt=template.userPrompt,
            isPreset=False,
            createdAt=datetime.now(),
            updatedAt=datetime.now()
        )
        return self.save_template(new_template)

    def get_variables(self, prompt_type: PromptType) -> List[PromptVariable]:
        return _get_variables_for_type(prompt_type)

    def render_template(self, template: PromptTemplate, **kwargs) -> Tuple[str, str]:
        # 简单的替换函数：用 {var} 语法直接替换
        def simple_replace(s: str, values: dict) -> str:
            result = s
            for key, value in values.items():
                result = result.replace(f"{{{key}}}", str(value))
            # 把 {{ 替换成 {, }} 替换成 }
            result = result.replace("{{", "{").replace("}}", "}")
            return result

        try:
            rendered_system = simple_replace(template.systemPrompt, kwargs) if template.systemPrompt else ""
            rendered_user = simple_replace(template.userPrompt, kwargs) if template.userPrompt else ""
            return rendered_system, rendered_user
        except Exception as e:
            logger.error(f"Failed to render template: {e}")
            return template.systemPrompt, template.userPrompt

    def get_resolved_template(
        self,
        prompt_type: PromptType,
        project: Optional[Any] = None,
        global_settings: Optional[Any] = None
    ) -> PromptTemplate:
        template_id = ""

        # 检查项目级模板（不管 useCustomPrompts，只要设置了就使用）
        if project:
            if hasattr(project, 'projectPromptTemplates'):
                template_id = project.projectPromptTemplates.get(prompt_type, "")

        # 如果没有项目级模板，检查全局默认
        if not template_id and global_settings:
            if hasattr(global_settings, 'defaultPromptTemplates'):
                template_id = global_settings.defaultPromptTemplates.get(prompt_type, "")

        # 如果找到了模板ID，尝试获取模板
        if template_id:
            template = self.get_template(template_id)
            if template:
                return template

        # 使用默认预设模板
        default_id = f"preset_{prompt_type.value}_1"
        return self._presets[default_id]


prompt_template_manager = PromptTemplateManager()
