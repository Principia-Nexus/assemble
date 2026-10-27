# Assemble: product record

What Assemble does today and the rules it keeps. The code is authoritative where this differs;
fix this file when behaviour changes. The round-by-round build log of the Emergent era is in git
history, not here.

## The job it does

A commercial contractor (the **organizer**) has one job too large to do alone, for example a
lighting retrofit across twelve bank branches. Assemble turns briefs, quotes and emails into a
plan of **sites**, **firms** and **weeks**. Each partner firm checks only its own part, and the
customer gets one quote they verify and accept.

| Who | What they see |
|---|---|
| Organizer | the whole project: intake, sources, plans, every firm's terms and responses, quotes |
| Partner firm | through a private link bound to its invited, verified email: its own sites, weeks, price and terms, plus job-wide conditions that touch its sites |
| Customer | through a quote link and an emailed code: the issued quote snapshot, with firm names removed |
| Demo visitor | an isolated sandbox firm with labelled synthetic example projects |

## The flow

1. **Project.** The organizer creates a project from `/projects`. Every project call carries its
   own `X-Project-Id`, and the server checks it belongs to the organizer's firm.
2. **Intake.** Job details, sites, partner firms with price, capacity and limits, and job-wide
   conditions. These are typed in, or read from sources: pasted text, text files, typed PDFs and
   scanned PDFs (up to 8 pages are read by OCR), chat, voice and site photos. The reader proposes
   facts, each with its exact excerpt and location. Nothing applies until the organizer selects
   which readings to use. Instructions written inside a document are ignored and logged.
3. **Plan.** The generator places every site it can within the capacity, deadline, site-limit and
   access rules, preferring later weeks and cheaper firms. The checker then decides pass or
   fail against capacity, crew-weeks, deadlines, ownership, quoted limits, the budget ceiling,
   payments, site access and open conditions. A failing plan cannot be selected or sent.
4. **Private draft.** Changes are made in a private draft with a diff against the current plan.
   The draft is invisible to partners until the organizer selects it.
5. **Partner review.** Creating a review link is not sending it. The organizer either emails it or
   marks it shared. The partner confirms, confirms with conditions, requests a change or declines.
   Each response is tied to the exact version and terms it answered.
6. **Customer quote.** The quote can be issued only when every assigned firm confirms the current
   terms. Issuing freezes a snapshot. The customer verifies with a 6-digit emailed code, then
   accepts, declines or asks for changes, and exactly one acceptance can win. An amendment starts
   from the accepted snapshot.

## The workspace

One screen per project. It has Graph, List, Week and Report views over the same typed items:
groups, tasks, milestones, AI tasks and conditions, linked by edges. There is one inspector and a
bottom composer for chat. Every edit is a validated, rev-guarded batch with an inverse, so it can
be undone. A site task's firm and week come from the selected plan or the private draft, and
draft values carry a Draft marker. Each firm keeps one distinct colour.

## AI's place

Claude reads documents, transcribes scanned pages, describes photos, answers questions and
proposes plan changes. Whisper transcribes voice. Every model answer is a proposal. It becomes a
change only through the same validated handlers a person uses, and the deterministic checker in
`apps/api/assemble/domain/logic.py` has the last word. The assistant writes only to the private
draft. It never responds for a firm, issues a quote or records an acceptance.

## Money and email

- **Billing:** a $99 one-time pilot through Stripe Checkout, in test mode only. It is off when
  `STRIPE_SECRET_KEY` is unset. Demo access is free.
- **Email:** sent over SMTP when `SMTP_HOST` is set; without it, the email is written to the
  server log. Sending always takes a deliberate organizer action, and the demo sandbox never sends
  real email.

## Demo

Each visitor gets a sandbox firm with three examples:

- the canonical 12-branch lighting retrofit (`apps/api/assemble/demo/data/`);
- a six-store retail job;
- a warehouse job with a missing quote.

"Reset this example" resets only the open example, and "Make a clean copy" copies the 12-branch
job for recording.

The fixture was built to reproduce these totals:

- $156k, failing in weeks 1 and 2;
- $168k, passing at 4/4/4;
- a 6/4/2 amendment;
- a $172k Dogwood repair;
- a $186k stress failure.

Whether the current plan builder still produces these exact totals is NOT-STATED until it is
re-run against a database.

## Not in the product

Google sign-in, the evidence graph, the guided tour and the sample-PDF buttons were removed. The
app is not hosted anywhere: there is no domain and no deployment.
