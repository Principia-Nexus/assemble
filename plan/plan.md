# Assemble: Make the Construction Workflow Dependable

Assemble helps an organizing contractor see which parts of a job they can take on, what is missing, and which partner firms complete the team. It then turns that into a customer-ready quote with explicit customer acceptance.

## Who it's for
- **Organizing contractors** (initially California) who plan multi-trade or multi-site jobs, bring in partner firms and quote the customer.
- **Partner firms**, who review and respond to their own exact terms.
- **Customers**, who read, question and explicitly accept an issued quote.

## Core features and experience

### 1. Qualification decides assignments
- Each scope carries its requirements, such as "C-10 electrical" or "active C-39 roofing". A requirement comes from three places:
  - a project document or chat, cited with its source and page;
  - a suggestion grounded in the active California rules and the firm's role on the contract;
  - organizer input.
- Every proposed firm-to-scope assignment shows one of **Fits**, **Does not fit**, **Evidence needed** or **Review needed**, with the reason and a link to the source or rule in the card's detail panel.
- **Suggested requirements** show as "Review needed", with the reason and source, until the organizer reviews them.
  - **Confirm** records that review but does not prove legal eligibility.
  - **Dismiss** requires a reason, and cannot remove a requirement set by a project document or an applicable rule.
  - An unresolved requirement stays "Review needed". Silence is never treated as permission.
- **Licence evidence: the organizer attaches and reviews it** (licence card, screenshot, certificate). The result is labelled "Evidence reviewed by <name>, <date>", never "verified". Expired or wrong-class evidence counts as **Does not fit**.
- **Automatic CSLB lookup (Phase 2):** a "Check CSLB" action that records the official result with a timestamp. It needs a CSLB data-portal access token, which the organizer registers for. If the lookup fails or is unavailable, the evidence stays unresolved.
- **The same rules apply everywhere:** chat, direct edits, drafting, plan selection and quote issue.
  - A wrong-class or expired firm can never become the operative assignment.
  - Unknown evidence never counts as a pass.
  - An invalid alternative may exist only as an explicitly invalid private draft.
- **Separate results:** budget/schedule checks, scope coverage and qualification are reported separately. A passing budget check no longer means "ready".
- Architect or engineer-of-record authority is kept separate from contractor licensing and is never inferred from a licence.

### 2. Uncovered work stays visible
- Assignment is optional. "Leave roofing open" in chat, or clearing the firm on the card, keeps the scope with its quantity, requirements, exclusions, dependencies and sources.
- The drafting step never fills an open slot with the cheapest remaining firm.
- An open scope shows as a short card, e.g. **Roofing: qualified firm needed**, with three actions:
  - add a known firm;
  - attach evidence;
  - ask the assistant to compare firms already in the project.
  The app never invents partners, prices or availability; when nothing fits it says no supported match is known.
- Partial plans can be saved and edited.

### 3. Documents are read completely, or the gap is shown exactly
- Every upload keeps its revision and a per-page record: queued, read, unreadable or unsupported. For example, "20 of 38 reviewed · 18 remaining".
- **Large sets** are read in resumable batches until every supported page is done. Completed pages survive cancel, timeout, retry and reload, with no duplicate scopes.
- **Conclusions** cite the source revision and page/sheet. Text extraction is not presented as having read a drawing's dimensions or symbols.
- **Unreadable pages:** the assistant names the page and asks in chat for a clearer export or the specific missing fact. The answer is recorded as the user's. Readable pages are never asked for again.
- **Unsupported files** (e.g. CAD/BIM) get a request for a PDF export, and the project is kept.
- **Unread pages** that matter block any claim that the review is complete.
- **Conflicts and revisions:** conflicts between drawings, specifications, addenda and chat are shown, not settled by upload time. A new document revision creates a change to review and never alters an accepted quote.

### 4. Easy correction
- **Scope details:** clicking a scope opens a compact detail panel with title, included/excluded work, site, quantity and unit, proposed firm, timing and evidence.
- **Grouping and splitting** keeps the original source, contract context and quantities. A scope is not the same as a site, and one firm may cover several scopes or the whole job.
- **Chat makes the same saved edits.** Examples:
  - "Split controls from fixture replacement"
  - "Keep roofing unassigned"
  - "We have zero own capacity"
  - "Use the revised quote for electrical"

  Zero is kept distinct from unknown. Every change gets a short receipt with Undo. A short question is asked only when an ambiguity changes scope, price, authority or commitment.
- **Dates:** missing dates can get an explicitly tentative sequence, kept separate from availability a firm has stated. No precise dates, capacity or prices are invented from drawings.
- **Firms not in the plan:** their missing fields (e.g. payment terms) leave the main list of what's missing and stay in their own detail panel.

### 5. Drafts are separate from commitments
- **Draft plan** creates and checks a private candidate only. It never selects terms, sends anything, issues a quote or records consent. An explicit "private draft, don't select" instruction is always respected.
- **One header action at a time:** **Draft plan → Review draft → Select plan → Send for review → Prepare quote**.
  - Selection shows the exact change first.
  - Sending shows the recipients first, and a missing email can be filled in right there.
  - Link created, copied, sent and delivered are shown as different states.
- **Partner responses:**
  - A job done entirely by the organizer needs no partner invitation.
  - Any independent partner, even a sole one, gives its own response to its exact current contribution.
  - There is no written-reason override.

