# apps/api/

The FastAPI app behind `/api`: auth, projects and plans, partner reviews, quotes, document
reading and the assistant. It owns every read and write of MongoDB and every permission decision.
Run it with `uvicorn assemble.main:app` from this directory; configuration is `.env` (template
`.env.example`).

## Connects

| Direction | Where | Through |
|---|---|---|
| in | `apps/web` | `assemble/main.py`: CORS from `CORS_ORIGINS`, the origin guard on every write, `X-Project-Id` into `core.PROJECT_CTX` |
| out | `assemble/routes/` | one router per area, registered in `assemble/main.py` |
| out | `assemble/domain/` | plan validation, generation and checking; partner states; licence fit |
| out | `assemble/services/` | Claude, email, file storage, OCR |
| out | `assemble/demo/` | the per-visitor synthetic sandbox and its canonical data |
| out | `pytest.ini` | `pytest` collects `test_*.py` under `assemble/` with this directory on the path |

| File | What it is |
|---|---|
| `assemble/main.py` | the app: routers, origin guard (CSRF), CORS, indexes and fixtures on startup |
| `assemble/core.py` | db client, tokens and `current_user`, firm scoping, the event log |
| `requirements.txt` | runtime dependencies |
