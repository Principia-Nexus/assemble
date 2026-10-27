# Assemble: open work

What is known to be unfinished. This list is the backlog of the Emergent-era record, cut to what
the code still lacks. Take items in order unless a person says otherwise. Delete an item when it
ships; never mark it done and keep it.

## Now

- **Run it once for real.** No one has run the app since it left Emergent. Start the API against
  a MongoDB, sign in to the demo, and walk the canonical 12-branch job from draft to accepted
  quote. Record which demo totals in `PRODUCT.md` still hold under the current plan builder.
- **Real email delivery.** Send an invitation and a quote code over SMTP to a real inbox, then
  complete the partner response from a second device.

## Next

- **Hesperia demo.** Build a Demo project from the public Hesperia library lighting bid PDF
  (29 pages). It has 50 standard and 20 emergency fixtures as separate line items, 5–10 a.m.
  weekday work, and completion within 30 business days. The notice-to-proceed date is a marked
  assumption, and city holidays stay unknown.
- **Revision merge rules.** A revision replaces only the changed fact. A blank field never erases
  a saved value. A prerequisite keeps its site, scope and owner. Obligations merge only when they
  are identical.
- **Large documents.** Read by page range. Report pages beyond the 40k-character budget as
  uninspected, never as read.
- **Date pickers** for quote valid-until and evidence dates. Check frame-title wrapping at 320px
  and the assistant dock at 200% zoom.

## Later

- An extraction consistency eval: the same documents read fresh three times, compared.
- CSLB licence lookup, scope splitting, and drawing/spec conflict detection.
- Holiday-calendar evidence for business-day durations.
- Delivery events from email: delivered and bounced, not only accepted.
- Hosting: needs a host, a domain, MongoDB and a decision to pay for them
  (`infra/README.md` lists what the host must provide).
