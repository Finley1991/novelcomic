# TTS 配音功能增强实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化配音功能，支持单独生成、角色独立配置、性能优化和试听功能

**Architecture:**
- 后端：数据模型更新 + TTSClient token 缓存 + API 端点更新
- 前端：项目编辑页面增强 + 新增配音管理页面 + 角色编辑页面增强
- 分阶段实现，每个阶段都可独立工作

**Tech Stack:** FastAPI, Pydantic, React, TypeScript, Tailwind CSS

---

## Phase 1: 数据模型更新 + TTSClient Token 缓存

### Task 1.1: 更新数据模型 - 添加 TTSConfig

**Files:**
- Modify: `backend/models/schemas.py`

- [ ] **Step 1: 添加 TTSConfig 模型**

在 `ComfyUIWorkflowParams` 之前添加：

```python
class TTSConfig(BaseModel):
    """角色 TTS 配置"""
    voice: str = "zh-CN-XiaoxiaoNeural"
    rate: float = 1.0
    pitch: int = 0
```

- [ ] **Step 2: 更新 Character 模型**

在 `Character` 类中添加：

```python
ttsConfig: Optional[TTSConfig] = None
```

- [ ] **Step 3: 验证修改**

确保修改后文件仍然可以正常导入：

```bash
cd backend && source venv/bin/activate && python -c "from models.schemas import Character, TTSConfig; print('OK')"
```
Expected: 输出 "OK"

- [ ] **Step 4: Commit**

```bash
git add backend/models/schemas.py
git commit -m "feat: add TTSConfig model to schemas

- Add TTSConfig model for character voice settings
- Add ttsConfig field to Character model

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 1.2: 更新前端类型定义

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: 添加 TTSConfig 接口**

在 `ComfyUIWorkflowParams` 之前添加：

```typescript
export interface TTSConfig {
  voice: string;
  rate: number;
  pitch: number;
}
```

- [ ] **Step 2: 更新 Character 接口**

在 `Character` 接口中添加：

```typescript
ttsConfig?: TTSConfig;
```

- [ ] **Step 3: 验证修改**

检查 TypeScript 编译：

```bash
cd frontend && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add TTSConfig typescript definitions

- Add TTSConfig interface
- Update Character interface with ttsConfig field

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 1.3: TTSClient Token 缓存

**Files:**
- Modify: `backend/core/tts.py`

- [ ] **Step 1: 添加导入**

在文件顶部添加：

```python
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, Tuple, Union
```

- [ ] **Step 2: 在 TTSClient.__init__ 中添加缓存初始化**

在 `__init__` 方法末尾添加：

```python
        # Token cache
        self._token_cache: Optional[Tuple[str, datetime]] = None
        self._token_cache_file: Optional[Path] = None
        if hasattr(settings, 'data_dir'):
            self._token_cache_file = Path(settings.data_dir) / "tts_token_cache.json"
        self._load_token_cache()
```

- [ ] **Step 3: 添加 _load_token_cache 方法**

在 `_calculate_duration` 方法之前添加：

```python
    def _load_token_cache(self) -> Optional[str]:
        """从内存和文件加载缓存"""
        # 先尝试内存缓存
        if self._token_cache:
            token, expires_at = self._token_cache
            if expires_at > datetime.now(timezone.utc):
                return token
        # 再尝试文件缓存
        if self._token_cache_file and self._token_cache_file.exists():
            try:
                data = json.loads(self._token_cache_file.read_text())
                expires_at = datetime.fromisoformat(data["expiresAt"])
                if expires_at > datetime.now(timezone.utc):
                    self._token_cache = (data["token"], expires_at)
                    return data["token"]
            except Exception:
                pass
        return None

    def _save_token_cache(self, token: str, expires_at: datetime):
        """保存缓存到内存和文件"""
        self._token_cache = (token, expires_at)
        if self._token_cache_file:
            self._token_cache_file.write_text(json.dumps({
                "token": token,
                "expiresAt": expires_at.isoformat()
            }))
```

- [ ] **Step 4: 修改 _get_access_token 方法**

替换 `_get_access_token` 方法：

