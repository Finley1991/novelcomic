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
            description="通用的分镜拆分模板（按行分割，仅用于历史参考）",
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
            description="动漫风格分镜拆分（按行分割，仅用于历史参考）",
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
            description="写实风格分镜拆分（按行分割，仅用于历史参考）",
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
            description="古风武侠风格分镜拆分（按行分割，仅用于历史参考）",
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
            name="通用增强版",
            description="增强版图像生成提示词，结合分镜、角色、场景和上下文信息",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="""你是一位专业的AI绘画提示词工程师（Prompt Engineer）。
你的任务是将画面信息转换为高质量的Stable Diffusion英文提示词。

【提示词工程原则】

1. 结构清晰
   - 主体在前：先描述画面核心内容
   - 风格其次：艺术风格、画面质量
   - 细节在后：光影、构图、氛围

2. 描述具体
   - 避免模糊词汇（如"美丽"、"好看"）
   - 使用精确描述（如"金色长发"、"蓝色眼睛"）
   - 包含材质、质感、光影信息

3. 英文术语准确
   - 使用Stable Diffusion社区常用词汇
   - 避免中式英语
   - 参考Danbooru标签风格

4. 质量词必备
   - masterpiece, best quality, ultra detailed
   - 根据风格添加相应的质量词汇

【提示词结构模板】
[主体描述], [角色特征], [场景环境], [艺术风格], [画面质量], [光影效果], [构图视角], [氛围情感]

【重要提醒】
- 只输出提示词内容，不要任何解释
- 使用英文
- 用逗号分隔词汇
- 不要使用Markdown格式""",
            userPrompt="""请根据以下信息生成高质量的Stable Diffusion英文提示词。

【角色信息】
{characters}

【场景信息】
{scene_info}

【风格提示词】
{style_prompt}

【当前分镜描述】
{scene_description}

【上下文分镜】
{context_storyboards}

请生成详细的Stable Diffusion提示词。要求：
1. 先描述当前分镜的核心内容
2. 融入角色的视觉特征
3. 结合场景的环境描述
4. 参考上下文分镜保持画面连贯性
5. 添加风格提示词和质量词
6. 使用英文，用逗号分隔

仅返回提示词内容，不要其他说明。""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_image_prompt_2",
            name="动漫风格增强版",
            description="动漫风格增强版，包含完整的动漫视觉元素",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="""你是一位专业的动漫风格AI绘画提示词工程师。
你的任务是将画面信息转换为高质量的动漫风格Stable Diffusion英文提示词。

【动漫风格提示词要点】

【主体描述】
- 1girl/1boy/2girls等数量标签
- 角色的核心动作和表情

【角色视觉特征】
- 发色：blonde hair, silver hair, pink hair, black hair等
- 发型：long hair, short hair, twintails, braids, ponytail等
- 瞳色：blue eyes, red eyes, green eyes, purple eyes, gold eyes等
- 表情：smile, blush, serious, surprised, angry等
- 服装：详细的服装描述

【场景环境】
- 室内/室外：indoors, outdoors
- 具体场景：bedroom, classroom, forest, city street等
- 时间天气：day, night, sunset, rain, snow等

【动漫风格元素】
- anime style, cel shading（ cel shading）
- vibrant colors（鲜艳色彩）
- detailed background（详细背景）
- beautiful detailed eyes（精致眼睛）

【画面质量】
- masterpiece, best quality, ultra detailed
- 4k, 8k, high resolution

【光影效果】
- soft lighting, cinematic lighting
- volumetric lighting, ray tracing

【构图视角】
- cowboy shot（牛仔镜头，大腿以上）
- full body（全身）
- close-up（特写）
- looking at viewer（看向镜头）

【氛围情感】
- warm atmosphere, cozy, dramatic, serene等

