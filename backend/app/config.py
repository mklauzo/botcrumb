from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    ollama_url: str = "http://ollama:11434"
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