```python
    async def _get_access_token(self) -> str:
        # 先检查缓存
        cached_token = self._load_token_cache()
        if cached_token:
            return cached_token

        if not self.key or not self.region:
            raise Exception("Azure TTS key and region not configured")

        url = f"https://{self.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
        headers = {
            "Ocp-Apim-Subscription-Key": self.key,
            "Content-Type": "application/x-www-form-urlencoded"
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, timeout=10) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise Exception(f"Failed to get TTS token: {resp.status} - {text}")
                token = await resp.text()

        # 保存新 token（9 分钟后过期）
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=9)
        self._save_token_cache(token, expires_at)
        return token
```

- [ ] **Step 5: 验证修改**

```bash
cd backend && source venv/bin/activate && python -c "from core.tts import TTSClient; print('OK')"
```
Expected: 输出 "OK"

- [ ] **Step 6: Commit**

```bash
git add backend/core/tts.py
git commit -m "feat: add token cache to TTSClient

- Add in-memory and file-based token cache
- Cache tokens for 9 minutes (Azure tokens expire after 10)
- Load from cache first before fetching new token

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 1.4: 更新 TTSClient 支持 tts_config 参数

**Files:**
- Modify: `backend/core/tts.py`

- [ ] **Step 1: 更新 synthesize 方法签名**

修改 `synthesize` 方法参数：

```python
    @async_retry(retries=settings.tts_max_retries, delay=1.0, backoff=2.0)
    async def synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        rate: Optional[float] = None,
        pitch: Optional[int] = None,
        tts_config: Optional[Any] = None  # Use Any for backwards compatibility
    ) -> tuple[bytes, float]:
```

- [ ] **Step 2: 添加 tts_config 处理逻辑**

在 `synthesize` 方法开头添加：

```python
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")

        # 如果提供了 tts_config，优先使用
        if tts_config:
            # Handle both dict and object
            if hasattr(tts_config, 'voice'):
                voice = voice or tts_config.voice
                rate = rate or tts_config.rate
                pitch = pitch or tts_config.pitch
            elif isinstance(tts_config, dict):
                voice = voice or tts_config.get('voice')
                rate = rate or tts_config.get('rate')
                pitch = pitch or tts_config.get('pitch')
```

- [ ] **Step 3: 验证修改**

```bash
cd backend && source venv/bin/activate && python -c "from core.tts import TTSClient; print('OK')"
```
Expected: 输出 "OK"

- [ ] **Step 4: Commit**

```bash
git add backend/core/tts.py
git commit -m "feat: support tts_config parameter in TTSClient

- Add tts_config parameter to synthesize method
- Support both dict and object formats for tts_config
- Priority: tts_config > individual params > defaults

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 2: 更新 generation.py 支持角色 TTS 配置

### Task 2.1: 更新 generate_single_audio 使用角色配置

**Files:**
- Modify: `backend/api/generation.py`

- [ ] **Step 1: 修改 generate_single_audio 函数**

在 `tts_client = TTSClient(settings_obj)` 之后，添加角色配置逻辑：

```python
            settings_obj = storage.load_global_settings()
            tts_client = TTSClient(settings_obj)

            # 获取角色 TTS 配置
            tts_config = None
            if storyboard.characterIds:
                char_map = {c.id: c for c in project.characters}
                for char_id in storyboard.characterIds:
                    if char_id in char_map:
                        char = char_map[char_id]
                        if hasattr(char, 'ttsConfig') and char.ttsConfig:
                            tts_config = char.ttsConfig
                            break

            audio_data, duration = await tts_client.synthesize(text, tts_config=tts_config)
```

- [ ] **Step 2: 验证修改**

```bash
cd backend && source venv/bin/activate && python -c "from api.generation import generate_single_audio; print('OK')"
```
Expected: 输出 "OK"

- [ ] **Step 3: Commit**

