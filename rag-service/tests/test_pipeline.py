import pytest

from app.errors import InsufficientContent
from app.graph import generate_quiz
from app.schemas import GenerateRequest, LLMVerdict

from .conftest import FakeLLM, good_question, make_pdf


def request(**kw) -> GenerateRequest:
    base = dict(
        document_url="https://res.cloudinary.com/x/doc.pdf",
        course_id="course1",
        material_id="material1",
        number_of_questions=3,
        difficulty="medium",
    )
    return GenerateRequest(**{**base, **kw})


def test_happy_path_is_grounded_and_well_formed(serve_pdf, use_llm):
    fake = use_llm(FakeLLM(lambda ids, n: [good_question(ids[i % len(ids)], i) for i in range(n)]))
    out = generate_quiz(request())

    assert len(out.questions) == 3
    assert out.stats.pages == 3 and out.stats.chunks >= 3
    for q in out.questions:
        assert set(q.options) == {"A", "B", "C", "D"}
        assert len(set(q.options.values())) == 4
        assert q.correct_answer in q.options
        assert q.explanation
        assert q.source_reference.startswith("Page")
        # the marked answer must still be the "Bravo" option after reordering
        assert q.options[q.correct_answer].startswith("Bravo")
    assert fake.calls == 1


def test_prompt_only_contains_chunks_of_the_selected_material(serve_pdf, use_llm):
    fake = use_llm(FakeLLM(lambda ids, n: [good_question(ids[0], i) for i in range(n)]))
    generate_quiz(request())
    prompt = fake.prompts[0]
    assert "normal form" in prompt
    # every context block is tagged with a chunk id the model must cite
    assert "[p1-c1]" in prompt


def test_invalid_questions_are_rejected_and_repaired(serve_pdf, use_llm):
    state = {"round": 0}

    def batches(ids, n):
        state["round"] += 1
        if state["round"] == 1:
            bad_dup = good_question(ids[0], 1).model_copy(update={"option_c": "Alpha answer 1"})
            bad_src = good_question("p99-c9", 2)  # cites a chunk that was never retrieved
            bad_noexp = good_question(ids[0], 3).model_copy(update={"explanation": " "})
            ok = good_question(ids[0], 4)
            return [bad_dup, bad_src, bad_noexp, ok]
        return [good_question(ids[0], 10 + i) for i in range(n)]

    fake = use_llm(FakeLLM(batches))
    out = generate_quiz(request())

    assert len(out.questions) == 3
    assert fake.calls == 2, "a repair round must run for the missing questions"
    # the repair prompt carries what went wrong
    assert any("Problems with the previous attempt" in p for p in fake.prompts)
    stems = [q.question for q in out.questions]
    assert len(set(stems)) == 3


def test_reviewer_rejections_are_dropped(serve_pdf, use_llm):
    def verdict(i):
        return LLMVerdict(
            index=i, answerable_from_context=(i != 0), correct_answer_is_right=True,
            explanation_consistent=True, reason="not in the text")

    use_llm(FakeLLM(lambda ids, n: [good_question(ids[0], i) for i in range(n)], verdict))
    out = generate_quiz(request(number_of_questions=2))
    assert len(out.questions) == 2  # replacements were generated until the quota was met


def test_returns_fewer_with_a_warning_when_material_is_thin(serve_pdf, use_llm):
    use_llm(FakeLLM(lambda ids, n: [good_question(ids[0], 1)]))  # always the same single question
    out = generate_quiz(request(number_of_questions=5))
    assert len(out.questions) == 1
    assert any("Only 1 of 5" in w for w in out.warnings)


def test_nothing_valid_means_insufficient(serve_pdf, use_llm):
    use_llm(FakeLLM(lambda ids, n: []))
    with pytest.raises(InsufficientContent):
        generate_quiz(request())


def test_pdf_without_text_is_insufficient(monkeypatch, use_llm):
    from app import pdf_loader

    monkeypatch.setattr(pdf_loader, "download_pdf", lambda url: make_pdf([""]))
    use_llm(FakeLLM(lambda ids, n: []))
    with pytest.raises(InsufficientContent):
        generate_quiz(request())


def test_tiny_pdf_is_insufficient_before_calling_the_model(monkeypatch, use_llm):
    from app import pdf_loader

    monkeypatch.setattr(pdf_loader, "download_pdf", lambda url: make_pdf(["Hello world."]))
    fake = use_llm(FakeLLM(lambda ids, n: [good_question(ids[0], 1)]))
    with pytest.raises(InsufficientContent):
        generate_quiz(request())
    assert fake.calls == 0


def test_materials_get_separate_indexes(serve_pdf, use_llm, tmp_path):
    use_llm(FakeLLM(lambda ids, n: [good_question(ids[0], i) for i in range(n)]))
    generate_quiz(request(material_id="matA", course_id="courseA"))
    generate_quiz(request(material_id="matB", course_id="courseB"))
    names = sorted(p.name for p in (tmp_path / "index").iterdir())
    assert len(names) == 2 and names[0].startswith("matA-") and names[1].startswith("matB-")


def test_index_is_reused_for_the_same_pdf(serve_pdf, use_llm, monkeypatch):
    from app import graph

    use_llm(FakeLLM(lambda ids, n: [good_question(ids[0], i) for i in range(n)]))
    built = []
    real = graph.get_or_build_store

    def spy(**kw):
        built.append(kw["material_id"])
        return real(**kw)

    monkeypatch.setattr(graph, "get_or_build_store", spy)
    generate_quiz(request())
    generate_quiz(request())
    assert built == ["material1", "material1"]  # called twice, second one loads from disk


def test_unsafe_ids_are_rejected():
    with pytest.raises(ValueError):
        request(material_id="../etc/passwd")
