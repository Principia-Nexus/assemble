# Assemble, powered by Fabric — PRD

> Historical record of the Emergent build (2026-06 to 2026-10). Emergent, Google sign-in and the evidence graph are gone;
> the code and `AGENTS.md` are authoritative where this differs.


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
- AI document reading (Claude Sonnet 5.5, `claude-sonnet-5-5` through the Anthropic SDK, `services/llm.py`) in `routes/extract.py`. Paste text or choose a text file (.txt/.md/.eml/.csv). Each fact gets a verbatim excerpt plus a verified line. A crew-size guard is applied. The latest dated source wins, with conflicts shown. Instructions inside documents are ignored and logged. Corrections keep the original, prior value, editor and time, and survive re-reads. "Use selected readings" updates the intake through the form validator and keeps the current plan, flagging it for a redraft. Failures keep the input and offer a retry.
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

## Billing + sign-in round (2026-10-25)
- Email-first login (big centered "Enter email"; known email -> password; new email -> name/firm/password); Google sign-in kept. Uniform 16px spacing; larger logo.
- $99 one-time Stripe SANDBOX checkout -> server-verified activation (firms.pilot_active). No expiry/renewal (user decision). Tax-safe check (amount_subtotal). Webhook returns 503 until a real whsec_ secret exists; activation verified on success page and /billing/access via Checkout Session retrieve. Open-redirect fix; check-email throttle 30/10min/IP.

## Projects round (2026-10-25)
- /projects list (name, customer, factual status, last edited) + New project dialog (request_key dedupe). /projects/:id workspace, /projects/:id/summary; /project,/summary redirect.
- Server picks project via X-Project-Id header (PROJECT_CTX contextvar) and always re-checks firm ownership (404 otherwise).
- Demo sandbox seeds 3 examples once: canonical 12-branch, Six-store (Willow Retail), Warehouse (Northbank, Harbor quote missing -> Needs information). "Reset this example" resets only the open example in place.
- Project bar (back arrow + switcher) removed per user; header has Projects link; unsaved-edit guard on navigation.

## Core workflow round (2026-10-25)
- Site facts match by id or name; new names get stable ids (e.g. NORTH-STORE); date deadlines -> week numbers; re-apply doesn't duplicate. Gap panel says shortages can't be checked with 0 sites.
- Review page shows job-wide conditions (resolved/unresolved, source); labeled inputs; specific submit labels.
- Amendment diff explains "why" each partner must review (term_reasons) and shows site names + dates.
- Clutter removed: Task X of 4, duplicate titles, Go-to buttons, Next eyebrow; specific action labels (Check draft, Request review, Export summary); step persisted per project.
- Invite rows full width, recipient visible, no raw URL; Email invitation (Emergent managed Resend, preview + deliberate Send; .test/.example blocked; copy-link fallback). Verified to delivered@resend.dev only; real team-inbox test pending.
- Summary: site names + week-of dates, "Print / save PDF".

## Stage 1-3 round (2026-10-25)
- Stage 1: exact CORS (no reflection), origin guard; logout revokes access/refresh tokens (tokens_valid_after); invite claim needs verified email (6-digit code via email); response save atomic vs selection (409, nothing saved); Stripe test-mode enforced (livemode rejected); PostHog session replay off + review-token URL scrub; tour no longer marks links shared; Synthetic badge on title/review/print; "Passes recorded checks"; intake 409 keeps typed edits.
- Stage 2 (shell only): ≥1100px left rail (Check/Draft/Invite/Decide with counts) + center + right column (facts labelled Current review / Private draft + Assistant); <1100 stepper + Assistant drawer.
- Stage 3: bounded assistant (POST/GET /api/project/assistant, claude-sonnet-5-5): explain (no writes), revise (private draft only via existing preview commands, stale-rev 409, failed revise discards opened draft), intake (user clicks "Read it as a source"), question. Retry once for JSON; prose → explain. Jev measured (~1.6s, correct tags) then REMOVED per user.
- Real email to chosenvictor12@gmail.com accepted by provider (202); inbox receipt unconfirmed.
- UI removals per user: assistant subtitle/placeholder, "Fix these first:", "total against ceiling", "responses to these terms".

