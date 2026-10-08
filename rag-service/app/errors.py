INSUFFICIENT_MESSAGE = (
    "Insufficient information in the provided material to generate a reliable question."
)


class RagError(Exception):
    """Base class: carries an HTTP status and a stable machine-readable code."""

    status_code = 500
    code = "RAG_ERROR"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class DocumentError(RagError):
    """The PDF could not be fetched or read."""

    status_code = 400
    code = "DOCUMENT_ERROR"


class InsufficientContent(RagError):
    """The material does not contain enough information for reliable questions."""

    status_code = 422
    code = "INSUFFICIENT_CONTEXT"

    def __init__(self, message: str = INSUFFICIENT_MESSAGE):
        super().__init__(message)


class GenerationFailed(RagError):
    """The model failed or kept producing unusable output."""

    status_code = 502
    code = "GENERATION_FAILED"
