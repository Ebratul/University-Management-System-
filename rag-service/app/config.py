from functools import lru_cache

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# LangChain/LangSmith read LANGSMITH_* / LANGCHAIN_* straight from os.environ,
# so a local .env must be loaded into the process environment, not just into
# this settings object.
load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    rag_service_token: str = ""
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "openai/gpt-4o-mini"
    embedding_provider: str = "openrouter"  # "openrouter" | "fastembed"
    embedding_model: str = "openai/text-embedding-3-small"

    index_dir: str = "./.index"
    allowed_document_hosts: str = "api.cloudinary.com,res.cloudinary.com"
    max_pdf_mb: int = 20
    max_pdf_pages: int = 300
    download_timeout_seconds: float = 30.0

    chunk_size: int = 1000
    chunk_overlap: int = 150
    min_context_chars: int = 400
    max_questions: int = Field(30, ge=1)
    max_attempts: int = 3
    llm_timeout_seconds: float = 90.0

    @property
    def allowed_hosts(self) -> set[str]:
        return {h.strip().lower() for h in self.allowed_document_hosts.split(",") if h.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
