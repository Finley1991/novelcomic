# TTS 配音功能增强设计文档

**日期:** 2026-03-17
**目标:** 优化配音功能，支持单独生成、角色独立配置、性能优化和试听功能

---

## 概述

本次优化包含四个核心功能：

1. **配音界面改进** - 在项目编辑页面和单独的配音管理页面都支持单独配音
2. **角色独立声音配置** - 每个角色可以配置独立的 TTS 参数
3. **性能优化** - 缓存 Azure TTS access token
4. **试听功能** - 在分镜配音页面可以试听配音效果

---

## 一、配音界面改进

### 1.1 项目编辑页面的"配音生成"步骤增强

**当前状态:**
- 只有批量生成按钮
- 分镜列表不显示 narration/dialogue 文本

**改进后:**
- 每个分镜卡片显示完整的 narration/dialogue 文本
- 每个分镜有独立的"生成配音"按钮
- 保留原有的"批量生成配音"按钮
- 分镜卡片布局：
  ```
  ┌─────────────────────────────────────┐
  │ 分镜 1  [状态徽章]                  │
  │ ─────────────────────────────────   │
  │ 场景描述: ...                       │
  │ 旁白: "..." (绿色)                  │
  │ 台词: "..." (蓝色)                  │
  │ ─────────────────────────────────   │
  │ [生成配音] [试听] [音频控件]        │
  └─────────────────────────────────────┘
  ```

### 1.2 新增"配音管理"独立页面

**路由:** `/projects/:id/audio`

**页面功能:**
- 顶部：项目标题、返回按钮、批量操作栏
- 主体：分镜列表，每个分镜包含：
  - 分镜序号和场景描述
  - narration/dialogue 文本（完整显示）
  - 配音状态/播放控件
  - 单独的"生成"、"试听"按钮
  - 复选框（用于批量选择）
- 底部：批量生成按钮（仅当有选中项时启用）

**导航入口:**
- 在项目编辑页面步骤栏添加"配音管理"按钮
- 或在项目编辑页面的"配音生成"步骤添加"打开配音管理页面"链接

---

## 二、角色独立声音配置

### 2.1 数据模型更新

**后端 (schemas.py):**
```python
class TTSConfig(BaseModel):
    """角色 TTS 配置"""
    voice: str = "zh-CN-XiaoxiaoNeural"
    rate: float = 1.0
    pitch: int = 0

class Character(BaseModel):
    # ... 现有字段 ...
    ttsConfig: Optional[TTSConfig] = None  # 新增
```

**前端 (api.ts):**
```typescript
export interface TTSConfig {
  voice: string;
  rate: number;
  pitch: number;
}

export interface Character {
  // ... 现有字段 ...
  ttsConfig?: TTSConfig;
}
```

### 2.2 角色编辑界面

**在角色卡片中添加"声音配置"区域:**
```
┌─────────────────────────────────────┐
│ 角色: 秦楠                          │
│ 描述: ...                            │
│ ─────────────────────────────────   │
│ 声音配置:                            │
│ 声音: [下拉选择器]                   │
│ 语速: [滑块 0.5x - 2.0x]           │
│ 音调: [滑块 -100Hz - +100Hz]       │
│ [试听角色声音]                        │
└─────────────────────────────────────┘
```

**常用中文声音列表:**
- zh-CN-XiaoxiaoNeural (女声, 标准)
- zh-CN-YunxiNeural (男声)
- zh-CN-YunyangNeural (男声)
- zh-CN-XiaoyouNeural (女声, 童声)
- zh-CN-XiaohanNeural (女声)
- zh-CN-YunjianNeural (男声)

### 2.3 配音生成逻辑

**优先级规则:**
1. 如果分镜有关联角色 → 使用该角色的 ttsConfig
2. 如果没有关联角色或角色没有配置 → 使用全局 TTS 设置
3. 如果有多个角色 → 使用第一个角色的配置
4. 旁白优先使用全局配置，台词优先使用角色配置

**TTSClient 更新:**
```python
class TTSClient:
    async def synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        rate: Optional[float] = None,
        pitch: Optional[int] = None,
        tts_config: Optional[TTSConfig] = None  # 新增
    ) -> tuple[bytes, float]:
        # 如果提供了 tts_config，优先使用
        if tts_config:
            voice = voice or tts_config.voice
            rate = rate or tts_config.rate
            pitch = pitch or tts_config.pitch
        # ... 其余逻辑 ...
```

---

## 三、性能优化 - Access Token 缓存

### 3.1 缓存策略

**Azure TTS Token 特性:**
- 有效期: 10 分钟
- 建议: 提前 1 分钟刷新

**我们的策略:**
- 缓存有效期: 9 分钟
- 双重缓存:
  - 内存缓存: 快速访问
  - 文件缓存: 后端重启后可恢复

