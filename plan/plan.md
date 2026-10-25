# Assemble: Fresh-Project Completion Repairs

A fresh project built from the twelve-site documents should go from import to an explicit customer acceptance without retyping facts already supplied; request genuinely missing contacts, evidence and commercial decisions.
These repairs fix behavior only. The graph, assistant, navigation and look stay the same, and no new explanatory text is added.

## Who it's for
- Organizing contractors who import job documents and firm quotes, plan the work, get firm sign-off and issue a customer quote.
- Partner firms reviewing only their own terms.
- Customers reading and accepting an issued quote.

## Core features and experience
1. **Document facts become saved fields**
   - Dated access windows set the start date, the week count, the earliest allowed work per site and each site's deadline.
   - If the year or meaning is unclear, the app asks one question using the field name. The answer applies to every affected record.
   - Later documents are read against the facts already saved, including corrections.
   - Customer payment terms go to the job and customer fields.
   - Chat only reports a change when it saved one. Explanations are never shown as saved changes.
   - A private customer quote is pre-filled with the timing and terms from the selected records. The selling price is always entered by the organizer.
2. **Full internal cost**
   - Coordination and contingency are saved as separate cost lines. They count in draft totals, checks, comparisons and the Report.
   - Contingency is kept apart from margin.
   - If a material cost can't be represented, the total shows as incomplete and the budget check can't pass.
   - Chat quotes the saved total. It labels any hypothetical calculation as one.
   - Internal cost and the customer selling price stay separate.
3. **Scope, conditions and access kept separate**
   - Site scope, proposed assignment, access windows and conditions are stored separately, so "Proposed by Alder" can no longer replace a site's scope.
   - Conditions that add to each other, such as an advance and an owner review, are both kept. Only a real contradiction about the same fact replaces the older one, and the change is recorded with who made it.
   - Material conditions from partner responses reach the quote's issue gate. Each must be put in the offer, resolved with support, or excluded.
   - Work scheduled before a site's access opens, or after its deadline, is flagged as an **Access conflict**.
   - A plan with an access conflict stays a private draft. It can't be selected, sent to firms or quoted until the conflict is resolved by an attributed change.
   - Once a firm's exact response satisfies an older condition, that condition is no longer shown as open. Its wording stays in the inspector history. Obligations that continue stay active.
4. **Every condition decision is saved**
   - Fast clicks are each saved in order. A slow or stale reply can't overwrite a newer decision.
   - Each choice shows Saving, or a failure with Retry, and keeps what was chosen.
   - The selected state is marked by more than colour.
5. **Consent shown for the right version**
   - Package cards show the plan version together with the version the response applies to, for example "Confirmed for v1" or "Needs review v2".
   - Exploring v2 keeps v1's valid responses and the accepted Q1. Discarding a private draft never removes responses.
   - List and Report scope rows show the assigned firm's name.
6. **Handoffs and AI failure**
   - On the organizer's own example projects, **Review as partner** signs in as that firm's demo account, then switches back. It never opens a real partner's response.
   - A real invitation opened while signed in as someone else offers a sign-in that returns to the invitation.
   - Partner sign-in, permissions and the required firm support stay in force.
   - The customer assistant works again. It answers only from the issued quote version and never reveals firm prices, changes terms or accepts for the customer.
   - When the assistant fails, reading, editing and responding still work directly.
7. **Task edits persist**
   - Fast edits to a task's title, dates, date type and notes are all saved, in order, and survive a reload.
   - A conflict (409) keeps the unsaved input in place.
   - List and inspector show the same saved title.
8. **Correct checks on incomplete plans**
   - An unassigned site fails "every site scheduled" and "exactly one week".
   - Unassigned sites show "Unassigned" instead of "null · wk null".
   - Incomplete drafts stay editable.
   - A deliberately narrowed offer is checked against the scope it explicitly includes.
9. **Source ordering**
   - An undated document does not outrank a dated drawing by default.
   - Upload order does not decide which revision is in force.
   - A revision that only changes price leaves the scope details intact.
10. **Condition ownership**
   - Each prerequisite keeps its site, scope or firm through extraction, saving, partner review and quoting.
   - A firm working only at Central sees Central requirements and the shared dependencies that affect it. It does not see unlabelled North or South conditions.
