import logging
import secrets

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.errors import RagError
from app.graph import generate_quiz
from app.schemas import GenerateRequest, GenerateResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("rag")

app = FastAPI(title="UMS quiz RAG service", docs_url=None, redoc_url=None, openapi_url=None)


def require_internal_token(x_internal_token: str = Header(default="")) -> None:
    expected = get_settings().rag_service_token
    # Fail closed: a service started without a token accepts nothing.
    if not expected or not secrets.compare_digest(x_internal_token, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.exception_handler(RagError)
async def rag_error_handler(_: Request, exc: RagError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code, content={"code": exc.code, "message": exc.message}
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# A plain `def` endpoint: FastAPI runs it in a worker thread, so the blocking
# download / embedding / LLM calls do not stall the event loop.
@app.post("/generate-quiz", response_model=GenerateResponse, dependencies=[Depends(require_internal_token)])
def generate(request: GenerateRequest) -> GenerateResponse:
    log.info(
        "generate-quiz course=%s material=%s n=%s difficulty=%s",
        request.course_id,
        request.material_id,
        request.number_of_questions,
        request.difficulty,
    )
    return generate_quiz(request)
