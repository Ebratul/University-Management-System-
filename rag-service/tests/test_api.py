from fastapi.testclient import TestClient

from app.main import app

from .conftest import TOKEN, FakeLLM, good_question

client = TestClient(app)
BODY = {
    "document_url": "https://res.cloudinary.com/x/doc.pdf",
    "course_id": "c1",
    "material_id": "m1",
    "number_of_questions": 2,
    "difficulty": "easy",
}


def test_health_needs_no_token():
    assert client.get("/health").json() == {"status": "ok"}


def test_generate_requires_the_internal_token():
    assert client.post("/generate-quiz", json=BODY).status_code == 401
    assert client.post("/generate-quiz", json=BODY, headers={"X-Internal-Token": "nope"}).status_code == 401


def test_service_without_a_configured_token_rejects_everything(monkeypatch):
    from app import config

    monkeypatch.setenv("RAG_SERVICE_TOKEN", "")
    config.get_settings.cache_clear()
    assert client.post("/generate-quiz", json=BODY, headers={"X-Internal-Token": ""}).status_code == 401


def test_success_shape(serve_pdf, use_llm):
    use_llm(FakeLLM(lambda ids, n: [good_question(ids[0], i) for i in range(n)]))
    res = client.post("/generate-quiz", json=BODY, headers={"X-Internal-Token": TOKEN})
    assert res.status_code == 200
    data = res.json()
    assert set(data) == {"questions", "warnings", "stats"}
    q = data["questions"][0]
    assert set(q) == {"question", "options", "correct_answer", "explanation", "source_reference"}


def test_insufficient_maps_to_422(serve_pdf, use_llm):
    use_llm(FakeLLM(lambda ids, n: []))
    res = client.post("/generate-quiz", json=BODY, headers={"X-Internal-Token": TOKEN})
    assert res.status_code == 422
    assert res.json()["code"] == "INSUFFICIENT_CONTEXT"
    assert res.json()["message"].startswith("Insufficient information in the provided material")


def test_disallowed_document_host_is_refused():
    res = client.post(
        "/generate-quiz",
        json={**BODY, "document_url": "https://evil.example.com/a.pdf"},
        headers={"X-Internal-Token": TOKEN},
    )
    assert res.status_code == 400 and res.json()["code"] == "DOCUMENT_ERROR"


def test_plain_http_and_internal_addresses_are_refused():
    for url in ("http://res.cloudinary.com/a.pdf", "https://169.254.169.254/latest/meta-data"):
        res = client.post(
            "/generate-quiz", json={**BODY, "document_url": url}, headers={"X-Internal-Token": TOKEN}
        )
        assert res.status_code == 400


def test_invalid_input_is_422_validation():
    res = client.post(
        "/generate-quiz", json={**BODY, "number_of_questions": 500}, headers={"X-Internal-Token": TOKEN}
    )
    assert res.status_code == 422
