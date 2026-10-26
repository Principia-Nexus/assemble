# Assemble: Finish the Demo

The existing assistant can build a clearly labelled Demo project, either from typed facts or from an uploaded bid PDF. The demo then runs from a private plan, through each firm's explicit response, to a complete customer quote, acceptance, an accepted amendment and a PDF export.
This round fixes the customer offer, revisions, intake and leftover dead ends. Working flows, real projects, accepted quotes and the twelve-site fixture are kept as they are.

## Who it's for
- **Organizing contractors** who want to rehearse or show the full workflow without real customers or firms.
- **Judges and viewers** watching the demo. Their access is free.
- **Demo partner and customer identities** that respond only within their own scope.

## Core features and experience

### 1. AI-driven demo setup
- **How it starts:** the organizer asks the existing assistant to build a fictional California lighting-retrofit demo. There is no wizard and no separate demo screen.
- **Where it goes:** the demo goes into a project marked **Demo**, and the label stays on it. If the open project holds real work, the assistant offers to create a new Demo project instead. It never mixes fictional data into real records.
- **What the assistant generates:** firms, scopes, quantities, prices, availability and customer terms. All of it is saved through the same validated edits as ordinary changes.
- **Provenance:**
  - Every generated value carries a "Demo-generated" origin, shown in the existing inspector.
  - Supplied facts and document readings keep their own origin.
  - The assistant never invents source citations or claims a licence-registry lookup took place.
- **Fictional records:**
  - Names are fictional and email addresses are reserved test addresses.
  - Licence records are marked **Simulated**, never real or verified.
  - Demo projects never send external email and never take live payments.
- **The app checks what will pass:**
  - The assistant proposes the figures. The app recomputes every total, schedule, capacity and access-window check from the saved records.
  - If generated values would fail a check, the app shows the failure and the assistant proposes a correction. Nothing is forced to pass.
  - Facts the organizer supplied are kept as given. If they conflict, the conflict is shown, not quietly changed.
- **Reuse and retries:**
  - The scenario is saved and can be changed through chat or direct edits.
  - Running the setup again updates the same records. It never duplicates firms, scopes or projects.
  - "Make a clean copy" still works and doesn't reset other projects.
- **What stays manual:**
  - The assistant may prepare a private plan and a draft quote.
  - Selecting the plan, each firm's response, issuing the quote and customer acceptance stay explicit actions.
  - These are done by scoped demo identities through the existing "Review as partner" and customer code paths. The organizer and the AI can't respond on a firm's behalf or create acceptance receipts.
- **Demo marker:** shown on partner and customer response screens, receipts and the PDF. It never appears inside the contract conditions.

### 2. Hesperia document demo
- **The document:** the uploaded Hesperia library lighting bid PDF becomes its own Demo project. It is a historical public bid, not a customer or a live opportunity.
- **Fictional parties:** the customer and firms are fictional. The city's contacts are never used as recipients, and no city acceptance is claimed.
- **Scope from page 11:**
  - 50 standard fixtures and 20 emergency-power fixtures, kept as separate line items through the quote and the PDF.
  - Installation, commissioning and disposal are included where the document supports them.
- **Work restrictions:**
  - Work happens 5–10 a.m. on weekdays, excluding city holidays.
  - Completion is due within 30 business days of notice to proceed.
  - The demo notice-to-proceed date is marked as a synthetic assumption.
  - The duration is counted in business days. If the holiday calendar isn't in the document, that is flagged as missing.
  - Historical dates aren't replaced, and the job isn't forced into three weeks.
- **Prices:** the bid's price fields are blank, so demo prices are generated with units and arithmetic and marked Demo-generated. They are never presented as prices from the source.
- **Page coverage:**
  - All 29 pages are tracked and actual coverage is reported. If pages are unreadable, the app asks for the missing information.
  - Demo generation can't mark pages as reviewed or turn assumptions into extracted facts.
  - A deliberate demo override keeps the original requirement and is attributed separately.
- **What it isn't:** the packet is shown as a bid and specification set. It is not presented as a completed engineering takeoff or a full drawing set.

### 3. A complete customer offer
- **Line items from saved records:** each included site's scope, quantity, unit, location and relevant prerequisites go into the quote, the accepted snapshot and the customer PDF.
  - Example: North's 20 luminaires and South's 80 appear under their own sites, not as a single total of 100.
- **Prices:**
  - Internal cost and the organizer-authorized selling price stay separate.
  - Decimal amounts are kept exactly.
  - A generated or revised customer price stays "Proposed" until the organizer authorizes it.
- **Before issuing:** if an included scope or quantity is unresolved, the item is named. Nothing is silently left out.

### 4. Revisions that keep information
- **Field by field:** only the changed fact is replaced, with its source and history kept. A blank field in a revision doesn't erase the saved value. Deleting something takes an explicit, authorized change.
- **Ownership:** each prerequisite keeps its project, site, scope, firm and responsible party. A North-only access requirement never becomes a job-wide one.
- **Duplicates:** obligations are merged only when they are identical in responsibility, scope and timing.

### 5. Reliable intake
- **Organizer clarifications:** an answer like "all these dates are in 2026" updates the saved start date, weeks, deadlines and access windows. Afterwards, stale "Year?" items and old correction rows close, and the original source stays in history.
- **Instructions:**
  - Instructions from the signed-in organizer go through validated edits.
  - Instructions inside uploaded documents stay untrusted.
- **Payment terms:**
  - A minimum term and a proposed term are stored separately, with their timing. Example: Alder's 25% before mobilization and a proposed 50% on October 30 are both kept as compatible terms, not competing revisions.
  - Customer payment terms go in the customer fields and need no partner.
