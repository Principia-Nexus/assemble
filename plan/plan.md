# Assemble, powered by Fabric

Assemble helps an organizer and a few trusted partner businesses decide whether one larger job works on the terms currently proposed.
The organizer checks one job and prepares a draft plan. Each partner reviews only their own part in private. The organizer then decides what to do next, and an independent checker shows what fits and what does not.

Source: the Linear project "VibeCon SF: Assemble" and issues ASMBL-1 to ASMBL-12. The linked GitHub docs (workflow, prompt pack, acceptance, fixtures) are private and couldn't be read, so this plan relies on the Linear text alone.

## Who it's for
- **Organizer**: a commercial electrical contractor with an existing customer and a job too large to do alone, such as twelve branch retrofits over three weeks.
- **Partner firms**: trusted businesses that each review and respond to their own share of the job and nothing else.
- **VibeCon judges and viewers**: they use labeled synthetic demo accounts to try the full workflow on the live site.

## Core features and experience
Four tasks, always shown as one current task with one main action:

1. **Check this job**
   - Paste the brief or fill in a short manual form: sites, dates, scope, budget ceiling, the organizer's own crew capacity for those dates, and known partner details.
   - A provisional gap analysis appears before any partner signs up.
   - Missing scope, dates, prices, conditions or prerequisites stay visible as "unknown". The app never guesses them.
   - Invalid dates, counts or currency are rejected with a clear message. They are never silently adjusted.
2. **Prepare a draft**
   - A candidate schedule is generated, then an explicit checker tests it: weekly capacity, one indivisible crew-week per site, each site's deadline, exactly one scope owner per site, quoted limits, total cost against the ceiling, and stated payment or prerequisite conditions.
   - The checker's result always overrides any written explanation.
   - A failed candidate never leads to a claim that the job is impossible or that another plan is cheapest. An incomplete search is labeled as incomplete.
   - Budget headroom is never presented as profit or savings.
3. **Ask each partner**
   - The organizer creates a private review link for each partner and shares it themselves. Creating a link does not count as sending it.
   - The partner signs in and sees only their own sites, dates, scope, exclusions, price, payer, advance and balance terms, conditions, changes and validity or recheck deadline.
   - Partners can choose: **Confirm these proposed terms**, **Request a change**, or **Decline**.
   - Partners never see other partners' prices, totals that would reveal them, or restricted sources.
   - A confirmation covers proposal-stage terms only. It does not hold crews, award the job, form a contract or start mobilization. Conditional answers stay conditional, and no response is never treated as agreement.
4. **Decide next action**
   - The organizer sees each partner's status, unresolved conditions, and any gap opened by a decline.
   - **Prebid amendment**: an incoming change request is saved apart from both the current plan and the preview.
     - Discarding the preview keeps every valid earlier consent.
     - Selecting the revised terms keeps the old terms and responses as history.
     - Every affected partner has to review again. An unaffected partner's response carries over only if their terms, dependencies and validity are unchanged.
     - Restoring an old date never brings back consent that was withdrawn, expired or invalidated.

**Built-in protections**
- Each firm's data is private, and the server checks every read and write. A forwarded link or a role switch gives no access.
- Every partner response is tied to the exact version of the terms it answered.
- Stale tabs, simultaneous edits and repeated or interrupted saves cannot accept terms that have been replaced.
- Every change and response is kept in history. History is the receipt, so there is no separate receipt page.
- Everything survives a page reload.

**Canonical synthetic demo** (labeled as synthetic; not profit, revenue or customer evidence)
- The job: twelve sites (S01–S12) over three weeks, with a $180,000 ceiling.
- Cheap plan with Alder and Redwood: $156k. It fails in weeks 1 and 2.
- Baseline plan with Alder, Birch and Cedar: $168k. It covers 4, 4 and 4 sites per week.
- Amendment request to move S09 and S10 into week 1: the weekly load becomes 6, 4 and 2, leaving a two-slot gap in week 1.
- Repair: Dogwood takes over two of Alder's sites for $172k. Alder reviews its reduced scope and payment, Dogwood reviews its new share, and Birch and Cedar carry over unchanged.
- Optional stress test: Birch adds $14k, the total reaches $186k, and the plan fails the ceiling.
- Each visitor gets their own demo copy, and resetting it never affects another visitor.

