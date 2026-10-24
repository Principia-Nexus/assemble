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

## Backlog
- P1 (Phase 2): AI extraction of brief/quote/email (Claude Sonnet 5.5 via universal key), with source excerpts and an organizer correction trail.
- P2 (Phase 3): printable dated organizer summary; acceptance run on the deployed URL; UI simplification pass.
