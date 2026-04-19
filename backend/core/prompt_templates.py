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
            description="专业角色提取模板，包含完整的视觉、性格和行为特征",
            type=PromptType.CHARACTER_EXTRACTION,
            systemPrompt="""你是一位专业的角色设定师和视觉艺术家。
你的任务是从小说文本中提取所有主要角色，并为每个角色创建详细、可用于AI绘画的角色设定。

【工作原则】
1. 只提取文本中明确描述或可以合理推断的信息
2. 不要编造文本中不存在的信息
3. 注重视觉细节，因为这些描述将直接用于AI绘画
4. 保持描述的一致性和连贯性

【角色描述标准】
视觉描述应包含：
- 基本信息：性别、年龄范围、身高体型
- 外貌特征：面部特征、发型发色、瞳色、皮肤
- 服装风格：常穿的服装、配饰、武器（如有）
- 气质气场：整体给人的感觉、眼神、姿态

性格描述应包含：
- 核心性格特质
- 行为习惯和口头禅
- 与他人互动的方式
- 在关键时刻的表现倾向""",
            userPrompt="""请从以下小说文本中提取所有主要角色。

对每个角色，请提供：
1. name: 角色姓名（全名或最常用的称呼）
2. description: 详细的视觉描述（用于AI绘画，包含外貌、服装、气质等）
3. characterPrompt: 角色专属提示词（英文，用于Stable Diffusion图像生成）
4. personality: 性格特点和行为特征

仅返回JSON数组，格式如下：
[
  {{
    "name": "角色名",
    "description": "详细的视觉描述，包括性别、年龄、外貌、服装、气质等",
    "characterPrompt": "英文提示词，用于Stable Diffusion生成该角色图像",
    "personality": "性格特点、行为习惯、与他人互动方式等"
  }}
]

小说文本：
{chunk}""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_character_extraction_2",
            name="动漫风格",
            description="动漫风格角色设定，强调视觉冲击力和萌属性",
            type=PromptType.CHARACTER_EXTRACTION,
            systemPrompt="""你是一位专业的动漫角色设计师。
你的任务是从小说文本中提取角色，并创建适合动漫/二次元风格的详细角色设定。

【动漫角色设计要点】
视觉特征要突出：
- 发色：鲜明的发色（金色、银色、粉色、蓝色等）
- 发型：独特的发型造型（双马尾、麻花辫、短发、长直发等）
- 瞳色：明亮的动漫瞳色（红、蓝、绿、紫、金等）
- 五官：精致的面部特征（大眼睛、小鼻子、小嘴巴）
- 身材：典型的动漫身材比例
- 服装：特色服装（校服、哥特、和风、军装、奇幻等）
- 配饰：标志性配饰（发饰、眼镜、围巾、武器等）

性格要包含：
- 萌属性（傲娇、腹黑、天然呆、三无、御姐、正太等）
- 典型行为模式
- 标志性台词或动作""",
            userPrompt="""请从以下小说文本中提取所有主要角色，以动漫风格进行设定。

对每个角色，请提供：
1. name: 角色姓名
2. description: 详细的动漫风格视觉描述（包含发色、发型、瞳色、服装、萌属性特征等）
3. characterPrompt: 英文动漫风格提示词（如 anime style, 1girl, blonde hair, blue eyes, ...）
4. personality: 性格特点（包含萌属性标签）

仅返回JSON数组，格式如下：
[
  {{
    "name": "角色名",
    "description": "动漫风格的详细视觉描述",
    "characterPrompt": "英文动漫风格提示词，用于Stable Diffusion",
    "personality": "性格特点，包含萌属性标签"
  }}
]

