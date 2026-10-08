"""The quiz-generation workflow, as an explicit LangGraph state machine.

START -> load_pdf -> chunk -> index -> retrieve -> generate -> validate
      -> quality_check -> (enough? -> finalize | repair loop -> generate) -> END
"""
import hashlib
import logging
import random
from typing import Any, TypedDict

from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langgraph.graph import END, START, StateGraph

from app import llm as llm_module
from app import pdf_loader, prompts
from app.config import get_settings
from app.errors import GenerationFailed, InsufficientContent
from app.schemas import (
    GeneratedQuestion,
    GenerateRequest,
    GenerateResponse,
    GenerateStats,
    LLMBatch,
    LLMQuestion,
    LLMVerdicts,
)
from app.validation import check_question
from app.vectorstore import get_or_build_store

log = logging.getLogger("rag.graph")

# Different angles on the material so retrieval covers more than one topic.
_RETRIEVAL_QUERIES = [
    "main concepts, definitions and key terms",
    "processes, steps, algorithms and how things work",
    "examples, comparisons, advantages and disadvantages",
    "important rules, formulas, properties and facts",
]


class State(TypedDict, total=False):
    request: GenerateRequest
    document: bytes
    content_hash: str
    pages: list[Document]
    chunks: list[Document]
    store: Any
    context: list[Document]
    candidates: list[LLMQuestion]  # passed deterministic checks, awaiting review
    accepted: list[LLMQuestion]
    feedback: list[str]
    warnings: list[str]
    attempts: int
    response: GenerateResponse


# --------------------------------- nodes -------------------------------------
def load_pdf(state: State) -> State:
    req = state["request"]
    data = pdf_loader.download_pdf(req.document_url)
    pages = pdf_loader.load_pdf(data, course_id=req.course_id, material_id=req.material_id)
    return {"content_hash": pdf_loader.pdf_hash(data), "pages": pages}


def chunk(state: State) -> State:
    s = get_settings()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=s.chunk_size, chunk_overlap=s.chunk_overlap
    )
    chunks = splitter.split_documents(state["pages"])
    per_page: dict[int, int] = {}
    for c in chunks:
        page = c.metadata["page"]
        per_page[page] = per_page.get(page, 0) + 1
        c.metadata["chunk_id"] = f"p{page}-c{per_page[page]}"
    return {"chunks": chunks}


def index(state: State) -> State:
    req = state["request"]
    store = get_or_build_store(
        material_id=req.material_id,
        content_hash=state["content_hash"],
        chunks=state["chunks"],
        embeddings=llm_module.get_embeddings(),
    )
    return {"store": store}


