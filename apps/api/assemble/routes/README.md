# apps/api/assemble/routes/

HTTP handlers, one router per area. A handler authenticates (`current_user`), scopes
(`projects.get_project` for organizers, the link for partners, the token for customers), calls
`domain/` for every decision, and writes. No business rule lives only here.

| File | What it is |
|---|---|
| `auth.py` | register, login (incl. demo), email verification, logout |
| `projects.py` | projects, intake, plan drafts and selection, review links, change requests |
| `items.py` | workspace items and edges behind the graph, list and calendar |
| `review.py` | the partner side of a review link: terms, responses |
| `quotes.py` | customer quotes: issue, verification code, accept, amendments, Q&A |
| `extract.py` | document upload, reading with Claude, applying readings |
| `assistant.py` | the workspace assistant: read, explain, propose, advance |
| `media.py` | voice input and site photos |
| `billing.py` | the Stripe pilot paywall; off when `STRIPE_SECRET_KEY` is unset |
| `qualifications.py` | licence and insurance evidence per firm |

## Change recipes

- Add a route: handler here with `Depends(current_user)` and `get_project` -> the rule in
  `domain/` with a `test_<module>.py` beside it -> register a new router in `assemble/main.py`.
