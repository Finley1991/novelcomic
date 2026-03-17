import aiohttp
from typing import Optional, Union
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

    async def _get_access_token(self) -> str:
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
                return await resp.text()

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
    async def synthesize(self, text: str, voice: Optional[str] = None, rate: Optional[float] = None, pitch: Optional[int] = None) -> tuple[bytes, float]:
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")

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
