import re
from dataclasses import dataclass

from app.schemas import LLMQuestion

_WORDS = re.compile(r"[a-z0-9]+")


def _norm(text: str) -> str:
    return " ".join(_WORDS.findall(text.lower()))


def _similar(a: str, b: str) -> bool:
    """Cheap near-duplicate test on word sets (Jaccard >= 0.8)."""
    sa, sb = set(_norm(a).split()), set(_norm(b).split())
    if not sa or not sb:
        return False
    return len(sa & sb) / len(sa | sb) >= 0.8


@dataclass
class Checked:
    question: LLMQuestion | None
    reason: str | None


def check_question(
    q: LLMQuestion,
    *,
    retrieved_ids: set[str],
    accepted_stems: list[str],
) -> Checked:
    """Deterministic structure/grounding checks, run before any LLM review."""
    stem = q.question.strip()
    options = [q.option_a, q.option_b, q.option_c, q.option_d]
    label = f'"{stem[:60]}"'

    if len(stem) < 10:
        return Checked(None, f"{label}: question is too short")
    if any(not o.strip() for o in options):
        return Checked(None, f"{label}: an option is empty")
    if len({_norm(o) for o in options}) != 4:
        return Checked(None, f"{label}: options are not four different answers")
    if not q.explanation.strip():
        return Checked(None, f"{label}: missing explanation")
    cited = [c for c in q.source_chunk_ids if c]
    if not cited:
        return Checked(None, f"{label}: no source chunk cited")
    unknown = [c for c in cited if c not in retrieved_ids]
    if unknown:
        # The model cited something that was never in its context: it is
        # making things up or mixing sources, so the question is dropped.
        return Checked(None, f"{label}: cites unknown source {unknown[0]}")
    if any(_similar(stem, other) for other in accepted_stems):
        return Checked(None, f"{label}: duplicates another question")

    return Checked(q, None)