```bash
git add backend/api/generation.py
git commit -m "feat: use character ttsConfig for audio generation

- Add logic to get character ttsConfig from storyboard
- Pass tts_config to TTSClient.synthesize
- Fall back to global settings if no character config

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 3: 增强项目编辑页面配音生成步骤

### Task 3.1: 增强 ProjectEditor 配音生成步骤

**Files:**
- Modify: `frontend/src/pages/ProjectEditor.tsx`

- [ ] **Step 1: 添加单独生成配音函数**

在 `handleGenerateAudios` 之后添加：

```typescript
  const handleGenerateSingleAudio = async (storyboardId: string) => {
    if (!id) return;
    try {
      await generationApi.generateAudio(id, storyboardId);
      setPolling(true);
    } catch (error) {
      console.error('Failed to generate audio:', error);
    }
  };
```

- [ ] **Step 2: 更新配音生成步骤 UI**

修改 "配音生成" 步骤部分，增强分镜卡片：

```tsx
        {currentStep === 3 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">配音生成</h3>
              <button
                onClick={handleGenerateAudios}
                disabled={polling}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {polling ? '生成中...' : '批量生成配音'}
              </button>
            </div>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {project.storyboards.map((sb) => (
                <div key={sb.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold">分镜 {sb.index + 1}</span>
                    <div className="flex items-center gap-2">
                      {sb.audioDuration > 0 && (
                        <span className="text-sm text-gray-500">
                          ({sb.audioDuration.toFixed(1)}秒)
                        </span>
                      )}
                      <span className={`text-sm px-2 py-1 rounded ${
                        sb.audioStatus === 'completed' ? 'bg-green-100 text-green-700' :
                        sb.audioStatus === 'generating' ? 'bg-blue-100 text-blue-700' :
                        sb.audioStatus === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {sb.audioStatus === 'completed' ? '已完成' :
                         sb.audioStatus === 'generating' ? '生成中' :
                         sb.audioStatus === 'failed' ? '失败' : '待生成'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{sb.sceneDescription}</p>
                  {sb.narration && (
                    <p className="text-sm text-green-600 mb-1">
                      <span className="font-medium">旁白:</span> {sb.narration}
                    </p>
                  )}
                  {sb.dialogue && (
                    <p className="text-sm text-blue-600 mb-2">
                      <span className="font-medium">台词:</span> {sb.dialogue}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    {sb.audioStatus === 'completed' && sb.audioPath ? (
                      <audio controls className="h-8 flex-1">
                        <source src={`/data/projects/${id}/${sb.audioPath}`} />
                      </audio>
                    ) : (
                      <div className="flex-1" />
                    )}
                    {sb.audioStatus !== 'generating' && (
                      <button
                        onClick={() => handleGenerateSingleAudio(sb.id)}
                        className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                      >
                        {sb.audioStatus === 'completed' ? '重新生成' : '生成配音'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
```

- [ ] **Step 3: 验证修改**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProjectEditor.tsx
git commit -m "feat: enhance audio generation step in ProjectEditor

- Show full narration/dialogue text in audio step
- Add per-storyboard generate button
- Improve status badges with colors
- Add status labels (completed/generating/failed/pending)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 4: 角色编辑页面增强 - 添加 TTS 配置

### Task 4.1: 更新角色编辑界面

**Files:**
- Modify: `frontend/src/pages/ProjectEditor.tsx`

- [ ] **Step 1: 添加角色编辑状态**

在 state 部分添加：

```typescript
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
```

- [ ] **Step 2: 增强角色卡片 UI**

修改角色列表部分，添加 TTS 配置：

```tsx
        {currentStep === 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">角色列表</h3>
              <button
                onClick={handleExtractCharacters}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
              >
                自动提取角色
              </button>
            </div>
            <div className="space-y-4">
              {project.characters.map((char) => (
                <div key={char.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">{char.name}</h4>
                    <button
                      onClick={() => setEditingCharacterId(
                        editingCharacterId === char.id ? null : char.id
                      )}
                      className="text-blue-500 text-sm hover:text-blue-600"
                    >
                      {editingCharacterId === char.id ? '收起' : '编辑声音'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">{char.description}</p>

                  {editingCharacterId === char.id && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      <h5 className="font-medium text-sm">声音配置</h5>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">声音</label>
                        <select
                          value={char.ttsConfig?.voice || 'zh-CN-XiaoxiaoNeural'}
                          onChange={(e) => {
                            const newTtsConfig = {
                              voice: e.target.value,
                              rate: char.ttsConfig?.rate || 1.0,
                              pitch: char.ttsConfig?.pitch || 0
                            };
                            setProject({
                              ...project,
                              characters: project.characters.map(c =>
                                c.id === char.id
                                  ? { ...c, ttsConfig: newTtsConfig }
                                  : c
                              )
                            });
                          }}
                          className="w-full border rounded-md px-3 py-2"
                        >
                          <option value="zh-CN-XiaoxiaoNeural">zh-CN-XiaoxiaoNeural (女声)</option>
                          <option value="zh-CN-YunxiNeural">zh-CN-YunxiNeural (男声)</option>
                          <option value="zh-CN-YunyangNeural">zh-CN-YunyangNeural (男声)</option>
                          <option value="zh-CN-XiaoyouNeural">zh-CN-XiaoyouNeural (童声)</option>
                          <option value="zh-CN-XiaohanNeural">zh-CN-XiaohanNeural (女声)</option>
                          <option value="zh-CN-YunjianNeural">zh-CN-YunjianNeural (男声)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          语速: {(char.ttsConfig?.rate || 1.0).toFixed(1)}x
                        </label>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={char.ttsConfig?.rate || 1.0}
                          onChange={(e) => {
                            const newTtsConfig = {
                              voice: char.ttsConfig?.voice || 'zh-CN-XiaoxiaoNeural',
                              rate: parseFloat(e.target.value),
                              pitch: char.ttsConfig?.pitch || 0
                            };
                            setProject({
                              ...project,
                              characters: project.characters.map(c =>
                                c.id === char.id
                                  ? { ...c, ttsConfig: newTtsConfig }
                                  : c
                              )
                            });
                          }}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          音调: {char.ttsConfig?.pitch || 0}Hz
                        </label>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          step="1"
                          value={char.ttsConfig?.pitch || 0}
                          onChange={(e) => {
                            const newTtsConfig = {
                              voice: char.ttsConfig?.voice || 'zh-CN-XiaoxiaoNeural',
                              rate: char.ttsConfig?.rate || 1.0,
                              pitch: parseInt(e.target.value)
                            };
                            setProject({
                              ...project,
                              characters: project.characters.map(c =>
                                c.id === char.id
                                  ? { ...c, ttsConfig: newTtsConfig }
                                  : c
                              )
                            });
                          }}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {project.characters.length === 0 && (
                <p className="text-gray-500">还没有角色，点击上方按钮自动提取</p>
              )}
            </div>
          </div>
        )}
```

- [ ] **Step 3: 验证修改**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProjectEditor.tsx
git commit -m "feat: add character TTS config UI in ProjectEditor

- Add expandable voice config section for each character
- Add voice selector with common Chinese voices
- Add rate slider (0.5x - 2.0x)
- Add pitch slider (-100Hz - +100Hz)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 5: 更新项目 API 支持保存角色 ttsConfig

### Task 5.1: 更新后端角色更新 API

**Files:**
- Modify: `backend/api/projects.py`

- [ ] **Step 1: 检查并确保角色更新支持 ttsConfig**

查看角色更新端点，确保它可以保存 ttsConfig。如果需要，更新 `UpdateCharacterRequest`（在 schemas.py）或直接在更新逻辑中处理。

- [ ] **Step 2: 验证项目仍可正常加载**

```bash
cd backend && source venv/bin/activate && python -c "
from core.storage import storage
project = storage.load_project('$(cd data/projects && ls -1 | head -1)')
print(f'Project loaded: {project.name}')
"
```
Expected: 项目加载成功

- [ ] **Step 3: Commit**（如有修改）

```bash
git add backend/api/projects.py
git commit -m "feat: support ttsConfig in character update API

- Ensure character updates preserve ttsConfig field

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary

All tasks complete! The implementation covers:
1. Data model updates (TTSConfig)
2. TTSClient token cache optimization
3. Character voice configuration UI
4. Enhanced audio generation UI with per-storyboard controls

Each task is self-contained and builds on the previous one.