小说文本：
{chunk}""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_character_extraction_3",
            name="写实风格",
            description="电影级写实角色设定，追求真实感和细节",
            type=PromptType.CHARACTER_EXTRACTION,
            systemPrompt="""你是一位专业的电影角色造型师。
你的任务是从小说文本中提取角色，并创建适合写实/电影风格的详细角色设定。

【写实角色设计要点】
要注重：
- 真实的年龄特征（皮肤纹理、皱纹、白发等）
- 真实的身材比例（不要夸张）
- 肤质细节（雀斑、疤痕、痣、皮肤质感）
- 真实的发质（发色自然、发型符合生活逻辑）
- 服装质感（面料褶皱、磨损、污渍等）
- 生活气息（角色的穿着应该符合其身份和生活状态）
- 微表情特征（角色常有的表情倾向）

【提示词风格】
使用：photorealistic, cinematic lighting, ultra detailed, skin texture, realistic fabric等词汇""",
            userPrompt="""请从以下小说文本中提取所有主要角色，以写实/电影风格进行设定。

对每个角色，请提供：
1. name: 角色姓名
2. description: 详细的写实风格视觉描述（包含真实的年龄、肤质、服装质感、生活气息等）
3. characterPrompt: 英文写实风格提示词（如 photorealistic, cinematic lighting, skin texture, ...）
4. personality: 性格特点

仅返回JSON数组，格式如下：
[
  {{
    "name": "角色名",
    "description": "写实风格的详细视觉描述",
    "characterPrompt": "英文写实风格提示词，用于Stable Diffusion",
    "personality": "性格特点"
  }}
]

小说文本：
{chunk}""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_character_extraction_4",
            name="古风/武侠",
            description="古风武侠风格角色设定，强调国风美学",
            type=PromptType.CHARACTER_EXTRACTION,
            systemPrompt="""你是一位专业的古风/武侠角色设计师。
你的任务是从小说文本中提取角色，并创建适合古风/武侠风格的详细角色设定。

【古风角色设计要点】
视觉特征要包含：
- 发型：古风发型（发髻、发冠、发簪、头带等）
- 发色：自然发色（黑、深棕为主，或根据设定的特殊发色）
- 服装：古风服饰（汉服、武侠装、官服、道袍、劲装等）
- 面料：丝绸、棉麻、纱等质感
- 配饰：玉佩、剑、箫、扇、拂尘等古风配饰
- 气质：仙风道骨、英姿飒爽、温婉可人、狂放不羁等

【提示词风格】
使用：traditional Chinese art, wuxia style, hanfu, ink painting, elegant, ancient Chinese等词汇""",
            userPrompt="""请从以下小说文本中提取所有主要角色，以古风/武侠风格进行设定。

对每个角色，请提供：
1. name: 角色姓名
2. description: 详细的古风/武侠风格视觉描述（包含发型、服装、配饰、武器、气质等）
3. characterPrompt: 英文古风风格提示词（如 traditional Chinese art, wuxia style, hanfu, ...）
4. personality: 性格特点

仅返回JSON数组，格式如下：
[
  {{
    "name": "角色名",
    "description": "古风/武侠风格的详细视觉描述",
    "characterPrompt": "英文古风风格提示词，用于Stable Diffusion",
    "personality": "性格特点"
  }}
]

