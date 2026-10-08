import re
import threading
from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

from app.config import get_settings

_lock = threading.Lock()


def _index_path(material_id: str, content_hash: str) -> Path:
    s = get_settings()
    model = re.sub(r"[^A-Za-z0-9]+", "-", f"{s.embedding_provider}-{s.embedding_model}")
    # One index per (material, PDF content, embedding model): re-uploading a
    # changed file, or switching models, never reuses a stale index. Course A
    # and course B materials can never share an index.
    return Path(s.index_dir) / f"{material_id}-{content_hash[:16]}-{model}"


def get_or_build_store(
    *,
    material_id: str,
    content_hash: str,
    chunks: list[Document],
    embeddings: Embeddings,
) -> FAISS:
    path = _index_path(material_id, content_hash)
    with _lock:
        if (path / "index.faiss").exists():
            # The folder is written only by this service, in a private volume.
            return FAISS.load_local(
                str(path), embeddings, allow_dangerous_deserialization=True
            )
        store = FAISS.from_documents(chunks, embeddings)
        path.parent.mkdir(parents=True, exist_ok=True)
        store.save_local(str(path))
        return store
