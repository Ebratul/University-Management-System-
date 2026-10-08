import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Difficulty = Literal["easy", "medium", "hard"]
Choice = Literal["A", "B", "C", "D"]

# Used to build a filesystem path for the index cache: no separators allowed.
_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


# ------------------------------- HTTP API -----------------------------------
class GenerateRequest(BaseModel):
    document_url: str = Field(min_length=8, max_length=4096)
    course_id: str
    material_id: str
    number_of_questions: int = Field(10, ge=1, le=30)
    difficulty: Difficulty = "medium"

    @field_validator("course_id", "material_id")
    @classmethod
    def _safe_id(cls, value: str) -> str:
        if not _SAFE_ID.match(value):
            raise ValueError("must be 1-64 characters: letters, digits, '-' or '_'")
        return value


class GeneratedQuestion(BaseModel):
    question: str
    options: dict[Choice, str]
    correct_answer: Choice
    explanation: str
    source_reference: str


class GenerateStats(BaseModel):
    pages: int
    chunks: int
    retrieved_chunks: int
    attempts: int
    requested: int
    returned: int


class GenerateResponse(BaseModel):
    questions: list[GeneratedQuestion]
    warnings: list[str] = []
    stats: GenerateStats


# ----------------------- what the LLM is asked to produce -------------------
class LLMQuestion(BaseModel):
    question: str = Field(description="The question stem. Must be answerable from the context.")
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: Choice = Field(description="Letter of the single correct option.")
    explanation: str = Field(
        description="One or two sentences justifying the answer from the context. "
        "Do not mention option letters."
    )
    source_chunk_ids: list[str] = Field(
        description="ids of the context chunks (e.g. 'p3-c2') the question is based on."
    )


class LLMBatch(BaseModel):
    questions: list[LLMQuestion]


class LLMVerdict(BaseModel):
    index: int = Field(description="Index of the question in the list that was reviewed.")
    answerable_from_context: bool
    correct_answer_is_right: bool
    explanation_consistent: bool
    reason: str = ""


class LLMVerdicts(BaseModel):
    verdicts: list[LLMVerdict]