小说文本：
{chunk}""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),

        # ========== 分镜拆分预设 ==========
        PromptTemplate(
            id="preset_storyboard_split_1",
            name="通用版",
            description="按情节合理拆分小说文本，sceneDescription使用原文20-40字",
            type=PromptType.STORYBOARD_SPLIT,
            systemPrompt="""你是一个专业的文学编辑。将小说文本按情节拆分为多个片段。

【重要要求】
1. sceneDescription 必须直接使用原文片段，不要修改或重新描述
2. sceneDescription 的字数必须控制在 20-40 字之间（汉字）
3. 尽量保证内容的连贯性和完整性
4. 按自然的情节断点拆分
5. 不需要 dialogue 和 narration 字段
6. characterNames 必须包含该分镜中出现的所有角色
7. 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"等），请根据上下文推断并替换为具体的角色名称""",
            userPrompt="""{characters}
{scenes}

将以下小说文本按情节拆分为多个片段。

重要要求：
- sceneDescription 必须直接使用原文片段，不要修改或重新描述
- sceneDescription 的字数必须控制在 20-40 字之间（汉字）
- 尽量保证内容的连贯性和完整性
- 按自然的情节断点拆分
- 不需要 dialogue 和 narration 字段
- characterNames 必须包含该分镜中出现的所有角色
- 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"等），请根据上下文推断并替换为具体的角色名称

对每个分镜提供：
1. index: 序号（从{current_index}开始）
2. sceneDescription: 原文片段（20-40字，直接复制原文）
3. characterNames: 出现的角色名数组（代词请替换为具体角色名）

仅返回JSON数组，格式如下：
[
  {{
    "index": 0,
    "sceneDescription": "原文片段（20-40字）...",
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
            name="通用版2",
            description="按情节合理拆分小说文本，sceneDescription使用原文20-40字",
            type=PromptType.STORYBOARD_SPLIT,
            systemPrompt="""你是一个专业的文学编辑。将小说文本按情节拆分为多个片段。

【重要要求】
1. sceneDescription 必须直接使用原文片段，不要修改或重新描述
2. sceneDescription 的字数必须控制在 20-40 字之间（汉字）
3. 尽量保证内容的连贯性和完整性
4. 按自然的情节断点拆分
5. 不需要 dialogue 和 narration 字段
6. characterNames 必须包含该分镜中出现的所有角色
7. 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"等），请根据上下文推断并替换为具体的角色名称""",
            userPrompt="""{characters}
{scenes}

将以下小说文本按情节拆分为多个片段。

重要要求：
- sceneDescription 必须直接使用原文片段，不要修改或重新描述
- sceneDescription 的字数必须控制在 20-40 字之间（汉字）
- 尽量保证内容的连贯性和完整性
- 按自然的情节断点拆分
- 不需要 dialogue 和 narration 字段
- characterNames 必须包含该分镜中出现的所有角色
- 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"等），请根据上下文推断并替换为具体的角色名称

对每个分镜提供：
1. index: 序号（从{current_index}开始）
2. sceneDescription: 原文片段（20-40字，直接复制原文）
3. characterNames: 出现的角色名数组（代词请替换为具体角色名）

仅返回JSON数组，格式如下：
[
  {{
    "index": 0,
    "sceneDescription": "原文片段（20-40字）...",
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
            name="通用版3",
            description="按情节合理拆分小说文本，sceneDescription使用原文20-40字",
            type=PromptType.STORYBOARD_SPLIT,
            systemPrompt="""你是一个专业的文学编辑。将小说文本按情节拆分为多个片段。

【重要要求】
1. sceneDescription 必须直接使用原文片段，不要修改或重新描述
2. sceneDescription 的字数必须控制在 20-40 字之间（汉字）
3. 尽量保证内容的连贯性和完整性
4. 按自然的情节断点拆分
5. 不需要 dialogue 和 narration 字段
6. characterNames 必须包含该分镜中出现的所有角色
7. 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"等），请根据上下文推断并替换为具体的角色名称""",
            userPrompt="""{characters}
{scenes}

将以下小说文本按情节拆分为多个片段。

重要要求：
- sceneDescription 必须直接使用原文片段，不要修改或重新描述
- sceneDescription 的字数必须控制在 20-40 字之间（汉字）
- 尽量保证内容的连贯性和完整性
- 按自然的情节断点拆分
- 不需要 dialogue 和 narration 字段
- characterNames 必须包含该分镜中出现的所有角色
- 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"等），请根据上下文推断并替换为具体的角色名称

对每个分镜提供：
1. index: 序号（从{current_index}开始）
2. sceneDescription: 原文片段（20-40字，直接复制原文）
3. characterNames: 出现的角色名数组（代词请替换为具体角色名）

仅返回JSON数组，格式如下：
[
  {{
    "index": 0,
    "sceneDescription": "原文片段（20-40字）...",
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
            name="通用版4",
            description="按情节合理拆分小说文本，sceneDescription使用原文20-40字",
            type=PromptType.STORYBOARD_SPLIT,
            systemPrompt="""你是一个专业的文学编辑。将小说文本按情节拆分为多个片段。

【重要要求】
1. sceneDescription 必须直接使用原文片段，不要修改或重新描述
2. sceneDescription 的字数必须控制在 20-40 字之间（汉字）
3. 尽量保证内容的连贯性和完整性
4. 按自然的情节断点拆分
5. 不需要 dialogue 和 narration 字段
6. characterNames 必须包含该分镜中出现的所有角色
7. 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"等），请根据上下文推断并替换为具体的角色名称""",
            userPrompt="""{characters}
{scenes}

将以下小说文本按情节拆分为多个片段。

重要要求：
- sceneDescription 必须直接使用原文片段，不要修改或重新描述
- sceneDescription 的字数必须控制在 20-40 字之间（汉字）
- 尽量保证内容的连贯性和完整性
- 按自然的情节断点拆分
- 不需要 dialogue 和 narration 字段
- characterNames 必须包含该分镜中出现的所有角色
- 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"等），请根据上下文推断并替换为具体的角色名称

对每个分镜提供：
1. index: 序号（从{current_index}开始）
2. sceneDescription: 原文片段（20-40字，直接复制原文）
3. characterNames: 出现的角色名数组（代词请替换为具体角色名）

仅返回JSON数组，格式如下：
[
  {{
    "index": 0,
    "sceneDescription": "原文片段（20-40字）...",
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
            name="校园清新漫画",
            description="校园清新风格，明亮柔和，适合青春校园故事",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="""你是一位专业的AI绘画提示词工程师。
你的任务是将场景信息转换为高质量的中文详细描述格式的提示词。

【重要规则 - 禁止文字】
- 图像中绝对不能出现任何文字
- 不能有标识、字母、单词、字幕、有可见文字的书籍
- 如果应该有标识，让它模糊或不可读
- 最终图像中不能有任何形式的文字

【风格 - 校园清新漫画】
- 动漫风格，漫画插画
- 明亮的光线，柔和的阴影
- 柔和的色彩，鲜艳但温柔
- 干净的线条，美丽细致的眼睛
- 适用时穿着校服
- 灵感来自校园恋爱漫画

【光线】
- 柔和的光线，日光，窗户光
- 明亮的教室，放学后的夕阳
- 体积光，光线

【构图】
- 中景，全身，特写
- 看向观众，动态姿势
- 三分法则

【氛围】
- 温暖的氛围，青春活力，宁静，温柔

【重要】
- 使用纯中文详细描述
- 像讲故事一样描述场景
- 使用描述性、流畅的语言
- 只使用中文
- 图像中不能有文字""",
            userPrompt="""根据以下信息生成高质量的中文详细描述格式的提示词。

【角色信息】
{characters}

【场景信息】
{scene_info}

【风格提示词】
{style_prompt}

【当前分镜】
{scene_description}

【上下文分镜】
{context_storyboards}

生成详细的校园清新漫画风格提示词。

要求：
1. 使用纯中文详细描述（不要只用逗号分隔的标签）
2. 像讲故事一样生动地描述场景
3. 包含角色视觉细节（发色、发型、瞳色、服装等）
4. 包含环境和场景细节
5. 使用校园清新漫画风格（明亮、柔和、柔和的色彩）
6. 与上下文保持视觉一致性
7. 只使用中文
8. 图像中绝对不能有文字 - 不能有标识、字母、单词

最后请补充风格标签：动漫风格，数字插画，漫画风格

只返回提示词，不要解释。""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_image_prompt_2",
            name="现代都市漫画",
            description="现代都市风格，新海诚风格，细腻的光影和城市细节",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="""你是一位专业的AI绘画提示词工程师。
你的任务是将场景信息转换为高质量的中文详细描述格式的提示词。

【重要规则 - 禁止文字】
- 图像中绝对不能出现任何文字
- 不能有标识、字母、单词、字幕、有可见文字的书籍
- 不能有带文字的手机屏幕、带文字的电脑屏幕
- 如果应该有标识，让它模糊或不可读
- 最终图像中不能有任何形式的文字

【风格 - 现代都市漫画（新海诚风格）】
- 动漫风格，电影光效
- 详细的城市背景，都市风景
- 潮湿街道上的倒影，适用时的雨滴
- 美丽的天空、云朵、日落/日出
- 详细的建筑，夜晚的城市灯光
- 灵感来自新海诚电影（你的名字、天气之子、铃芽之旅）
- 鲜艳的色彩，高对比度，细致的阴影

【光线】
- 电影光效，黄金时刻，蓝色时刻
- 城市灯光，霓虹灯（但没有可读文字）
- 戏剧性的阴影，轮廓光，逆光
- 体积雾，大气透视

【构图】
- 广角镜头，远景镜头，动态角度
- 城市景观，水坑中的倒影
- 低角度，高角度，视线水平

【氛围】
- 浪漫的，怀旧的，都市孤独，充满希望的，戏剧性的

【重要】
- 使用纯中文详细描述
- 像讲故事一样描述场景
- 使用描述性、流畅的语言
- 只使用中文
- 图像中不能有文字""",
            userPrompt="""根据以下信息生成高质量的中文详细描述格式的提示词。

【角色信息】
{characters}

【场景信息】
{scene_info}

【风格提示词】
{style_prompt}

【当前分镜】
{scene_description}

【上下文分镜】
{context_storyboards}

生成详细的现代都市漫画风格提示词（新海诚风格）。

要求：
1. 使用纯中文详细描述（不要只用逗号分隔的标签）
2. 像讲故事一样生动地描述场景
3. 包含角色视觉细节（发色、发型、瞳色、服装等）
4. 包含详细的城市环境（建筑、街道、天空、光线）
5. 使用新海诚风格（电影光效、详细背景、鲜艳色彩）
6. 与上下文保持视觉一致性
7. 只使用中文
8. 图像中绝对不能有文字 - 不能有标识、字母、单词、带文字的手机屏幕

最后请补充风格标签：动漫风格，数字插画，新海诚风格，电影光效

只返回提示词，不要解释。""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_image_prompt_3",
            name="国风水墨漫画",
            description="国风水墨风格，传统水墨技法，东方美学意境",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="""你是一位专业的AI绘画提示词工程师。
你的任务是将场景信息转换为高质量的中文详细描述格式的提示词。

【重要规则 - 禁止文字】
- 图像中绝对不能出现任何文字
- 不能有书法、汉字、字母、单词
- 不能有带文字的卷轴、带文字的标识
- 如果应该有书法，让它抽象或模糊
- 最终图像中不能有任何形式的文字

【风格 - 国风水墨漫画】
- 中国传统艺术，水墨画
- 武侠风格，古风美学
- 墨迹、笔触、流动的墨
- 黑白配以微妙的色彩强调
- 适当时使用金色和红色强调
- 优雅、优美、诗意的构图
- 薄雾、雾气、大气透视
- 灵感来自中国传统山水画
- 竹林、山景、古建筑

【光线】
- 柔和的光线、烛光、月光
- 戏剧性的阴影、轮廓光
- 体积雾、朦胧的氛围

【构图】
- 动态构图、广角镜头
- 低角度营造史诗感
- 高角度营造戏剧性场景
- 负空间、留白 - 艺术平衡的空白空间

【氛围】
- 宁静的、安详的、史诗的、戏剧性的、神秘的、诗意的

【重要】
- 使用纯中文详细描述
- 像讲故事一样描述场景
- 使用描述性、流畅的语言
- 只使用中文
- 图像中不能有文字 - 不能有书法、不能有汉字""",
            userPrompt="""根据以下信息生成高质量的中文详细描述格式的提示词。

【角色信息】
{characters}

【场景信息】
{scene_info}

【风格提示词】
{style_prompt}

【当前分镜】
{scene_description}

【上下文分镜】
{context_storyboards}

生成详细的国风水墨风格提示词。

要求：
1. 使用纯中文详细描述（不要只用逗号分隔的标签）
2. 像讲故事一样生动地描述场景
3. 包含角色视觉细节（中国传统发型、汉服、剑/扇子等）
4. 包含中国风环境（古建筑、竹林、山峦、薄雾等）
5. 使用水墨风格（笔触、墨迹、优雅的构图）
6. 与上下文保持视觉一致性
7. 只使用中文
8. 图像中绝对不能有文字 - 不能有书法、不能有汉字、不能有字母

最后请补充风格标签：中国传统艺术，水墨画，古风美学，数字插画

只返回提示词，不要解释。""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_image_prompt_4",
            name="国风水彩漫画",
            description="国风水彩风格，清新透明的水彩质感，温暖明亮的色调",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="""你是一位专业的AI绘画提示词工程师。
你的任务是将场景信息转换为高质量的中文详细描述格式的提示词。

【重要规则 - 禁止文字】
- 图像中绝对不能出现任何文字
- 不能有书法、汉字、字母、单词
- 不能有带文字的卷轴、带文字的标识
- 最终图像中不能有任何形式的文字

【风格 - 国风水彩漫画】
- 水彩画，透明水彩
- 古风美学，中国风格
- 柔和的色彩渐变，精致的笔触
- 温暖明亮的色调
- 纸张质感，可见的水彩渲染
- 樱花、柳树、牡丹、竹子
- 边缘柔和的中国古建筑
- 春天氛围，花卉元素
- 优雅、梦幻、清新的感觉

【光线】
- 柔和的光线、日光、黄金时刻
- 温柔的阳光透过花朵
- 明亮欢快的氛围

【构图】
- 中景、全身
- 看向观众、温柔的姿势
- 花卉框架、自然构图

【氛围】
- 温暖的、温柔的、梦幻的、清新的、浪漫的、宁静的

【重要】
- 使用纯中文详细描述
- 像讲故事一样描述场景
- 使用描述性、流畅的语言
- 只使用中文
- 图像中不能有文字""",
            userPrompt="""根据以下信息生成高质量的中文详细描述格式的提示词。

【角色信息】
{characters}

【场景信息】
{scene_info}

【风格提示词】
{style_prompt}

【当前分镜】
{scene_description}

【上下文分镜】
{context_storyboards}

生成详细的国风水彩风格提示词。

要求：
1. 使用纯中文详细描述（不要只用逗号分隔的标签）
2. 像讲故事一样生动地描述场景
3. 包含角色视觉细节（中国传统发型、汉服、配饰）
4. 包含中国水彩环境（花朵、柳树、古建筑等）
5. 使用水彩风格（透明渲染、柔和色彩、纸张质感）
6. 与上下文保持视觉一致性
7. 只使用中文
8. 图像中绝对不能有文字 - 不能有书法、不能有汉字、不能有字母

最后请补充风格标签：水彩画，古风美学，中国风格，数字插画，水彩

只返回提示词，不要解释。""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
# ========== 场景提取预设 ==========
        PromptTemplate(
            id="preset_scene_extraction_1",
            name="通用增强版",
            description="场景名称简洁化（客厅、卧室等），包含完整的视觉元素",
            type=PromptType.SCENE_EXTRACTION,
            systemPrompt="""你是一位专业的场景设定师和概念艺术家。
你的任务是从小说文本中提取所有主要场景，并为每个场景创建详细、可用于AI绘画的场景设定。

【重要要求】
1. 场景名称必须简洁，使用通用的地点名称：
   - 室内场景：客厅、卧室、厨房、书房、浴室、走廊、楼梯、地下室、阁楼、大厅、会议室、办公室、教室、实验室、病房、手术室等
   - 室外场景：庭院、花园、公园、街道、广场、市场、车站、机场、码头、森林、草原、沙漠、海滩、山顶、山谷、河流、湖泊、皇宫、大殿、战场、地牢、监狱等
   - 其他：根据文本内容选择简洁的名称

2. 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"、"李大小姐"、"爱妃"等），请根据上下文推断并记录这些代词指代的具体人物名称

【场景提取原则】
1. 识别文本中描述的每个独立地点
2. 每个场景都应该有明确的空间感和辨识度
3. 注重视觉细节，因为这些描述将直接用于AI绘画
4. 描述应该包含：空间布局、物体陈设、材质质感、光线氛围、时间天气

【场景描述标准】
一个完整的场景描述应包含：

1. 空间特征
   - 场景类型（室内/室外、自然/人工）
   - 空间大小和布局
   - 建筑风格或地貌特征

2. 视觉元素
   - 主要物体和陈设
   - 材质和质感（木、石、金属、织物等）
   - 颜色基调
   - 装饰细节

3. 光线氛围
   - 光源（自然光、人工光）
   - 光照方向和强度
   - 阴影效果
   - 整体明暗调子

4. 时间天气
   - 一天中的时间（早晨、中午、黄昏、夜晚）
   - 天气状况（晴、雨、雪、雾等）
   - 季节特征

5. 情感基调
   - 场景给人的整体感觉（温馨、神秘、阴森、宁静等）""",
            userPrompt="""请从以下小说文本中提取所有主要场景。

重要要求：
- 场景名称必须简洁，使用通用的地点名称（如：客厅、卧室、庭院、走廊、皇宫、大殿、战场等）
- 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"、"李大小姐"、"爱妃"等），请根据上下文推断并记录这些代词指代的具体人物名称

对每个场景，请提供：
1. name: 场景名称（简洁，如"客厅"、"卧室"、"森林"）
2. description: 详细的视觉描述（包含空间布局、物体陈设、材质质感、光线氛围、时间天气、情感基调等）

仅返回JSON数组，格式如下：
[
  {{
    "name": "场景名称",
    "description": "详细的视觉描述，用于AI绘画生成该场景"
  }}
]

小说文本：
{chunk}""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_scene_extraction_2",
            name="动漫风格",
            description="场景名称简洁化（客厅、卧室等），动漫风格场景提取",
            type=PromptType.SCENE_EXTRACTION,
            systemPrompt="""你是一位专业的动漫场景概念艺术家。
你的任务是从小说文本中提取场景，并创建适合动漫风格的详细场景设定。

【重要要求】
1. 场景名称必须简洁，使用通用的地点名称：
   - 室内场景：客厅、卧室、厨房、书房、浴室、走廊、楼梯、地下室、阁楼、大厅、会议室、办公室、教室、实验室、病房、手术室等
   - 室外场景：庭院、花园、公园、街道、广场、市场、车站、机场、码头、森林、草原、沙漠、海滩、山顶、山谷、河流、湖泊、皇宫、大殿、战场、地牢、监狱等
   - 其他：根据文本内容选择简洁的名称

2. 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"、"李大小姐"、"爱妃"等），请根据上下文推断并记录这些代词指代的具体人物名称

【动漫场景设计要点】

【视觉风格】
- 鲜明的色彩搭配（vibrant colors）
- 清晰的轮廓（clean lineart）
- 装饰性的设计元素
- 适当的夸张和美化

【光影表现】
- 戏剧性的光影对比
- 美丽的夕阳光（golden hour lighting）
- 彩色的光晕（colorful lighting）
- 体积光效果（volumetric light）

【背景元素】
- 天空表现（云、星空、日落等）
- 自然元素（花、树、水等的动漫化表现）
- 城市或建筑的动漫风格化
- 细节丰富但不杂乱

【氛围营造】
- 温馨、治愈的日常氛围
- 梦幻、神秘的奇幻氛围
- 热血、紧张的战斗氛围
- 忧郁、抒情的文艺氛围""",
            userPrompt="""请从以下小说文本中提取所有主要场景，以动漫风格进行设定。

重要要求：
- 场景名称必须简洁，使用通用的地点名称（如：客厅、卧室、庭院、走廊、皇宫、大殿、战场等）
- 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"、"李大小姐"、"爱妃"等），请根据上下文推断并记录这些代词指代的具体人物名称

对每个场景，请提供：
1. name: 场景名称（简洁，如"客厅"、"卧室"、"森林"）
2. description: 详细的动漫风格视觉描述（包含色彩、光影、背景元素、氛围等）

仅返回JSON数组，格式如下：
[
  {{
    "name": "场景名称",
    "description": "动漫风格的详细视觉描述"
  }}
]

小说文本：
{chunk}""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_scene_extraction_3",
            name="写实风格",
            description="场景名称简洁化（客厅、卧室等），写实电影风格场景提取",
            type=PromptType.SCENE_EXTRACTION,
            systemPrompt="""你是一位专业的电影场景美术指导。
你的任务是从小说文本中提取场景，并创建适合写实/电影风格的详细场景设定。

【重要要求】
1. 场景名称必须简洁，使用通用的地点名称：
   - 室内场景：客厅、卧室、厨房、书房、浴室、走廊、楼梯、地下室、阁楼、大厅、会议室、办公室、教室、实验室、病房、手术室等
   - 室外场景：庭院、花园、公园、街道、广场、市场、车站、机场、码头、森林、草原、沙漠、海滩、山顶、山谷、河流、湖泊、皇宫、大殿、战场、地牢、监狱等
   - 其他：根据文本内容选择简洁的名称

2. 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"、"李大小姐"、"爱妃"等），请根据上下文推断并记录这些代词指代的具体人物名称

【写实场景设计要点】

【空间真实感】
- 符合物理规律的空间比例
- 真实的建筑结构或自然地貌
- 合理的物体摆放和透视关系

【材质表现】
- 各种材质的真实质感（木材的纹理、石材的颗粒、金属的反光、织物的褶皱）
- 岁月的痕迹（磨损、污渍、灰尘、老化）
- 天气的影响（潮湿、干燥、结冰等）

【光影设计】
- 电影光效（cinematic lighting）
- 真实的光源和阴影
- 全局光照和环境反射
- 戏剧性的明暗对比

【细节层次】
- 前景、中景、背景的层次
- 主要物体和次要物体的关系
- 视觉引导线和构图
- 吸引眼球的视觉焦点

【氛围营造】
- 通过光影、色彩、细节共同营造情绪
- 场景的"呼吸感"和生活气息
- 符合故事调性的整体基调""",
            userPrompt="""请从以下小说文本中提取所有主要场景，以写实/电影风格进行设定。

重要要求：
- 场景名称必须简洁，使用通用的地点名称（如：客厅、卧室、庭院、走廊、皇宫、大殿、战场等）
- 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"、"李大小姐"、"爱妃"等），请根据上下文推断并记录这些代词指代的具体人物名称

对每个场景，请提供：
1. name: 场景名称（简洁，如"客厅"、"卧室"、"森林"）
2. description: 详细的写实风格视觉描述（包含空间真实感、材质表现、电影光效、细节层次、氛围等）

仅返回JSON数组，格式如下：
[
  {{
    "name": "场景名称",
    "description": "写实风格的详细视觉描述"
  }}
]

小说文本：
{chunk}""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_scene_extraction_4",
            name="古风/武侠",
            description="场景名称简洁化（客厅、卧室等），古风武侠风格场景提取",
            type=PromptType.SCENE_EXTRACTION,
            systemPrompt="""你是一位专业的古风/武侠场景概念艺术家。
你的任务是从小说文本中提取场景，并创建适合古风/武侠风格的详细场景设定。

【重要要求】
1. 场景名称必须简洁，使用通用的地点名称：
   - 室内场景：客厅、卧室、厨房、书房、浴室、走廊、楼梯、地下室、阁楼、大厅、会议室、办公室、教室、实验室、病房、手术室等
   - 室外场景：庭院、花园、公园、街道、广场、市场、车站、机场、码头、森林、草原、沙漠、海滩、山顶、山谷、河流、湖泊、皇宫、大殿、战场、地牢、监狱等
   - 其他：根据文本内容选择简洁的名称

2. 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"、"李大小姐"、"爱妃"等），请根据上下文推断并记录这些代词指代的具体人物名称

【古风场景设计要点】

【建筑元素】
- 传统中式建筑（宫殿、庙宇、园林、民居、塔楼等）
- 建筑细节（飞檐、斗拱、雕梁画栋、花窗、牌匾等）
- 材质表现（木材、青砖、琉璃瓦、石材等）

【自然景观】
- 山水意境（高山、流水、云雾、松柏、竹林等）
- 花木元素（梅、兰、竹、菊、桃、柳等）
- 四季变化（春的生机、夏的繁茂、秋的萧瑟、冬的素雅）

【室内陈设】
- 家具（桌椅、床榻、屏风、博古架等）
- 摆设（瓷器、书画、香炉、茶具、古玩等）
- 照明（灯笼、蜡烛、油灯等）

【意境营造】
- 诗意的画面构图
- 留白的艺术
- 动静结合（水的流动、云的飘动、叶的飘落）
- 整体的文化气息和美学品位

【武侠特色】
- 武学场景（擂台、练武场、山门、密室等）
- 江湖元素（酒馆、客栈、镖局、山寨等）
- 隐逸意境（山洞、幽谷、竹林深处等）""",
            userPrompt="""请从以下小说文本中提取所有主要场景，以古风/武侠风格进行设定。

重要要求：
- 场景名称必须简洁，使用通用的地点名称（如：客厅、卧室、庭院、走廊、皇宫、大殿、战场等）
- 如果文本中出现代词（如"我"、"他"、"她"、"男主"、"女主"、"李大小姐"、"爱妃"等），请根据上下文推断并记录这些代词指代的具体人物名称

对每个场景，请提供：
1. name: 场景名称（简洁，如"客厅"、"卧室"、"森林"）
2. description: 详细的古风/武侠风格视觉描述（包含建筑元素、自然景观、意境营造、武侠特色等）

仅返回JSON数组，格式如下：
[
  {{
    "name": "场景名称",
    "description": "古风/武侠风格的详细视觉描述"
  }}
]

小说文本：
{chunk}""",
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
            ),
            PromptVariable(
                name="scene_info",
                description="场景信息",
                example="场景：森林中的小屋..."
            ),
            PromptVariable(
                name="context_storyboards",
                description="上下文分镜信息（前后5个分镜）",
                example="前5个分镜：...\n后5个分镜：..."
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
        # 首先检查项目本地的提示词模板
        if project:
            if hasattr(project, 'projectLocalPromptTemplates') and project.projectLocalPromptTemplates:
                # 查找类型匹配的本地模板，优先使用被选中的（通过 projectPromptTemplates 引用的）
                if hasattr(project, 'projectPromptTemplates'):
                    selected_template_id = project.projectPromptTemplates.get(prompt_type, "")
                    if selected_template_id:
                        selected_template = next(
                            (t for t in project.projectLocalPromptTemplates if t.id == selected_template_id),
                            None
                        )
                        if selected_template:
                            # 转换为 PromptTemplate 格式
                            return PromptTemplate(
                                id=selected_template.id,
                                name=selected_template.name,
                                description=selected_template.description,
                                type=selected_template.type,
                                systemPrompt=selected_template.systemPrompt,
                                userPrompt=selected_template.userPrompt,
                                isPreset=False,
                                createdAt=selected_template.createdAt,
                                updatedAt=selected_template.updatedAt
                            )
                # 如果没有选中的本地模板，使用该类型的第一个本地模板
                local_template = next(
                    (t for t in project.projectLocalPromptTemplates if t.type == prompt_type),
                    None
                )
                if local_template:
                    # 转换为 PromptTemplate 格式
                    return PromptTemplate(
                        id=local_template.id,
                        name=local_template.name,
                        description=local_template.description,
                        type=local_template.type,
                        systemPrompt=local_template.systemPrompt,
                        userPrompt=local_template.userPrompt,
                        isPreset=False,
                        createdAt=local_template.createdAt,
                        updatedAt=local_template.updatedAt
                    )

        template_id = ""

        # 检查项目级模板引用（引用全局模板）
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
