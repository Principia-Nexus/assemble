# Assemble — Agent Contract

Assemble splits one large construction job across partner firms: a plan of sites, firms and
weeks, private partner reviews, and a customer quote. Remote `Avorant/assemble`
(public). It began as an Emergent-generated app and now runs from this repo alone; no Emergent
service, package or script remains, and none comes back.

This file is short on purpose. Load depth only when the work needs it.

| Load when | Read |
|---|---|
| always | this file |
| touching any directory | its `README.md` first; change it only when the directory's files, children or rules change |
| changing product or UX behaviour | `docs/PRODUCT.md` |
| sequencing work | `docs/PLAN.md` |
| building engineering intelligence or field-service inputs | `docs/spec-engineering-intelligence.md`, `docs/spec-field-service.md` |

## Non-negotiables

- **Tell the truth.** Never invent repository state, test results or readiness. An unknown is
  `NOT-STATED`, never a plausible value.
- **Authorization is a server decision.** Every organizer route scopes by firm through
  `get_project`; every partner route by the link bound to the invited, verified email. UI hiding
  and unguessable ids are not permission checks.
- **AI proposes, deterministic code decides.** `assemble/domain/logic.py` checks every plan; a
  model answer is never an applied change until a handler validates it.
- **A partner sees only their own sites and terms.** `review.partner_terms` is the only shape a
  partner receives.
- **Money and email are deliberate.** No email leaves without an organizer action; the demo
  sandbox never sends real email; Stripe runs in test mode only.
- **No customer text, prompts, file bodies, secrets or tokens** in logs or fixtures. The one
  exception is the no-SMTP development path in `services/mailer.py`, which logs the email it did
  not send.
- **Tests are small.** A test earns its place by catching a regression a person or an attacker
  could hit. It sits next to its module as `test_<module>.py`, needs no database or network, and
  runs in `pytest` from `apps/api`.
- **Simplify first.** The least code that makes it true; one mechanism per concern. Delete what is
  no longer needed; never archive it.