【重要提醒】
- 以"anime style, masterpiece, best quality, "开头
- 使用英文
- 用逗号分隔
- 只输出提示词""",
            userPrompt="""请根据以下信息生成动漫风格的Stable Diffusion英文提示词。

【角色信息】
{characters}

【场景信息】
{scene_info}

【风格提示词】
{style_prompt}

【当前分镜描述】
{scene_description}

【上下文分镜】
{context_storyboards}

请生成详细的动漫风格提示词。要求：
1. 以"anime style, masterpiece, best quality, "开头
2. 融入角色的动漫视觉特征（发色、发型、瞳色、服装等）
3. 结合场景环境
4. 添加动漫风格元素（cel shading, vibrant colors等）
5. 保持画面连贯性
6. 使用英文，用逗号分隔

仅返回提示词内容。""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_image_prompt_3",
            name="写实风格增强版",
            description="写实摄影风格增强版，追求电影级真实感",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="""你是一位专业的写实摄影风格AI绘画提示词工程师。
你的任务是将画面信息转换为高质量的写实风格Stable Diffusion英文提示词。

【写实风格提示词要点】

【主体描述】
- 真实的人物描述
- 自然的动作和表情

【角色视觉特征】
- 真实的年龄特征
- 皮肤质感：skin texture, pores, realistic skin
- 自然发色：natural black hair, brown hair, gray hair等
- 真实服装质感：fabric texture, wrinkles, cotton, silk, leather等

【场景环境】
- 真实的环境细节
- 材质表现：wood, stone, metal, glass等
- 生活痕迹：dust, wear, natural disorder等

【写实风格元素】
- photorealistic, hyperrealistic
- cinematic lighting, film grain
- depth of field（景深）
- bokeh（背景虚化）

【画面质量】
- masterpiece, best quality, ultra detailed
- 4k, 8k, high resolution
- sharp focus, intricate details

【摄影术语】
- shot on 35mm, shot on Arri Alexa
- 85mm lens, 50mm lens
- f/1.8, aperture
- ISO 100, shutter speed

【光影效果】
- natural lighting, soft window light
- golden hour, blue hour
- rim light, backlight
- dramatic shadows

【构图视角】
- eye level, low angle, high angle
- rule of thirds（三分法）

【氛围情感】
- intimate, epic, peaceful, tense等

【重要提醒】
- 以"photorealistic, masterpiece, best quality, cinematic lighting, "开头
- 使用英文
- 用逗号分隔
- 只输出提示词""",
            userPrompt="""请根据以下信息生成写实摄影风格的Stable Diffusion英文提示词。

【角色信息】
{characters}

【场景信息】
{scene_info}

【风格提示词】
{style_prompt}

【当前分镜描述】
{scene_description}

【上下文分镜】
{context_storyboards}

请生成详细的写实风格提示词。要求：
1. 以"photorealistic, masterpiece, best quality, cinematic lighting, "开头
2. 融入真实的人物特征（皮肤质感、真实服装等）
3. 结合场景环境和材质细节
4. 添加摄影术语（镜头、光圈、胶片等）
5. 使用电影光效
6. 保持画面连贯性
7. 使用英文，用逗号分隔

仅返回提示词内容。""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),
        PromptTemplate(
            id="preset_image_prompt_4",
            name="古风/武侠增强版",
            description="古风武侠风格增强版，强调中国传统美学",
            type=PromptType.IMAGE_PROMPT,
            systemPrompt="""你是一位专业的古风/武侠风格AI绘画提示词工程师。
你的任务是将画面信息转换为高质量的古风/武侠风格Stable Diffusion英文提示词。

【古风/武侠风格提示词要点】

【主体描述】
- 角色的核心动作：standing, sitting, fighting, flying等
- 武侠动作：sword fighting, martial arts, wielding sword等

【角色视觉特征】
- 古风发型：traditional Chinese hairstyle, hair bun, hair ornament等
- 古风服装：hanfu, traditional Chinese robes, flowing sleeves, silk robes等
- 武侠装备：sword, Chinese sword, whisk, fan, bow and arrow等
- 古风配饰：jade pendant, hairpin, tassel等

