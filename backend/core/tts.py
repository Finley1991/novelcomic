import aiohttp
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, Union, Tuple, Any
import logging
import struct
import wave
from io import BytesIO

from config import settings
from core.retry import async_retry
from models.schemas import GlobalSettings

logger = logging.getLogger(__name__)

class TTSClient:
    def __init__(
        self,
        settings_or_key: Optional[Union[GlobalSettings, str]] = None,
        region: Optional[str] = None
    ):
        """
        Initialize TTS client.

        Args:
            settings_or_key: Either a GlobalSettings object, or an Azure key string, or None
            region: Azure region (only needed if first arg is a key string
        """
        if isinstance(settings_or_key, GlobalSettings):
            # Use GlobalSettings object
            self.key = settings_or_key.tts.azureKey
            self.region = settings_or_key.tts.azureRegion
            self.voice = settings_or_key.tts.voice
            self.rate = settings_or_key.tts.rate
            self.pitch = settings_or_key.tts.pitch
        else:
            # Legacy mode: key string + region
            self.key = settings_or_key or settings.azure_tts_key
            self.region = region or settings.azure_tts_region
            self.voice = settings.tts_voice
            self.rate = settings.tts_rate
            self.pitch = settings.tts_pitch

        # Token cache
        self._token_cache: Optional[Tuple[str, datetime]] = None
        self._token_cache_file: Optional[Path] = None
        if isinstance(settings_or_key, GlobalSettings):
            # If we have GlobalSettings, try to use its data_dir if available
            pass
        # Fallback to config data_dir
        self._token_cache_file = settings.data_dir / "tts_token_cache.json"
        self._load_token_cache()

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

    def _build_ssml(self, text: str, voice: Optional[str] = None, rate: Optional[float] = None, pitch: Optional[int] = None) -> str:
        voice = voice or self.voice
        rate = rate or self.rate
        pitch = pitch or self.pitch

        prosody_rate = f"{rate * 100:.0f}%"
        prosody_pitch = f"{pitch:+d}Hz" if pitch != 0 else "0Hz"

        return f"""<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN">
    <voice name="{voice}">
        <prosody rate="{prosody_rate}" pitch="{prosody_pitch}">
            {text}
        </prosody>
    </voice>
</speak>"""

    @async_retry(retries=settings.tts_max_retries, delay=1.0, backoff=2.0)
    async def synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        rate: Optional[float] = None,
        pitch: Optional[int] = None,
        tts_config: Optional[Any] = None  # Use Any for backwards compatibility
    ) -> tuple[bytes, float]:
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")

        # 如果没有配置 Azure TTS key，返回 mock 音频（静音）用于测试
        if not self.key or not self.region:
            logger.warning("Azure TTS not configured, returning mock audio")
            # 估算音频时长：中文字数 * 0.18 秒/字
            duration = max(1.0, len(text) * 0.18)
            # 生成静音 WAV
            sample_rate = 24000
            num_channels = 1
            bits_per_sample = 16
            num_samples = int(sample_rate * duration)
            # 创建 WAV 头部
            import struct
            wav_header = struct.pack(
                '<4sI4s',
                b'RIFF',
                36 + num_samples * num_channels * bits_per_sample // 8,
                b'WAVE'
            )
            fmt_header = struct.pack(
                '<4sIHHIIHH',
                b'fmt ',
                16,
                1,
                num_channels,
                sample_rate,
                sample_rate * num_channels * bits_per_sample // 8,
                num_channels * bits_per_sample // 8,
                bits_per_sample
            )
            data_header = struct.pack(
                '<4sI',
                b'data',
                num_samples * num_channels * bits_per_sample // 8
            )
            # 静音数据
            audio_data = wav_header + fmt_header + data_header + b'\x00' * (num_samples * num_channels * bits_per_sample // 8)
            return audio_data, duration

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

        access_token = await self._get_access_token()
        ssml = self._build_ssml(text, voice, rate, pitch)

        url = f"https://{self.region}.tts.speech.microsoft.com/cognitiveservices/v1"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm"
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, data=ssml.encode("utf-8"), timeout=settings.tts_timeout) as resp:
                if resp.status != 200:
                    text_resp = await resp.text()
                    raise Exception(f"TTS synthesis failed: {resp.status} - {text_resp}")
                audio_data = await resp.read()

        duration = self._calculate_duration(audio_data)
        return audio_data, duration

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

    def _calculate_duration(self, wav_data: bytes) -> float:
        try:
            with wave.open(BytesIO(wav_data), 'rb') as wav:
                frames = wav.getnframes()
                rate = wav.getframerate()
                return frames / rate
        except Exception:
            return len(wav_data) / 48000

    async def test_connection(self) -> dict:
        """Test the TTS connection with a simple prompt"""
        test_text = "你好，这是一个测试。"
        try:
            audio_data, duration = await self.synthesize(test_text)
            return {
                "success": True,
                "voice": self.voice,
                "duration": duration,
                "audioSize": len(audio_data)
            }
        except Exception as e:
            logger.error(f"TTS test failed: {e}")
            return {
                "success": False,
                "voice": self.voice,
                "error": str(e)
            }
