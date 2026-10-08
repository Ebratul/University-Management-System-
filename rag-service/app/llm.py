from langchain_core.embeddings import Embeddings
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from app.config import get_settings
from app.errors import GenerationFailed


def get_llm() -> ChatOpenAI:
    s = get_settings()
    if not s.openrouter_api_key:
        raise GenerationFailed("The AI model is not configured (OPENROUTER_API_KEY).")
    return ChatOpenAI(
        model=s.openrouter_model,
        api_key=s.openrouter_api_key,
        base_url=s.openrouter_base_url,
        temperature=0.2,
        timeout=s.llm_timeout_seconds,
        max_retries=2,
    )


def get_embeddings() -> Embeddings:
    s = get_settings()
    if s.embedding_provider == "fastembed":
        try:
            from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
        except ImportError as exc:  # optional dependency
            raise GenerationFailed(
                "EMBEDDING_PROVIDER=fastembed needs `pip install fastembed`."
            ) from exc
        return FastEmbedEmbeddings()
    if not s.openrouter_api_key:
        raise GenerationFailed("The AI model is not configured (OPENROUTER_API_KEY).")
    return OpenAIEmbeddings(
        model=s.embedding_model,
        api_key=s.openrouter_api_key,
        base_url=s.openrouter_base_url,
        # Non-OpenAI endpoints do not accept pre-tokenised input.
        check_embedding_ctx_length=False,
    )
