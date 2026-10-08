import hashlib
import os
import re
import tempfile
from urllib.parse import urlparse

import httpx
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document

from app.config import get_settings
from app.errors import DocumentError, InsufficientContent

_MAX_REDIRECTS = 3


def _check_url(url: str) -> None:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or host not in get_settings().allowed_hosts:
        # The URL comes from another service, but never fetch arbitrary hosts:
        # this closes off server-side request forgery.
        raise DocumentError("The document URL is not an allowed location.")


def download_pdf(url: str) -> bytes:
    """Fetch the PDF, re-checking the host on every redirect and capping size."""
    s = get_settings()
    limit = s.max_pdf_mb * 1024 * 1024
    try:
        with httpx.Client(timeout=s.download_timeout_seconds, follow_redirects=False) as client:
            for _ in range(_MAX_REDIRECTS + 1):
                _check_url(url)
                with client.stream("GET", url) as response:
                    if response.is_redirect:
                        location = response.headers.get("location", "")
                        url = str(response.url.join(location))
                        continue
                    if response.status_code != 200:
                        raise DocumentError(
                            f"The document could not be downloaded (HTTP {response.status_code})."
                        )
                    data = bytearray()
                    for part in response.iter_bytes():
                        data.extend(part)
                        if len(data) > limit:
                            raise DocumentError(f"The PDF is larger than {s.max_pdf_mb} MB.")
                    return bytes(data)
    except httpx.HTTPError as exc:
        raise DocumentError("The document could not be downloaded.") from exc
    raise DocumentError("Too many redirects while downloading the document.")


def clean_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # re-join words hyphenated at line ends
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def pdf_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_pdf(data: bytes, *, course_id: str, material_id: str) -> list[Document]:
    """One Document per page that has extractable text, tagged with its owner."""
    if not data.startswith(b"%PDF-"):
        raise DocumentError("The file is not a valid PDF.")

    fd, path = tempfile.mkstemp(suffix=".pdf")
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
        try:
            pages = PyPDFLoader(path).load()
        except Exception as exc:  # corrupt / encrypted PDFs raise assorted errors
            raise DocumentError("The PDF could not be read.") from exc
    finally:
        os.unlink(path)

    max_pages = get_settings().max_pdf_pages
    if len(pages) > max_pages:
        raise DocumentError(f"The PDF has more than {max_pages} pages.")

    docs: list[Document] = []
    for page in pages:
        text = clean_text(page.page_content)
        if not text:
            continue
        docs.append(
            Document(
                page_content=text,
                metadata={
                    "page": int(page.metadata.get("page", 0)) + 1,  # 1-based for humans
                    "course_id": course_id,
                    "material_id": material_id,
                },
            )
        )
    if not docs:
        raise InsufficientContent(
            "No readable text was found in this PDF (it may be a scanned image)."
        )
    return docs