## User flow
1. A visitor lands on the sign-in page and picks Google, email and password, or a labeled demo account.
2. The organizer opens or creates the one job, then enters or pastes the brief and capacity. The gap analysis appears.
3. The organizer generates a draft, and the checker shows a pass or fail for each rule in plain words.
4. The organizer creates a partner review link and shares it personally.
5. The partner signs in, reviews only their part, and confirms, requests a change, or declines.
6. Responses show up on the organizer's project sheet with their status. A prebid amendment opens a preview with a diff, and the organizer either discards it or selects it, which triggers re-review by affected partners.
7. The organizer decides the next action using the current checks and the history.

## UI/UX feel
- Calm and businesslike, like one project sheet rather than a dashboard.
- Each partner gets one focused card, and changes appear as a clear before-and-after diff of what was amended.
- Details, history and evidence open only when asked for.
- Status is always written out in text next to its color.
- Works on a phone, with clear loading, empty and error states.
- There's no inbox, general calendar, training, chat, custom PDF builder or buyer share page.

## Implementation phases
**Phase 1: MVP, built now (Gates A and B, the full loop with manual input)**
- Sign-in with Google or with email and password, firm membership, and private per-firm data enforced by the server.
- Labeled synthetic demo accounts for the organizer and the partner firms Alder, Birch, Cedar, Redwood and Dogwood, with isolated per-visitor reset.
- One-job intake with a manual form, plus an empty-project path, visible unknowns and strict validation.
- Candidate schedule with the explicit checker and amendment preview, covering every canonical check above.
- Private partner review (confirm, request a change, decline), versioned responses, expiry and conditional cases, and protection against stale and repeated saves.
- Prebid amendment flow with affected re-review and lasting history.

**Phase 2: Gate C, fresh extraction and correction**
- AI reads a pasted or uploaded brief, quote or email and proposes structured facts, each with its source location and excerpt. Conflicts and unknowns are kept, and source documents are treated as data, never as instructions.
- Example: a "2-man crew" must not become two crews, and Redwood's later "week three only" email must change the reading.
- The organizer corrects any reading. The app keeps the original, the prior value, who edited it and when, then recalculates the candidate.
- Failures such as a bad file type, a timeout or malformed output keep the input and offer a retry. The app never claims a success that didn't happen.

**Phase 3: Gate D, simplify and verify**
- UI pass on the four-task flow.
- Dated, printable summary for the organizer only: checks, contributions, exact responses and unresolved conditions. It's printed from the browser, not from a custom PDF builder.
- Run the acceptance checks on the deployed URL and record PASS, FAIL or NOT RUN.
- Recording the 118-second demo, submitting by Sunday 11:30 Pacific, customer research (ASMBL-1) and the optional finals demo are human tasks outside the app build.

## Confirmed decisions
- Both sign-in methods are offered. Anyone who signs in with Google or email starts as an organizer with their own firm. Partners join through a review link and must sign in before they can see anything.
- All demo data is synthetic. Event rules forbid real people, firms or client data, so none are seeded or stored.
- Every firm, site, person and figure in the demo is invented and labeled "Synthetic". Partner prices, site deadlines and capacities are made up so they reproduce the Linear totals exactly ($156k, $168k, $172k, $186k, and the 4/4/4 and 6/4/2 weekly loads).
- Practice logins use email and password, and their credentials are shown on the sign-in page. Verification of real firm representatives is not claimed.
- For now the app sends no email. Organizers copy and share review links themselves.
- Phase 2 document reading uses Claude Sonnet 5.5 through the Emergent universal key, so no key is needed from the user.
- The app doesn't sync with Linear. The Linear key was used only to read the plan.

## Assumptions
- Money is shown in US dollars and dates in Pacific time.
- No payments, automatic bids, crew reservations or buyer awards are built.
