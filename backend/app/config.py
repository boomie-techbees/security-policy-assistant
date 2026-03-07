"""App configuration. All document and index storage is local."""
from pathlib import Path
from pydantic_settings import BaseSettings


def get_data_dir() -> Path:
    """Directory for uploaded docs and index (local only)."""
    d = Path(__file__).resolve().parent.parent / "data"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_uploads_dir() -> Path:
    """Where uploaded policy files are stored."""
    p = get_data_dir() / "uploads"
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_index_dir() -> Path:
    """Where embedding index and metadata are stored."""
    p = get_data_dir() / "index"
    p.mkdir(parents=True, exist_ok=True)
    return p


class Settings(BaseSettings):
    """Settings from environment (e.g. .env)."""
    anthropic_api_key: str = ""
    # Optional: allow running without API key for doc upload/indexing only
    model: str = "claude-sonnet-4-20250514"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
