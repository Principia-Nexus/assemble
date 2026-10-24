# Assemble, powered by Fabric — PRD

## Original problem
"review the linear plan for Assemble, lets build it out. Linear has instructions." Source: Linear project "VibeCon SF: Assemble" (ASMBL-1..12). The approved plan is followed in full.

## Users
- Organizer: commercial electrical contractor with one job that is too large to do alone.
- Partner firms: each one reviews only their own part.
- Judges and viewers: use labeled synthetic demo accounts.

## Architecture
- FastAPI (`server.py`, `core.py` for auth/db, `logic.py` for validation/generator/checker/diff, `state.py` for partner statuses, `demo.py` for the synthetic sandbox, plus `auth_routes`, `project_routes` and `review_routes`) and MongoDB.
- React: Login, ProjectSheet (a 4-task stepper), Review (partner), MyReviews, and components/sheet/*.
- Auth: JWT email/password (httpOnly cookies + refresh), Emergent Google (session_token), and demo logins (shared password, isolated by visitor_id).
- Concurrency: a project `rev` optimistic lock, partner responses tied to version_id + terms_hash, and an idempotency key on responses.

## Implemented (Phase 1, 2026-06)
- Sign-in (Google / email+password / demo), firm membership, server-checked access, link bound to the invite email, forwarded-link 403, Origin guard, login lockout.
- Intake form with strict validation (no silent adjustment), unknowns, and a provisional gap analysis.
- Greedy candidate generator with an explicit checker (capacity, crew-week, deadlines, owner, quoted limits, ceiling, conditions) and honest "incomplete search" wording.
- Private review links (creating one is not the same as sending it; organizer marks them as shared), partner confirm / conditional / request change / decline.
- Customer and partner change requests stored separately; amendment preview with diff, editor, discard, select; selective carry-over.
- History drawer, per-visitor demo reset.
- Canonical numbers verified: 156k fail (weeks 1 and 2), 168k pass at 4/4/4, 6/4/2 with a 2-slot gap, 172k Dogwood repair, 186k stress fail.

## Implemented (Phase 2 + 3, 2026-06)
- AI document reading (Claude Sonnet 5.5, `claude-sonnet-5-5` via EMERGENT_LLM_KEY) in `extract_routes.py`. Paste text or choose a text file (.txt/.md/.eml/.csv). Each fact gets a verbatim excerpt plus a verified line. A crew-size guard is applied. The latest dated source wins, with conflicts shown. Instructions inside documents are ignored and logged. Corrections keep the original, prior value, editor and time, and survive re-reads. "Use selected readings" updates the intake and recalculates the candidate (as a preview if links exist). Failures keep the input and offer a retry.
- Synthetic sample docs (brief, Redwood quote, Redwood "week three only" email with an injection line) in `frontend/src/lib/samples.js`.
- Organizer-only printable summary at /summary (browser print).
- Acceptance record: /app/memory/ACCEPTANCE.md. Deployed URL is NOT RUN until the app is published.

## Backlog
- Publish, then re-run the acceptance checks on the live URL.
- PDF text extraction (currently: paste the text yourself).
- Optional: email delivery of review links (organizers share them manually by design).
