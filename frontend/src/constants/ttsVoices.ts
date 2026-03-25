export interface TTSVoiceOption {
  value: string;
  label: string;
  gender: 'female' | 'male' | 'child';
  style?: string;
}

export const TTS_VOICES: TTSVoiceOption[] = [
  // 女声
  { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (女声 - 温柔)', gender: 'female', style: '温柔' },
  { value: 'zh-CN-XiaoyiNeural', label: '晓伊 (女声 - 活泼)', gender: 'female', style: '活泼' },
  { value: 'zh-CN-XiaohanNeural', label: '晓涵 (女声 - 自然)', gender: 'female', style: '自然' },
  { value: 'zh-CN-XiaomengNeural', label: '晓梦 (女声 - 甜美女声)', gender: 'female', style: '甜美' },
  { value: 'zh-CN-XiaoxuanNeural', label: '晓萱 (女声 - 温柔女声)', gender: 'female', style: '温柔' },
  { value: 'zh-CN-XiaorouNeural', label: '晓柔 (女声 - 轻柔)', gender: 'female', style: '轻柔' },
  { value: 'zh-CN-XiaomoNeural', label: '晓墨 (女声 - 情感丰富)', gender: 'female', style: '情感丰富' },
  { value: 'zh-CN-XiaoshuangNeural', label: '晓双 (女声 - 对话)', gender: 'female', style: '对话' },
  { value: 'zh-CN-XiaoxiaoNeural-2', label: '晓晓2 (女声 - 清新)', gender: 'female', style: '清新' },
  { value: 'zh-CN-XiaoyouNeural', label: '晓悠 (女声 - 优雅)', gender: 'female', style: '优雅' },
  { value: 'zh-CN-XiaoxinNeural', label: '晓昕 (女声 - 亲切)', gender: 'female', style: '亲切' },
  { value: 'zh-CN-XiaotingNeural', label: '晓婷 (女声 - 开朗)', gender: 'female', style: '开朗' },

  // 男声
  { value: 'zh-CN-YunxiNeural', label: '云希 (男声 - 沉稳)', gender: 'male', style: '沉稳' },
  { value: 'zh-CN-YunyangNeural', label: '云扬 (男声 - 阳光)', gender: 'male', style: '阳光' },
  { value: 'zh-CN-YunjianNeural', label: '云健 (男声 - 刚毅)', gender: 'male', style: '刚毅' },
  { value: 'zh-CN-YunxiaNeural', label: '云夏 (男声 - 温暖)', gender: 'male', style: '温暖' },
  { value: 'zh-CN-YunyeNeural', label: '云野 (男声 - 自然)', gender: 'male', style: '自然' },
  { value: 'zh-CN-YunhaoNeural', label: '云浩 (男声 - 雄浑)', gender: 'male', style: '雄浑' },
  { value: 'zh-CN-YunfengNeural', label: '云峰 (男声 - 稳重)', gender: 'male', style: '稳重' },
  { value: 'zh-CN-YunkaiNeural', label: '云凯 (男声 - 磁性)', gender: 'male', style: '磁性' },
  { value: 'zh-CN-YunlongNeural', label: '云龙 (男声 - 深沉)', gender: 'male', style: '深沉' },
  { value: 'zh-CN-YunshiNeural', label: '云诗 (男声 - 温和)', gender: 'male', style: '温和' },

  // 童声
  { value: 'zh-CN-XiaoyouNeural', label: '晓优 (童声 - 女童)', gender: 'child', style: '女童' },
  { value: 'zh-CN-XiaochenNeural', label: '晓辰 (童声 - 男童)', gender: 'child', style: '男童' },
];

export const getVoiceLabel = (value: string): string => {
  const voice = TTS_VOICES.find(v => v.value === value);
  return voice ? voice.label : value;
};