- **Citations:** each firm's facts cite that firm's own paragraph. Example: Cedar's values never cite Birch's.
- **Missing facts:** outside Demo projects, missing facts are never invented.

### 6. Customer terms and amendments
- **Kept out of customer conditions:** internal modelling notes, demo disclaimers and partner-consent wording.
- **Customer obligations:** each one states who is responsible, for what scope, the amount and the timing. Swapping a firm's name for "the subcontractor" isn't enough.
- **Partner payment terms stay private.** Example: the customer never sees two unexplained $12,000 advances.
- **No default to Exclude:** a material condition becomes a customer obligation, a supported resolution, or an explicit exclusion of the dependent work. All internal issue checks stay in place.
- **Accepted amendments:**
  - They show "Accepted" everywhere, with no pending wording and no duplicate conditions.
  - The change is applied exactly once, and both receipts and the earlier accepted history are kept.
  - New amendments start from the latest accepted version unless the organizer picks another draft.

### 7. Dead ends and clutter removed
- **Request review with no email** opens that firm's Email field, then returns to the invitation after saving. A link that was only created is never shown as an email that was sent.
- **Qualification status:**
  - Unknown qualification shows **Needs review**, not Fits.
  - Having no configured requirement is not shown as proof.
- **Editing controls:**
  - The stale "Check" and "Save and check gaps" labels are replaced.
  - Repeated edit and check buttons are removed.
  - Checks run automatically after each save.
- **Packages:**
  - Titles are short: work, firm and site count.
  - The count includes assigned packages only.
  - Unused firms stay available without inflating the count.
- **Assistant dock:** the dock and its suggested prompts never cover calendar entries, report text or actions, at normal size and at 200% zoom.
- **Login:** hidden fields can no longer be reached with Tab, and the inert warning is fixed.
- **Report:** Print/PDF stays available. No separate Summary page is recreated.
- **$99 test checkout:** its entry link is fixed. It runs in test mode only, and judges' demo access stays free.
- **Unknown addresses** show a simple not-found page.

## User flow
1. **Set up:** create a Demo project with the assistant from typed facts. Generated details are visibly marked.
2. **Upload and correct:** upload a document and apply one correction. No other fields are erased.
3. **Edit:** edit in the graph or in chat. Both update the same saved records and totals.
4. **Select and confirm:** select the plan. Each demo partner confirms its own displayed terms.
5. **Issue:** authorize the selling price and issue a complete quote with its relevant conditions.
6. **Accept:** the customer accepts with their own code. After a reload, the same version and receipt appear.
7. **Amend:** make a change, collect the affected firms' reviews and accept the amendment. The difference is applied once.
8. **Export:** export the accepted customer PDF with quantities, locations, conditions and version.
9. **Hesperia:** build the Hesperia Demo project from the uploaded PDF and run steps 4–8 on it.
10. **Publish:** publish the app and repeat the key steps on the public link.

## UI/UX feel
- **Unchanged:** the current graph, assistant dock, single inspector and top-bar controls.
- **Demo labelling:** one persistent Demo label, with provenance shown in the inspector.
- **Wording:**
  - Labels are short and errors are specific.
  - No new explanatory paragraphs, celebratory messages, duplicate summaries or permanent helper panels.
  - Material terms stay visible wherever a person makes a decision.

## Implementation phases
- **Phase 1 (MVP, built now): everything above.**
  - **Earlier passes rechecked on the final build:**
    - Scoped partner review, rapid saves, date validation and calendar consistency.
    - Incomplete-plan rejection, 12-week readability and week ordering.
    - Receipt persistence and PDF export.
  - **Must not pass as ready:** access conflicts, uncovered included scope, unknown material costs, and wrong or expired licences.
  - **Partial quotes:** a supported partial quote names the excluded work and checks its dependencies.
  - **Partner support:**
    - Exact current partner support is checked both at issue and at customer acceptance.
    - Stale links can't accept terms that have been replaced.
    - Private drafts never overwrite an accepted version, and later support changes never rewrite its history.
  - **Assistant failures:** Stop → reload → new request works. Direct editing still works when the assistant is unavailable.
  - **Large files:** coverage reports unread pages honestly.
  - **Report:** each check is reported as PASS / FAIL / NOT RUN, with the build identifier and the fresh quote and amendment evidence. Generated demo setup is reported separately from actual document extraction.
- **Phase 2:**
  - Real email delivery to a real inbox.
  - Holiday-calendar evidence for business-day durations.
  - Page-range reading for very large documents.
- **Phase 3:**
  - A full recording rehearsal on a clean copy.
  - Optional fixed demo scenarios for repeatable recordings.

## Assumptions
- **Demo figures:** the AI writes the demo figures and the app checks the math and every rule. The AI can't override a failing check.
- **$99 checkout:** stays in the demo in test mode, with its link fixed.
- **Amendment check:** the "$500 applied once" fix is checked on the fresh demo amendment. The separate $18,000.99 example isn't rebuilt.
- **Publishing:** after the preview checks pass, the app is published again and the key steps are repeated on the public link.
- **Demo identities:** demo partner and customer identities exist only inside Demo and example projects and are reached through the existing review and customer-code paths.
- **Licences:** simulated licence records count as evidence only inside Demo projects, and are always marked Simulated.
- **Hesperia notice to proceed:** the demo notice-to-proceed date is a weekday chosen as a marked assumption. City holidays count as unknown until a calendar is provided.
- **What stays untouched:** the twelve-site fixture, real projects, accepted quotes and the audit project. None of them is used as proof.
- **Test claims:** synthetic tests aren't used to claim real email delivery, engineering correctness, production authentication or production load capacity.
