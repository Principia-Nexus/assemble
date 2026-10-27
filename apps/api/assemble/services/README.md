# apps/api/assemble/services/

Everything that leaves the process. Each file is the one place its service is called.

## Connects

| Direction | Where | Through |
|---|---|---|
| out | Claude | `llm.py`: `Chat(system).send(text, images)`, model `CLAUDE_MODEL` (default `claude-sonnet-5-5`), server-side refusal fallback |
| out | SMTP | `mailer.py`: every email passes `_assert_safe_email`; without `SMTP_HOST` it is logged, not sent |
| out | disk | `storage.py`: `put_object` / `get_object` under `STORAGE_DIR`; a path that escapes it is refused |
| out | Claude (vision) | `ocr.py`: scanned PDF pages rendered with PyMuPDF and transcribed through `llm.py` |