### 6. Scope and conditions carry into the quote
- **Exclusions** can be recorded for the whole job, a scope or a firm. A partner name is no longer required.
- **The quote preview** is built from the current scope, applicable exclusions and material conditions, and flags conflicts and omissions for the organizer. Private firm prices, peer terms and internal notes never reach the customer view or the customer assistant.
- **Before issue**, the app requires:
  - coverage of every scope the quote promises;
  - supported qualification;
  - current firm responses;
  - a decision on each material condition.

  Permitted open commercial conditions are written into the offer.
- **Partial quote** (when a scope has no qualified firm): allowed only after an explicit review of included work, exclusions and dependencies.
  - The quote clearly states what it does not cover.
  - The partial quote is blocked if left-out work is needed to deliver the included work and nobody is responsible for that dependency.
  - Work is never silently dropped, and the job is never called fully covered.
- **Price and dates:** the organizer sets the customer price, which stays separate from internal cost or budget. Offer expiry is separate from project start: a November 1 expiry is valid on October 25.
- Accepted quotes, their receipts and amendment history stay unchanged by later private drafts.

### 7. Project knowledge you can trust
- Project requirements, firm evidence and reference material are added through the existing attachment and chat flow. Each item records its source, revision, who added it and who may see it.
- Uploads propose knowledge; they never switch on platform rules by themselves.
- California rules are versioned. Each assessment records the rule version and evidence revisions it used. When knowledge changes, affected work is reassessed, while past consent and offers are preserved.

### 8. Recovery and real recipients
- **Applying readings** marks them Applied and shows the result at once. Repeating it never falsely says nothing was saved.
- **Conflicts and AI runs:** typed edits survive conflicts, retry never duplicates anything, and a cancelled AI run can never make a late change.
- **No AI needed:** the whole journey still works through direct controls when the AI is unavailable, including with the keyboard, at 200% zoom, on narrow screens and in print/PDF export.
- **Access:** invitations and access are checked in separate organizer, partner and customer browser sessions. Each recipient sees only their own data, and expired or stale links are refused.

## User flow
1. Upload documents or describe the job in chat.
2. See sourced scopes with requirements; correct them by clicking a card or in chat.
3. Add or compare partner firms. Every assignment shows Fits, Does not fit, Evidence needed or Review needed, and open scopes stay visible.
4. Draft plan (private) → Review draft → Select plan.
5. Send for review. Partners sign in, see only their terms and respond.
6. Prepare quote. Review coverage, exclusions and conditions (with a partial-scope review if needed), then issue.
7. The customer opens the quote with an emailed code, asks questions, and accepts or requests changes.
8. After reload, both the organizer and the customer can retrieve the accepted version. Later changes become a new amendment and never alter it.

## UI/UX feel
- **One graph workspace:** Graph, List, Calendar and Report views of the same saved plan, a floating chat bar at the bottom, and a single detail panel.
- **One header action** that changes with the job's state. No step rails, stage dashboards or decorative status boxes.
- **Short, concrete labels:** "Roofing: qualified firm needed", "Awaiting Alder", "Evidence reviewed".
- **Existing look kept:** Assemble's colours and top bar, per-firm colours, and coloured status text.

## Implementation phases

**Phase 1: MVP (built now)**
- Scope requirements with sources, rule-based "Review needed" suggestions, Confirm/Dismiss with a recorded reason.
- Organizer-attached licence evidence, and the four assignment results enforced on every path (chat, edits, draft, selection, issue).
- Optional assignment, open-scope cards, partial plans.
- Separate coverage, qualification and budget/schedule results.
- Private drafts that never select, and the Select plan step.
- Exclusions at job, scope and firm level, carried into the quote preview.
- Issue gate covering coverage, qualification, responses and conditions, plus the partial-quote review with the dependency block.
- Resumable reading of every page in large PDFs, with an exact "X of Y reviewed" record and chat requests for unreadable pages.
- The "Applied" readings fix, and the expiry-versus-start fix.

**Phase 2**
- Automatic CSLB lookup (needs a CSLB data-portal token).
- Scope splitting and grouping in chat and the detail panel, with quantities kept.
- Detected conflicts between drawings, specifications and addenda, and a review step for revisions.
- A versioned knowledge library with reassessment when rules or evidence change.
- Merging rapid edits and handling edits from two tabs.

**Phase 3**
- Testing access in separate organizer, partner and customer sessions on the published app.
- An authorized real-email delivery test.
- Checks for 200% zoom, keyboard use and print/export.
- The full acceptance table repeated on the published build.
- An observed session with a real contractor on a nonconfidential project.

## Assumptions
- The first target market is California. Rules cover common C-class specialty and B general contractor roles; anything else is "Review needed".
- "Evidence reviewed" is an organizer attestation, never presented as an official registry check.
- Firms "compared" by the assistant are only those already in the project. No external contractor directory is connected.
- Large PDFs are read in the background. The organizer can keep working, and partial results are clearly marked.
- Drawings are read as text plus any notes the reader can see. Dimensions and symbols are not claimed to be read.
- A sole independent partner still responds to its own terms. A job done entirely by the organizer skips invitations.
- Existing accepted test project `prj_57d9052ae647` and the twelve-site example are kept as they are and not reset.
- Stripe stays in test mode. No real customer email is sent unless the user explicitly authorizes a test.
