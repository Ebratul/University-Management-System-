# RAG quiz service

Generates multiple-choice questions from **one** course PDF. It is an internal
service: only the Node API (`backend/`) calls it, over HTTP, with a shared secret.

```
Teacher -> Node API -> (checks teacher owns the course, signs a 5-minute PDF link)
                    -> POST /generate-quiz  ->  this service
                                                load PDF -> chunk -> embed + index (FAISS)
                                                -> retrieve -> generate (LLM) -> validate
                                                -> review (LLM) -> repair loop -> questions
Teacher reviews / edits the questions -> saves a quiz -> publishes -> starts
```

Nothing is saved here or auto-published: the API returns *draft* questions.

## The workflow (LangGraph, `app/graph.py`)

`load_pdf -> chunk -> index -> retrieve -> generate -> validate -> quality_check -> (finalize | generate again)`

| Step | What it does |
|---|---|
| load_pdf | Downloads the PDF (https, allow-listed hosts only, size/page caps), extracts and cleans text per page with LangChain `PyPDFLoader`. |
| chunk | `RecursiveCharacterTextSplitter`; every chunk gets an id like `p3-c2` (page 3, chunk 2). |
| index | Embeds chunks into a FAISS index stored per **material + PDF hash + embedding model**. Unchanged PDFs reuse the index. |
| retrieve | MMR search from several angles (concepts, processes, examples, rules), filtered by `material_id` **and** `course_id` metadata. If the retrieved text is too short, it stops with "insufficient information" *before* calling the model. |
| generate | Structured output (`LLMBatch`). The model must use only the context and cite chunk ids. |
| validate | Deterministic checks: 4 distinct non-empty options, a correct answer, an explanation, a source cited **that was actually retrieved**, no near-duplicate questions. |
| quality_check | A second model pass per question: answerable from the cited context? marked answer really correct and unique? explanation consistent? Failures are dropped. |
| loop | If fewer than requested survive, generate the missing ones again, telling the model what went wrong (max `MAX_ATTEMPTS`). |
| finalize | Turns cited chunk ids into `Page N` references, reorders options deterministically (models over-use some letters), returns only valid questions. If none survive: HTTP 422 `INSUFFICIENT_CONTEXT`. |

## API

`GET /health` - no auth.

`POST /generate-quiz` - header `X-Internal-Token: $RAG_SERVICE_TOKEN`

```json
{ "document_url": "https://api.cloudinary.com/...signed...", "course_id": "<offering id>",
  "material_id": "<material id>", "number_of_questions": 10, "difficulty": "medium" }
```
```json
{ "questions": [ { "question": "...", "options": {"A":"...","B":"...","C":"...","D":"..."},
                   "correct_answer": "B", "explanation": "...", "source_reference": "Page 4" } ],
  "warnings": [], "stats": { "pages": 12, "chunks": 31, "retrieved_chunks": 12, "attempts": 1,
                             "requested": 10, "returned": 10 } }
```
Errors: `401` bad token, `400 DOCUMENT_ERROR`, `422 INSUFFICIENT_CONTEXT`, `502 GENERATION_FAILED`.

## Security

- Fails closed: with no `RAG_SERVICE_TOKEN` configured every request is 401. Compared in constant time.
- `document_url` must be `https` and on `ALLOWED_DOCUMENT_HOSTS`; every redirect hop is re-checked (no SSRF).
- Course A's PDF can never be mixed with course B's: one index per material, metadata filter on retrieval, ids restricted to `[A-Za-z0-9_-]` (they build a folder name).
- The FAISS index is loaded with pickle deserialisation, which is only safe because **only this service writes `INDEX_DIR`**. Keep it a private volume.
- No student data is ever sent here; LangSmith traces carry only course/material ids.
- Do not expose this service publicly. The compose file does not publish its port.

## Run locally

```bash
cd rag-service
cp .env.example .env            # fill OPENROUTER_API_KEY, RAG_SERVICE_TOKEN, LANGSMITH_API_KEY
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --port 8000
pytest                          # uses fake LLM/embeddings; no API key or network needed
```

Backend `.env`: `RAG_SERVICE_URL=http://localhost:8000` and the **same** `RAG_SERVICE_TOKEN`.

### Docker

```bash
cd backend && docker compose up --build   # starts postgres, redis, the API and this service
# or just this service:
cd rag-service && docker build -t ums-rag . && docker run --rm -p 8000:8000 --env-file .env ums-rag
```

## Observability (LangSmith)

Set `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT` (the older
`LANGCHAIN_TRACING_V2` / `LANGCHAIN_API_KEY` / `LANGCHAIN_PROJECT` also work).
Each request is one `generate_quiz` run with a span per graph node, retrieval,
and each model call, tagged `quiz-rag`.

## Known limits

- Generation is synchronous and can take a minute; the Node client waits up to
  `RAG_SERVICE_TIMEOUT_MS` (default 120 s). Vercel functions may time out sooner
  than that, so the API should run on a host with longer request limits when AI
  generation is used.
- Scanned (image-only) PDFs have no extractable text and are reported as insufficient.
- The model-facing calls (`ChatOpenAI` / `OpenAIEmbeddings` pointed at OpenRouter) are
  covered by tests only through fakes; try a real key before relying on a given model.
