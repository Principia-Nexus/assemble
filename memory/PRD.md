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
- Typed PDF upload (2026-06): pypdf text per page with [Page N] markers, page+line fact locations, original stored in Emergent Object Storage (`storage.py`, `db.files`), organizer-only download, scanned/non-PDF/oversize refused with 422. Synthetic sample PDF at GET /api/project/sample-pdf (`pdf_sample.py`).

## Implemented (2026-06, round 5)
- OCR for scanned PDFs (PyMuPDF render + Claude Sonnet 5.5 vision transcription, flagged ocr=true, max 8 pages).
- Drag-and-drop of PDF/text files onto Read a document.
- 9-step guided demo tour (Show me / Do it for me, minimize).
- Demo data moved to MongoDB: fixtures/*.json -> `fixtures` collection; seed_fixtures.py for any DB; /api/project/demo-content serves documents, PDF quote meta, customer change and tour.

## Copy cleanup (2026-06, round 6)
- Removed yellow Synthetic tags/banners everywhere; demo tour + reset now in a plain toolbar (data-testid demo-toolbar).
- Removed the practice-login explainer line; practice logins hidden on the Create account tab.
- "(Synthetic)" is removed from names by the frontend API layer (lib/api.js), except on /auth/demo-accounts (login page only). Removed the "Project sheet · customer" eyebrow.


## Clarity + workspace round (2026-06, round 8)
- Theme: white, black text, Avorant navy #1A2838 accent; matched green #1E7B5C / red #A93A3A; lowercase mono labels; clean CSS animations (stagger, panel fades, sliding tab pill, smooth partner drop-down; reduced-motion respected).
- Login: logo larger, "Organizer" (Synthetic example) + "Partner" drop-down.
- PlanStrip (components/sheet/PlanStrip.jsx + lib/planState.js): scoped result, total vs ceiling, responses, open conditions, one derived Next action button on every step.
- Checker: failures/open conditions first, passes collapsed; conditions rule shows "N open" amber. Draft blocks generation while a preview is open (Open preview button). Amendment: "Proposed changes", changed vs already-awaiting partners, full editor under Edit details. Partner cards state-specific history text. Readings: applied collapsed; legacy job conditions migrated on load. Tour state note. Summary leads with Decision + Outstanding work.
- Tests: iteration_9 all features pass; 6 minor follow-ups fixed afterwards (not re-run by testing agent).
- Pending user decision: Claude extra uses, Jev classification, Resend email, Stripe (user said "not yet, wait").

## Handoff round (2026-06, round 7) — from emergent-master-handoff.md
- Checker: new "payments" rule (negative partner totals fail); server rejects adjustments that make a total negative (max discount message).
- Selection: preview Select disabled while edits are unsaved or preview fails; dialog shows version, total, delta, partners to re-review; server checks expected_version_id and refuses failing previews.
- Review links blocked (server 409 + UI notice) while the current plan fails; stepper keeps "Prepare a draft" as next step.
- Job-wide conditions: intake.job_conditions (edit/resolve in Check this job), extracted "conditions" without a partner become applicable Job condition readings; shown in gap panel, checker, Decide and Summary. Partners never see them.
- Decide: summary strip (schedule fits / budget / confirmed / unresolved) and Next banner leads with open conditions; carried confirmations keep original responded_at.
- Progress: "Ask" done once partners responded (no shared marker needed). Historic change requests from firms no longer in the plan are marked inapplicable (server 409).
- Login: "Check the job. Agree the plan." + Try the example; partner logins behind "Review as a partner"; role-aware next redirects; partner on organizer routes gets header + Go to my reviews.
- Readings: identical values across sources = corroborated (not conflict); attention-first order; site deadline facts grouped; sticky action bar; evidence in disclosure; sample-PDF preparing state; reader model/prompt_version stored on each source.
- Tour opt-in (not auto-open); shortcuts state-aware; select shortcut routes to the normal dialog.
- Copy removals per user (headroom disclaimer, greedy-pass fail note, draft lead, reviews intro, login subline).
- Tests: backend 67 pass (new tests/test_handoff_rules.py); iteration_6 all 12 flows pass.
- NOT done: full Jextaa-style workspace re-layout, 3x-per-case fresh-extraction consistency eval, field-adjacent validation messages, deployment/live acceptance.


- Publish, then re-run the acceptance checks on the live URL.
- OCR for scanned PDFs (currently refused with a clear message).
- Optional: email delivery of review links (organizers share them manually by design).

## Backlog
- Workspace re-layout (contextual right panel per step)
- Extraction consistency eval (6 cases x 3 runs)
- Field-adjacent validation errors
- Publish + live acceptance run
