from langchain_core.documents import Document

GENERATE_SYSTEM = """You are generating university-level multiple-choice questions from the provided retrieved source material.

Rules:
- Use ONLY the provided context. Do not use outside knowledge.
- Every question must be answerable from the context alone.
- Generate exactly four options (option_a to option_d). Only one option is correct.
- The three wrong options must be plausible but clearly incorrect according to the context.
- Do not make options that are near-duplicates of each other.
- Give a concise explanation (1-2 sentences) grounded in the context. Do not mention option letters in the explanation.
- In source_chunk_ids list the id(s) of the context chunk(s) you used, exactly as written in the square brackets (e.g. p3-c2).
- Never invent facts, numbers, names or definitions that are not in the context.
- If the context does not contain enough information for a reliable question, return fewer questions (or none). Do not fill the quota with guesses.
- Cover different parts of the context; do not ask the same thing twice."""

DIFFICULTY_HINT = {
    "easy": "Easy: direct recall of definitions and explicit facts.",
    "medium": "Medium: understanding and applying concepts, or distinguishing related ideas.",
    "hard": "Hard: reasoning across several statements in the context, comparisons, or multi-step application.",
}

JUDGE_SYSTEM = """You are a strict reviewer of multiple-choice questions. For each question you are given the question, its options, the proposed correct answer, the explanation, and the source context it should come from.

For each question decide, using ONLY the given context:
- answerable_from_context: the context contains the information needed to answer it.
- correct_answer_is_right: the marked correct option is actually correct per the context, and no other option is also correct.
- explanation_consistent: the explanation supports the marked answer and does not contradict the context.
Give a short reason when any check fails. Return one verdict per question using its index."""


def format_context(chunks: list[Document]) -> str:
    return "\n\n".join(
        f"[{c.metadata['chunk_id']}] (page {c.metadata['page']})\n{c.page_content}" for c in chunks
    )


def generate_user_prompt(
    *,
    context: str,
    count: int,
    difficulty: str,
    existing: list[str],
    feedback: list[str],
) -> str:
    parts = [
        f"Generate {count} multiple-choice question(s).",
        f"Difficulty: {DIFFICULTY_HINT[difficulty]}",
    ]
    if existing:
        parts.append(
            "Questions already accepted (do not repeat or rephrase these):\n"
            + "\n".join(f"- {q}" for q in existing)
        )
    if feedback:
        parts.append(
            "Problems with the previous attempt (avoid them):\n"
            + "\n".join(f"- {f}" for f in feedback[-8:])
        )
    parts.append(f"Context:\n\n{context}")
    return "\n\n".join(parts)


def judge_user_prompt(items: list[dict]) -> str:
    blocks = []
    for item in items:
        blocks.append(
            f"Question index: {item['index']}\n"
            f"Question: {item['question']}\n"
            f"A. {item['A']}\nB. {item['B']}\nC. {item['C']}\nD. {item['D']}\n"
            f"Proposed correct answer: {item['correct']}\n"
            f"Explanation: {item['explanation']}\n"
            f"Source context:\n{item['context']}"
        )
    return "\n\n-----\n\n".join(blocks)