### 3.2 缓存文件位置

**路径:** `data/tts_token_cache.json`

**格式:**
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "expiresAt": "2026-03-17T20:15:00.000Z"
}
```

### 3.3 TTSClient 更新

**新方法:**
```python
class TTSClient:
    def __init__(self, settings_or_key: Optional[Union[GlobalSettings, str]] = None, region: Optional[str] = None):
        # ... 现有初始化 ...
        self._token_cache: Optional[Tuple[str, datetime]] = None  # (token, expires_at)
        self._token_cache_file = Path(settings.data_dir) / "tts_token_cache.json"
        self._load_token_cache()

    def _load_token_cache(self):
        """从内存和文件加载缓存"""
        # 先尝试内存缓存
        if self._token_cache:
            token, expires_at = self._token_cache
            if expires_at > datetime.now(datetime.timezone.utc):
                return token
        # 再尝试文件缓存
        if self._token_cache_file.exists():
            try:
                data = json.loads(self._token_cache_file.read_text())
                expires_at = datetime.fromisoformat(data["expiresAt"])
                if expires_at > datetime.now(datetime.timezone.utc):
                    self._token_cache = (data["token"], expires_at)
                    return data["token"]
            except Exception:
                pass
        return None

    def _save_token_cache(self, token: str, expires_at: datetime):
        """保存缓存到内存和文件"""
        self._token_cache = (token, expires_at)
        self._token_cache_file.write_text(json.dumps({
            "token": token,
            "expiresAt": expires_at.isoformat()
        }))

    async def _get_access_token(self) -> str:
        # 先检查缓存
        cached_token = self._load_token_cache()
        if cached_token:
            return cached_token
        # 缓存无效，重新获取
        # ... 现有的获取 token 逻辑 ...
        # 保存新 token（9 分钟后过期）
        expires_at = datetime.now(datetime.timezone.utc) + timedelta(minutes=9)
        self._save_token_cache(token, expires_at)
        return token
```

---

## 四、试听功能

### 4.1 试听 API 端点

**端点:** `POST /api/projects/{id}/storyboards/{sb_id}/audio/preview`

**功能:**
- 生成临时音频但不保存到项目
- 返回音频数据供前端播放
- 使用当前分镜的文本和角色配置

**Request/Response:**
```python
# Request: 无额外参数，使用分镜现有数据
# Response:
{
    "audioData": "base64_encoded_audio_data",
    "duration": 2.5,
    "mimeType": "audio/wav"
}
```

### 4.2 前端试听 UI

**试听按钮:**
- 位置：分镜卡片上，"生成配音"按钮旁边
- 状态：
  - 正常状态：显示"试听"
  - 生成中：显示"试听中..."并禁用
  - 完成后：显示临时 audio 控件

**试听流程:**
1. 用户点击"试听"
2. 调用预览 API
3. 收到 base64 音频数据
4. 创建临时 blob URL
5. 用 `<audio>` 控件播放
6. 播放完成后清理 blob URL

---

## 五、API 端点清单

### 新增端点

| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/api/projects/{id}/storyboards/{sb_id}/audio/preview` | 试听分镜配音 |

### 更新端点

| 方法 | 端点 | 变更 |
|------|------|------|
| PUT | `/api/projects/{id}/characters/{char_id}` | 支持更新 ttsConfig |
| POST | `/api/projects/{id}/generate/audio` | 支持角色 ttsConfig |
| POST | `/api/projects/{id}/generate/audios` | 支持角色 ttsConfig |

---

## 六、文件清单

### 后端修改/新增

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/models/schemas.py` | 修改 | 添加 TTSConfig 模型，更新 Character |
| `backend/core/tts.py` | 修改 | 添加 token 缓存，支持 tts_config 参数 |
| `backend/api/generation.py` | 修改 | 支持角色 ttsConfig，添加预览端点 |
| `backend/api/projects.py` | 修改 | 支持更新角色 ttsConfig |

### 前端修改/新增

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/services/api.ts` | 修改 | 更新类型，添加新 API 方法 |
| `frontend/src/pages/ProjectEditor.tsx` | 修改 | 增强配音生成步骤 |
| `frontend/src/pages/AudioManager.tsx` | 新增 | 配音管理页面 |
| `frontend/src/App.tsx` | 修改 | 添加新路由 |

---

## 七、实现顺序

1. **Phase 1:** 数据模型更新 + TTSClient token 缓存
2. **Phase 2:** 角色独立声音配置 + 编辑 UI
3. **Phase 3:** 项目编辑页面配音增强
4. **Phase 4:** 配音管理独立页面
5. **Phase 5:** 试听功能

---

## 八、向后兼容

- 角色 ttsConfig 是可选字段，现有数据不受影响
- token 缓存是增量功能，不影响现有逻辑
- 所有 API 变更保持向后兼容