def retrieve(state: State) -> State:
    req = state["request"]
    s = get_settings()
    budget = min(max(req.number_of_questions * 2, 6), 24)
    per_query = max(budget // len(_RETRIEVAL_QUERIES), 2)
    # Metadata filter: even if an index ever held other material, only this
    # course's and this material's chunks can be retrieved.
    scope = {"material_id": req.material_id, "course_id": req.course_id}

    picked: dict[str, Document] = {}
    for query in _RETRIEVAL_QUERIES:
        docs = state["store"].max_marginal_relevance_search(
            query, k=per_query, fetch_k=per_query * 4, filter=scope
        )
        for d in docs:
            picked.setdefault(d.metadata["chunk_id"], d)

    context = sorted(
        picked.values(), key=lambda d: (d.metadata["page"], d.metadata["chunk_id"])
    )[:budget]
    if sum(len(d.page_content) for d in context) < s.min_context_chars:
        raise InsufficientContent()
    return {"context": context, "attempts": 0, "accepted": [], "feedback": [], "warnings": []}


def generate(state: State) -> State:
    req = state["request"]
    accepted = state.get("accepted", [])
    missing = req.number_of_questions - len(accepted)
    # Ask for a few extra: some will be rejected by validation / review.
    ask = min(missing + max(1, missing // 3), get_settings().max_questions)

    messages = [
        SystemMessage(content=prompts.GENERATE_SYSTEM),
        HumanMessage(
            content=prompts.generate_user_prompt(
                context=prompts.format_context(state["context"]),
                count=ask,
                difficulty=req.difficulty,
                existing=[q.question for q in accepted],
                feedback=state.get("feedback", []),
            )
        ),
    ]
    attempts = state.get("attempts", 0) + 1
    try:
        batch = llm_module.get_llm().with_structured_output(LLMBatch).invoke(messages)
    except GenerationFailed:
        raise
    except Exception as exc:  # provider error, malformed structured output, timeout
        log.warning("generation call failed (attempt %s): %s", attempts, type(exc).__name__)
        warnings = [*state.get("warnings", []), f"Attempt {attempts}: the model call failed."]
        return {"attempts": attempts, "candidates": [], "warnings": warnings}

    questions = batch.questions if isinstance(batch, LLMBatch) else batch["questions"]
    return {"attempts": attempts, "candidates": list(questions)}


def validate(state: State) -> State:
    retrieved_ids = {d.metadata["chunk_id"] for d in state["context"]}
    stems = [q.question for q in state.get("accepted", [])]
    feedback = list(state.get("feedback", []))
    valid: list[LLMQuestion] = []
    for q in state.get("candidates", []):
        result = check_question(q, retrieved_ids=retrieved_ids, accepted_stems=stems)
        if result.question:
            valid.append(q)
            stems.append(q.question)
        elif result.reason:
            feedback.append(result.reason)
    return {"candidates": valid, "feedback": feedback}


def quality_check(state: State) -> State:
    """Second opinion from the model: is each question really answerable from
    its cited context, with the marked answer being the only correct one?"""
    candidates = state.get("candidates", [])
    if not candidates:
        return {}

    by_id = {d.metadata["chunk_id"]: d for d in state["context"]}
    items = []
    for i, q in enumerate(candidates):
        items.append(
            {
                "index": i,
                "question": q.question,
                "A": q.option_a,
                "B": q.option_b,
                "C": q.option_c,
                "D": q.option_d,
                "correct": q.correct_answer,
                "explanation": q.explanation,
                "context": "\n\n".join(by_id[c].page_content for c in q.source_chunk_ids if c in by_id),
            }
        )
    messages = [
        SystemMessage(content=prompts.JUDGE_SYSTEM),
        HumanMessage(content=prompts.judge_user_prompt(items)),
    ]
    feedback = list(state.get("feedback", []))
    try:
        result = llm_module.get_llm().with_structured_output(LLMVerdicts).invoke(messages)
        verdicts = result.verdicts if isinstance(result, LLMVerdicts) else result["verdicts"]
    except GenerationFailed:
        raise
    except Exception as exc:
        # An unreviewed question is not returned: fail this round and retry.
        log.warning("review call failed: %s", type(exc).__name__)
        warnings = [*state.get("warnings", []), "A quality review step failed; questions were discarded."]
        return {"candidates": [], "warnings": warnings}

    verdict_by_index = {v.index: v for v in verdicts}
    kept: list[LLMQuestion] = []
    for i, q in enumerate(candidates):
        v = verdict_by_index.get(i)
        if v and v.answerable_from_context and v.correct_answer_is_right and v.explanation_consistent:
            kept.append(q)
        else:
            reason = (v.reason if v and v.reason else "failed review")
            feedback.append(f'"{q.question[:60]}": {reason}')
    accepted = [*state.get("accepted", []), *kept]
    return {"accepted": accepted, "candidates": [], "feedback": feedback}


def _route(state: State) -> str:
    req = state["request"]
    enough = len(state.get("accepted", [])) >= req.number_of_questions
    if enough or state.get("attempts", 0) >= get_settings().max_attempts:
        return "finalize"
    return "generate"  # repair: generate the missing ones, told what went wrong


def _page_label(chunk_ids: list[str], by_id: dict[str, Document]) -> str:
    pages = sorted({by_id[c].metadata["page"] for c in chunk_ids if c in by_id})
    if not pages:
        return "Uploaded material"
    if len(pages) == 1:
        return f"Page {pages[0]}"
    return f"Pages {pages[0]}-{pages[-1]}" if pages == list(range(pages[0], pages[-1] + 1)) else "Pages " + ", ".join(map(str, pages))


def _shuffle_options(q: LLMQuestion) -> tuple[dict[str, str], str]:
    """Models over-use certain letters; reorder deterministically per question."""
    letters = ["A", "B", "C", "D"]
    texts = {"A": q.option_a, "B": q.option_b, "C": q.option_c, "D": q.option_d}
    correct_text = texts[q.correct_answer]
    order = list(letters)
    seed = int(hashlib.sha256(q.question.encode()).hexdigest(), 16)
    random.Random(seed).shuffle(order)
    shuffled = {new: texts[old] for new, old in zip(letters, order, strict=True)}
    correct = next(letter for letter, text in shuffled.items() if text == correct_text)
    return shuffled, correct


def finalize(state: State) -> State:
    req = state["request"]
    accepted = state.get("accepted", [])[: req.number_of_questions]
    if not accepted:
        raise InsufficientContent()

    by_id = {d.metadata["chunk_id"]: d for d in state["context"]}
    warnings = list(state.get("warnings", []))
    if len(accepted) < req.number_of_questions:
        warnings.append(
            f"Only {len(accepted)} of {req.number_of_questions} reliable questions could be "
            "generated from this material."
        )

    out: list[GeneratedQuestion] = []
    for q in accepted:
        options, correct = _shuffle_options(q)
        out.append(
            GeneratedQuestion(
                question=q.question.strip(),
                options=options,  # type: ignore[arg-type]
                correct_answer=correct,  # type: ignore[arg-type]
                explanation=q.explanation.strip(),
                source_reference=_page_label(q.source_chunk_ids, by_id),
            )
        )
    response = GenerateResponse(
        questions=out,
        warnings=warnings,
        stats=GenerateStats(
            pages=len(state["pages"]),
            chunks=len(state["chunks"]),
            retrieved_chunks=len(state["context"]),
            attempts=state.get("attempts", 0),
            requested=req.number_of_questions,
            returned=len(out),
        ),
    )
    return {"response": response}


def build_graph():
    g = StateGraph(State)
    g.add_node("load_pdf", load_pdf)
    g.add_node("chunk", chunk)
    g.add_node("index", index)
    g.add_node("retrieve", retrieve)
    g.add_node("generate", generate)
    g.add_node("validate", validate)
    g.add_node("quality_check", quality_check)
    g.add_node("finalize", finalize)

    g.add_edge(START, "load_pdf")
    g.add_edge("load_pdf", "chunk")
    g.add_edge("chunk", "index")
    g.add_edge("index", "retrieve")
    g.add_edge("retrieve", "generate")
    g.add_edge("generate", "validate")
    g.add_edge("validate", "quality_check")
    g.add_conditional_edges(
        "quality_check", _route, {"generate": "generate", "finalize": "finalize"}
    )
    g.add_edge("finalize", END)
    return g.compile()


_graph = build_graph()


def generate_quiz(req: GenerateRequest) -> GenerateResponse:
    # Trace metadata is limited to ids: no student data ever enters this service.
    final = _graph.invoke(
        {"request": req},
        config={
            "run_name": "generate_quiz",
            "tags": ["quiz-rag"],
            "metadata": {
                "course_id": req.course_id,
                "material_id": req.material_id,
                "difficulty": req.difficulty,
                "requested": req.number_of_questions,
            },
            "recursion_limit": 40,
        },
    )
    return final["response"]