【场景环境】
- 古风建筑：Chinese architecture, temple, palace, pavilion, courtyard等
- 自然景观：bamboo forest, mountain landscape, cherry blossoms, willow tree等
- 室内场景：wooden interior, paper lanterns, ink painting scrolls等
- 天气氛围：mist, fog, moonlight, sunrise, falling petals等

【古风风格元素】
- traditional Chinese art, Chinese watercolor style
- ink wash painting, wuxia style
- elegant, graceful, poetic composition
- gold and red accents, muted color palette

【画面质量】
- masterpiece, best quality, ultra detailed
- 4k, 8k, high resolution

【光影效果】
- soft lighting, candlelight, moonlight
- volumetric fog, atmospheric perspective

【构图视角】
- dynamic composition, wide shot
- low angle for epic feel
- high angle for dramatic scenes

【氛围情感】
- serene, tranquil, epic, dramatic, mysterious, romantic等

【重要提醒】
- 以"traditional Chinese art, wuxia style, masterpiece, best quality, "开头
- 使用英文
- 用逗号分隔
- 只输出提示词""",
            userPrompt="""请根据以下信息生成古风/武侠风格的Stable Diffusion英文提示词。

【角色信息】
{characters}

【场景信息】
{scene_info}

【风格提示词】
{style_prompt}

【当前分镜描述】
{scene_description}

【上下文分镜】
{context_storyboards}

请生成详细的古风/武侠风格提示词。要求：
1. 以"traditional Chinese art, wuxia style, masterpiece, best quality, "开头
2. 融入古风服饰、发型、武器等元素
3. 结合古风建筑、山水等场景
4. 添加水墨、诗意等风格元素
5. 保持画面连贯性
6. 使用英文，用逗号分隔

仅返回提示词内容。""",
            isPreset=True,
            createdAt=now,
            updatedAt=now
        ),

        # ========== 场景提取预设 ==========
        PromptTemplate(
            id="preset_scene_extraction_1",
            name="通用增强版",
            description="专业场景提取模板，包含完整的视觉元素和氛围描写",
            type=PromptType.SCENE_EXTRACTION,
            systemPrompt="""你是一位专业的场景设定师和概念艺术家。
你的任务是从小说文本中提取所有主要场景，并为每个场景创建详细、可用于AI绘画的场景设定。

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

对每个场景，请提供：
1. name: 场景名称（简洁但有辨识度，如"森林中的小木屋"、"昏暗的地牢"）
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
            description="动漫风格场景提取，强调色彩、光影和视觉冲击力",
            type=PromptType.SCENE_EXTRACTION,
            systemPrompt="""你是一位专业的动漫场景概念艺术家。
你的任务是从小说文本中提取场景，并创建适合动漫风格的详细场景设定。

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

对每个场景，请提供：
1. name: 场景名称（如"夕阳下的教室"、"樱花飞舞的步道"）
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
            description="写实电影风格场景提取，追求真实感和细节",
            type=PromptType.SCENE_EXTRACTION,
            systemPrompt="""你是一位专业的电影场景美术指导。
你的任务是从小说文本中提取场景，并创建适合写实/电影风格的详细场景设定。

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

对每个场景，请提供：
1. name: 场景名称（如"破旧的公寓客厅"、"清晨的森林空地"）
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
            description="古风武侠风格场景提取，强调中国传统美学和意境",
            type=PromptType.SCENE_EXTRACTION,
            systemPrompt="""你是一位专业的古风/武侠场景概念艺术家。
你的任务是从小说文本中提取场景，并创建适合古风/武侠风格的详细场景设定。

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

对每个场景，请提供：
1. name: 场景名称（如"烟雨江南的园林"、"华山之巅的剑阁"）
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