11. **Task date ranges**
   - A due date earlier than the start date is rejected, whether it's edited directly or by the assistant.
   - The entered values stay in the fields for correction.
12. **Dated tasks in Calendar**
   - Dated tasks appear in the correct month and week, next to milestones and firm allocations.
   - Editing a task's dates moves it in the calendar.
   - Clicking an entry opens the existing inspector.
13. **Long schedule tables**
   - Columns keep a readable minimum width. The schedule scrolls sideways inside the drawer instead of squeezing twelve weeks.
   - Site names stay visible while scrolling.
14. **Mobile accessible names**
   - History, Projects and My reviews keep their accessible names when the visible labels are hidden. No visible text is added.
15. **Week order**
   - Weeks sort by number: 3, 4, …, 10, 11, 12, never alphabetically.

## User flow
1. Create a fresh project and upload the brief. For the test fixture, confirm 2026 once if asked. The start date (November 2), the three weeks and the three groups of four site deadlines are filled in.
2. Import the five firm quotes and the Redwood email. Weekly capacity comes out as Alder 2/2/2, Birch 1/1/1, Cedar 1/1/1, Dogwood 2/0/0 and Redwood 0/0/6.
3. Add contacts and reviewed qualification evidence. Tests use clearly fictional records.
4. Draft the baseline. Firm cost $144,000 + coordination $12,000 + contingency $12,000 = $168,000, with $12,000 headroom. Access windows are enforced.
5. Select the plan and send it. Each firm reviews only its own terms.
6. Decide every material condition. Enter the customer selling price.
7. Issue Q1. The customer opens it with their own code and accepts explicitly.
8. Reload both sides. The same accepted version and receipt appear.
9. Draft the Dogwood change as private v2 ($172,000, $8,000 headroom). Q1 and v1 stay unchanged, and the affected firms show "Needs review v2".
10. Once all preview checks pass, publish the app and repeat the relevant steps on the public URL, with separate sessions for each recipient.

## UI/UX feel
- The current layout stays as it is. Wording is reduced, not added.
- Labels are short: Draft, Review, Send, Accepted, Needs review, Missing price, Access conflict, Review v2.
- There is one primary action for the current step. Repeated "Edit plan" and "run checks" controls are removed, clicking a card opens its editor, and checks run automatically after each save.
- Saved results appear in their own field or card, with no duplicate toast, chat paragraph or status panel.
- Assistant receipts are one factual line, such as "Moved S09 and S10 to week 1".
- Source details and history live in the existing inspector.
- Existing filler sentences are deleted.

## Implementation phases
- **Phase 1 (MVP, built now):** repairs 1–15 and the completion test on a fresh preview project.
  - Acceptance checks also cover unknown-cost handling (the total shows as incomplete and the budget can't pass) and rejection of wrong or expired licences.
  - The added tests are: rapid task edits followed by a reload, incomplete-plan checks, source ordering, condition ownership, task date ranges, Calendar tasks, long schedule tables, mobile accessible names and week order.
  - The app is then published and the relevant checks are repeated on the public URL.
  - Every check is reported as PASS / FAIL / NOT RUN, with the build identity.
- **Phase 2:** real email delivery to a real inbox, which must pass before claiming real invitations work. Also page coverage on large documents.
- **Phase 3:** export and 200% zoom checks, then a clean-copy rehearsal of the full journey for recording. The rehearsal is held until the export and zoom checks pass.

## Assumptions
- In normal use, the year comes from the source documents. The app asks only when the documents don't establish it. The 2026 confirmation applies only to the test fixture.
- Where a document has no date, a dated document (such as a dated drawing) wins by default. The organizer can override this with a recorded choice.
- Coordination and contingency are internal costs that count against the budget ceiling. Contingency is never counted as margin.
- A condition is "material" if it affects price, payment, access, timing, scope or required customer action. Other notes stay informational.
- An access conflict blocks both selecting the plan and sending it to firms. It is resolved by a change from a named person, such as moving the week or recording an approved access exception.
- The audit project `prj_d2bda21ee301`, accepted quotes and the seeded examples are kept untouched and aren't used as proof.
- Publishing happens only after the preview checks pass. Synthetic `.test` addresses never receive email.
- Any leftover filler text found on screens touched by these repairs is removed.
