from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    data_dir: Path = Path("./data")

    comfyui_api_url: str = "http://8.222.174.34:8188"
    comfyui_timeout: int = 300
    comfyui_max_retries: int = 3
    comfyui_concurrent_limit: int = 3

    ollama_api_url: str = "http://8.222.174.34:11434"
    ollama_model: str = "llama3"
    ollama_timeout: int = 120
    ollama_max_retries: int = 2
    ollama_chunk_size: int = 4000

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o"
    openai_timeout: int = 120
    openai_max_retries: int = 2
    openai_chunk_size: int = 4000

    azure_tts_key: Optional[str] = None
    azure_tts_region: Optional[str] = None
    tts_voice: str = "zh-CN-XiaoxiaoNeural"
    tts_rate: float = 1.0
    tts_pitch: int = 0
    tts_timeout: int = 60
    tts_max_retries: int = 3
    tts_concurrent_limit: int = 5

    jianying_canvas_width: int = 1920
    jianying_canvas_height: int = 1080
    jianying_canvas_ratio: str = "16:9"

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()

def ensure_data_dirs():
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / "projects").mkdir(exist_ok=True)
