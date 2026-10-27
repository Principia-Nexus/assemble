# docs/

The product record, the open work, and the two build specs the rule packs come from. `AGENTS.md`
says when to load each one.

| File | What it is |
|---|---|
| `PRODUCT.md` | what Assemble does today and the rules it keeps |
| `PLAN.md` | the open work, in order |
| `spec-engineering-intelligence.md` | appendix A1: the runtime contract, capability contracts and contextual profiles |
| `spec-field-service.md` | appendix A2: field-service inputs, trade profiles and customer outputs |

Every pack in `apps/api/assemble/domain/packs/*.json` names its section of A1 or A2 in `source`.

## Change recipes

- When a behaviour ships or changes, update `PRODUCT.md` and delete the item from `PLAN.md`
  in the same commit.