## Wording + graph round (2026-10-25)
- Invite email cut to subject "Review your terms: <job>", one sentence, "Open review" button, "Opens only for this email address." Code email cut too.
- Map (Stage 2 graph): GET /api/project/graph (authorized) → bands Sources → Changes (applied facts grouped per source+entity, open customer changes, private-draft moves) → Sites → Firms; SVG curves; click node highlights its trace. Hidden when no edges and below md.
- Draft: firm toggle buttons (aria-pressed) in a "Firms" card with "Check draft" in its header; removed many explanatory lines/version labels; read form sample buttons removed, inputs aligned, "Date".
- Jev removed from assistant.
- PUT /project/preview keeps deadline when omitted.

## Backlog
- Confirm the test invitation arrived at chosenvictor12@gmail.com, then do the second-device partner response (register, verify code, respond)
- Stage 2 full graph (bands + connectors, source→change→firm trace); current build ships the 3-column shell
- Delivery-event tracking (delivered/bounced) — managed email gives "accepted" only
- Publish + live acceptance run (needs user approval); 502 diagnosis needs deploy logs
- Real email delivery test to a team inbox (user to supply)
- Side AI editor (deferred)
- Publish + live acceptance run (needs user approval)
- Collapse long intake detail for returning users; shadcn date pickers
- Extraction consistency eval

## 2026-06 — Sites table fits without horizontal scroll (fixed layout, narrow ID/Due wk columns); Scope summary textarea non-resizable.

## 2026-06 — Sign-in page: dots scattered across the page converge into the Assemble wordmark (20% larger), replay on hover/tap; Invite step lead sentence removed. Engine: frontend/src/lib/dotsEngine.js (adapted from user-supplied assemble-dots.html), component LogoDots.jsx.

## 2026-06 — Dots animation desktop-only (static logo on phones/touch); scattered hold lengthened to ~1.4s, field spans full viewport edge to edge.

## 2026-06 — Dots: deferred init (no strict-mode double start), capped frame clock (no skipping), dot layout cached in localStorage (init 300ms→33ms on return), whole animation ~1s slower.

## 2026-06 — Dots timing knobs: TUNING {fadeIn, scatter, flight, spread} at top of frontend/src/lib/dotsEngine.js.

## 2026-06 — No blank screen at launch: index.html paints static boot dots (#boot-dots) instantly on / and /login (desktop), cross-fades into live engine; "/" renders Login directly instead of a Loading screen.

## 2026-06 — Fixed logo drawn over form after layout change: once formed, canvas clears and an in-page SVG wordmark (same glyphs) takes over. Removed "No account yet..." register notice.

