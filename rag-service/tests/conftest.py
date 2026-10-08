import re
from typing import Callable

import pytest
from fpdf import FPDF
from langchain_core.embeddings import DeterministicFakeEmbedding

from app import config, llm, pdf_loader
from app.schemas import LLMBatch, LLMQuestion, LLMVerdict, LLMVerdicts

TOKEN = "test-token"

PAGES = [
    "Database normalization is the process of organizing a relational database to reduce "
    "redundancy and improve data integrity. A table is in first normal form when every "
    "column holds atomic values and each row is unique. " * 4,
    "Second normal form requires that the table is in first normal form and that every "
    "non-key attribute depends on the whole primary key, not on part of it. Third normal "
    "form removes transitive dependencies between non-key attributes. " * 4,
    "A transaction is a unit of work that must be atomic, consistent, isolated and durable. "
    "These ACID properties guarantee that a database stays correct despite failures. " * 4,
]


def make_pdf(pages: list[str]) -> bytes:
    pdf = FPDF()
    for text in pages:
        pdf.add_page()
        pdf.set_font("Helvetica", size=11)
        pdf.multi_cell(0, 6, text)
    return bytes(pdf.output())


@pytest.fixture(autouse=True)
def settings(monkeypatch, tmp_path):
    monkeypatch.setenv("RAG_SERVICE_TOKEN", TOKEN)
    monkeypatch.setenv("OPENROUTER_API_KEY", "x")
    monkeypatch.setenv("INDEX_DIR", str(tmp_path / "index"))
    monkeypatch.setenv("MAX_ATTEMPTS", "3")
    config.get_settings.cache_clear()
    yield
    config.get_settings.cache_clear()


@pytest.fixture(autouse=True)
def fake_embeddings(monkeypatch):
    monkeypatch.setattr(llm, "get_embeddings", lambda: DeterministicFakeEmbedding(size=32))


@pytest.fixture
def pdf_bytes() -> bytes:
    return make_pdf(PAGES)


@pytest.fixture
def serve_pdf(monkeypatch, pdf_bytes):
    monkeypatch.setattr(pdf_loader, "download_pdf", lambda url: pdf_bytes)


TOPICS = [
    "first normal form", "second normal form", "third normal form", "atomicity",
    "consistency", "isolation", "durability", "primary keys", "transitive dependency",
    "data redundancy", "relational schemas", "transactions", "integrity rules", "failures",
    "unique rows", "atomic values", "partial dependency", "database correctness",
]


def good_question(chunk_id: str, n: int) -> LLMQuestion:
    topic = TOPICS[n % len(TOPICS)]
    return LLMQuestion(
        question=f"Which statement about {topic} (item {n}) matches the course material?",
        option_a=f"Alpha answer {n}",
        option_b=f"Bravo answer {n}",
        option_c=f"Charlie answer {n}",
        option_d=f"Delta answer {n}",
        correct_answer="B",
        explanation=f"The material states bravo {n}.",
        source_chunk_ids=[chunk_id],
    )


class FakeLLM:
    """Stands in for ChatOpenAI.with_structured_output(...).invoke(messages)."""

    def __init__(self, batches: Callable[[list[str], int], list[LLMQuestion]], verdict=None):
        self.batches = batches
        self.verdict = verdict or (lambda i: LLMVerdict(
            index=i, answerable_from_context=True, correct_answer_is_right=True,
            explanation_consistent=True))
        self.calls = 0
        self.prompts: list[str] = []

    def with_structured_output(self, schema):
        outer = self

        class Runner:
            def invoke(self, messages):
                text = messages[-1].content
                outer.prompts.append(text)
                if schema is LLMBatch:
                    outer.calls += 1
                    ids = re.findall(r"^\[(p\d+-c\d+)\]", text, flags=re.M)
                    count = int(re.search(r"Generate (\d+)", text).group(1))
                    return LLMBatch(questions=outer.batches(ids, count))
                indexes = [int(m) for m in re.findall(r"Question index: (\d+)", text)]
                return LLMVerdicts(verdicts=[outer.verdict(i) for i in indexes])

        return Runner()


@pytest.fixture
def use_llm(monkeypatch):
    def _install(fake: FakeLLM) -> FakeLLM:
        monkeypatch.setattr(llm, "get_llm", lambda: fake)
        return fake

    return _install
