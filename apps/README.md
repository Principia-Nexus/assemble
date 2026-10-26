# apps/

The two runnable roles. The API is the only thing that reads or writes data and the only place a
permission is decided; the web client presents what the API returns and nothing more.

## Connects

| Direction | Where | Through |
|---|---|---|
| web to api | `apps/web/src/lib/api.js` | `REACT_APP_BACKEND_URL` + `/api`, httpOnly auth cookies, `X-Project-Id` for the open project |
| api to MongoDB | `apps/api/assemble/core.py` | `MONGO_URL`, `DB_NAME` |
| api to Claude | `apps/api/assemble/services/llm.py` | `ANTHROPIC_API_KEY` |
| api to email, money | `apps/api/assemble/services/mailer.py`, `apps/api/assemble/routes/billing.py` | `SMTP_*`, `STRIPE_*`, both optional |

## Change recipes

- Add an endpoint and its screen: handler in `apps/api/assemble/routes/<area>.py` (scope with
  `get_project`) -> the rule in `apps/api/assemble/domain/` if it decides anything ->
  `test_<module>.py` beside that rule -> the call and page under `apps/web/src/`.
