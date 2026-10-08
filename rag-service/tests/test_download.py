
import httpx
import pytest

from app import pdf_loader
from app.errors import DocumentError


def mock_client(monkeypatch, handler):
    real = httpx.Client
    monkeypatch.setattr(
        pdf_loader.httpx,
        "Client",
        lambda **kw: real(transport=httpx.MockTransport(handler), **kw),
    )


URL = "https://res.cloudinary.com/demo/raw/authenticated/a.pdf"


def test_downloads_pdf_bytes(monkeypatch):
    mock_client(monkeypatch, lambda r: httpx.Response(200, content=b"%PDF-1.4 data"))
    assert pdf_loader.download_pdf(URL) == b"%PDF-1.4 data"


def test_redirect_to_another_host_is_refused(monkeypatch):
    def handler(request):
        if request.url.host == "res.cloudinary.com":
            return httpx.Response(302, headers={"location": "https://evil.example.com/x.pdf"})
        return httpx.Response(200, content=b"%PDF- stolen")

    mock_client(monkeypatch, handler)
    with pytest.raises(DocumentError, match="not an allowed"):
        pdf_loader.download_pdf(URL)


def test_redirect_within_allowed_hosts_is_followed(monkeypatch):
    def handler(request):
        if request.url.host == "api.cloudinary.com":
            return httpx.Response(302, headers={"location": "https://res.cloudinary.com/final.pdf"})
        return httpx.Response(200, content=b"%PDF-ok")

    mock_client(monkeypatch, handler)
    assert pdf_loader.download_pdf("https://api.cloudinary.com/v1_1/demo/raw/download?x=1") == b"%PDF-ok"


def test_oversize_download_is_cut_off(monkeypatch):
    monkeypatch.setenv("MAX_PDF_MB", "1")
    from app import config

    config.get_settings.cache_clear()
    mock_client(monkeypatch, lambda r: httpx.Response(200, content=b"0" * (2 * 1024 * 1024)))
    with pytest.raises(DocumentError, match="larger than 1 MB"):
        pdf_loader.download_pdf(URL)


def test_http_error_becomes_document_error(monkeypatch):
    mock_client(monkeypatch, lambda r: httpx.Response(401))
    with pytest.raises(DocumentError, match="HTTP 401"):
        pdf_loader.download_pdf(URL)


def test_non_pdf_bytes_are_rejected():
    with pytest.raises(DocumentError, match="not a valid PDF"):
        pdf_loader.load_pdf(b"<html>nope</html>", course_id="c", material_id="m")