## 2026-10-25 — "One AI workspace → accepted quote" brief (stages 1–3)
User overrides: keep original Assemble colours/fonts and AppHeader top bar; no left rail; view switch + controls top-right of project bar; bottom chat bar; no "by assistant", no sparkle.
- Stage 1 workspace (frontend/src/pages/ProjectSheet.jsx, components/ws/*): Graph (frames, cards, explicit relationship lines, zoom/fit, Space-drag), List (inline edit), Week (dated/provisional/unscheduled), Report (print), filter, Show changes, one inspector, ToolSheet for old Check/Draft/Invite/Decide editors + Customer quote. Backend items_routes.py: typed items (group/task/milestone/ai_task/condition) + edges, validated rev-guarded batches with inverse → Undo; acyclic prerequisites; restore only via undo. Assistant compose mode writes through same path (receipt Undo/Show changes).
- Stage 2 customer quote (quote_routes.py, QuotePanel.jsx, /quote/:token QuoteReview.jsx): draft → preview digest → issue immutable snapshot → copy link / email (Resend) → customer 6-digit emailed code (synthetic .test shows code on screen) → accept (name+intent) / decline / request changes, one guarded transition, idempotent key, expiry server-time (UTC Z), replacement supersedes, amendment keeps accepted baseline.
- Stage 3 inputs (media_routes.py): Whisper voice → transcript placed in composer for review (utterance id attributed, no-speech filtered); Claude sonnet-5-5 photo observations with regions/unknowns, stored in object storage.
- Tests: iteration_17/18 reports; backend 21/21 new + 95 regression pass.

## 2026-06 — Removed guided tour (button, menu item, DemoTour component). Removed duplicate 'Print report' from project ⋯ menu (Report view has Print/PDF). Week view hides Unscheduled when empty.
- Composer Add menu trimmed to the 4 work-item types only (details/source/checks/review/quote already in ⋯ menu or paperclip).

## 2026-10-25 — Founder brief Round 1 (iteration_19: backend 132/132; frontend core flows pass, follow-up fixes applied)
- Chat composer floats over the canvas (no band), clears on send; server-backed AI runs (queued/working/committing/draft_ready/needs_input/failed/stopped), Stop, one run per project, 409 auto-rebase + items reload.
- AI modes: advance (solver draft → checks → private review links, never sent), intake (chat text → attributed source → reader → apply facts), money args normalized; AI snapshot includes saved sources/readings/firm responses.
- Rule packs: backend/rule_packs/{core,capabilities,profiles}.json from both appendices; selection recorded per run (meta.packs) and per source read; checker version in Report footer.
- PDF page manifest/coverage per page (readable/partial/unreadable/uninspected), OCR only low-text pages (≤8), 40k char budget marks rest uninspected.
- Quote issue requires confirmed support from every assigned firm (no override). Amendments seed from accepted snapshot. Customer quote assistant (/api/quote/{token}/ask) on released snapshot only, can draft change request.
- Graph: bounded pan, draggable cards (PUT /api/project/layout), drag-to-link with relationship menu. Always opens in Graph.
- Primary action top-right (Draft plan → Review draft → Send for review → Awaiting <firm> → Customer quote) + Quote button; ⋯ only Reset example; title click = Job details; Highlight changes removed; synthetic badges removed outside projects list.
- Calendar: month/week, weekly firm bars, grouped deadlines, no Unscheduled tray. Schedule grid stacked on mobile.
### Round 2 (next): requirement/licence constraints per scope (C-10/C-33/C-39 acceptance), rapid-edit merge + two-tab conflicts, isolated-session partner access repro, job exclusions independent of partners, larger PDF page batches/page ranges, publish + repeat full journey on public URL, true 200% zoom check.

## 2026-10-25 — Plan is source of truth for site tasks (iteration_20 pass)
- withPlan() overlays plan owner/week on tasks tied to one planned site; Inspector firm change → POST /api/project/plan/assign (opens/edits private draft, validated before draft creation). Calendar no longer duplicates site tasks.
- Firm colour system (FIRM_TONES in derive.js); left card ribbons removed; Example/Synthetic labels removed everywhere.
- Partner page: "From <firm>", "Confirm", no organizer-only status badges, demo role-switch buttons removed.

## 2026-10-25 — Dependable workflow: iteration_23 deviations closed (iterations 24–25 testing-agent PASS; backend 187/187)
- Chat/reader job-wide exclusions (no firm named) → scope "job_exclusion" → saved in project.exclusions with source; shown in Exclusions list (with "from <source>") and in the quote preview and customer snapshot.
- Licence statements in firm conditions → requirement doc-<code>-<partner_id> (Required by source, not dismissable, applies only to that firm's sites); suppresses sug-<code>; licence-only conditions are tracked as requirements, not as duplicate open conditions (qualify.tracked). Sourced requirements carry the page number.
- Customer snapshot scrubs firm names, short names, first words and emails → "the subcontractor" (quote_routes.firm_aliases).
- Evidence: observed_on in the future → 422; UI max = Pacific date. Assistant snapshot includes qualification by site, requirements and evidence; plain wording, $ amounts.
- UI: tray 28vh, translucent blur, scrolls inside, collapses on graph pointerdown; mobile zoom controls no longer overlap the Plan count; "Open items" naming; Inspector kicker per kind; receipts say "accepted"; shadcn Selects in QualPanel; Sign out icon below 400px.
- Clean recording copy: workspace ⋯ → "Make a clean copy" (12-branch fixture only) → POST /api/project/clean-copy creates "<job> · recording copy" (tagged "Recording copy"); originals untouched; copies cannot be re-copied.
- Matrix (preview build https://assemble-app-1.preview.emergentagent.com): fresh full path PASS; Gates 1–5 PASS (Gate 3 after redaction fix); 200% zoom, 320/390px PASS; Publish/production NOT RUN (not authorized).
### Backlog
- P1: shadcn date pickers for quote valid-until / evidence dates; 320px frame-title wrapping next to zoom controls.
- P2: CSLB lookup, scope splitting, drawing/spec conflict detection (not built); publish + repeat journey on public URL (needs approval).

## 2026-10-25 — Fresh-Project Completion Repairs (Phase 1) — preview verified
- Reader: access windows (site_access_start/end) → start date, weeks, earliest week + deadline per site (logic.derive_from_access); dates without a year become one "Year?" open item → POST /api/project/readings/year applies to all; customer_payment_terms, coordination, contingency fields; brief scope "at each branch" fills empty site scopes; undated sources rank below dated; "Proposed by X" rejected as a site scope; partner conditions add instead of overwrite; job conditions keep their sites (partners only see conditions for their sites or unlabelled shared ones).
- Checker: cost lines in totals ("Firms + coordination + contingency"), unknown price → total incomplete; unassigned site fails "Every site scheduled in exactly one week" unless deliberately narrowed (keep_open / scope exclusion); new "Site access" rule → Access conflict blocks select, links and quote issue.
- Quote: prefilled timing + customer payment terms, price always blank; partner response conditions reach the issue gate; decisions Put in offer / Resolved / Exclude, saved in order with Saving/Retry, aria-pressed + check; resolved/excluded conditions leave the customer Conditions list.
- UI: package cards "Confirmed for vN" / "Needs review vN"; List/Report firm names; Report Internal cost; Review as partner (example projects) + Back to organizer; wrong-account review → sign in returning to the invite; task edits serialized (useItems queue), date range validated (UI + API); schedule table scrolls with sticky site column; header aria-labels; numeric week sort.
- Evidence: backend/tests/run_fresh.py (fresh_flow.py + fresh_flow2.py) on canonical docs tests/fresh_fixture_docs.json: $168,000 baseline / $12,000 headroom, Q1 accepted, v3 Dogwood change $172,000 / $8,000; fresh_access_gate.py; test_iter27 (7); full suite 194 passed; iteration_26.json frontend pass.
- Not done: hiding older conditions satisfied by an exact response; removing repeated Edit plan/run-checks controls; real email delivery (Phase 2); export/200% zoom + rehearsal (Phase 3).

## 2026-06 — Finish the Demo (fork session)
- Fixed regressions: chat "capacity N per week" (no week) now fills every week (extract_routes every_week); quote line-items fall back to scope summary/job name.
- Demo E2E working (agent + testing agent iteration_27, test_iter28_demo_e2e.py 11/11): assistant demo setup → draft → evidence → select → scoped partner confirm (.test, no email) → quote with per-site line items + Demo tag → customer code accept → amendment accept → Print/PDF.
- Fixed: solver respects partner max_sites; a new offer replaces an open issued offer; base offer cannot be accepted when another is accepted; amendments carry condition decisions; line items scrubbed of firm names/emails; stale "stays in force" banner hidden after acceptance; demo prompt uses fixture firm names, flat price, "N sites per week", payer, scope summary, own crew capacity.
- Full backend suite: 205 passed (agent-run).
- Not done this round: Hesperia 29-page bid demo, revision merge rules, small UI fixes (invite return, 200% zoom dock, login tab, $99 link), public URL repeat checks.
- 2026-06: Published to https://assemble-app-1.emergent.host. Live checks: test_iter28_demo_e2e + test_iter24_phase1_paths = 30/30 passed against live URL (API level; live UI not re-screenshotted).
