# apps/api/assemble/domain/

The deterministic core: what a valid intake is, how a plan is generated, and whether it passes.
There is no I/O except reading the JSON files beside it, so every function here can be tested
without a database.

## Connects

| Direction | Where | Through |
|---|---|---|
| in | `routes/` | every handler that decides anything calls in here; nothing here calls out |
| in | `routes/assistant.py`, `routes/extract.py` | `rule_packs.select` and `prompt_block` add versioned guidance to Claude prompts |
| in | `docs/spec-*.md` | the source of `packs/*.json`; change the spec and the pack together |

| Path | What it is |
|---|---|
| `logic.py` | intake validation, the plan generator (a greedy pass, then augmenting paths), the checker, diffs between versions |
| `state.py` | partner review states and the public shape of a link |
| `qualify.py` | licence fit per firm and site, from `rules/ca_license_rules.json` |
| `rule_packs.py` | trade rule packs from `packs/*.json`, selected per message or source |
| `rules/`, `packs/` | the data those modules load |
| `test_logic.py`, `test_qualify.py` | the generator, checker and licence-fit regressions |

## Change recipes

- Add a checker rule: build it with `_rule(key, label)` inside `check()` in `logic.py` and append
  it to `rules`, add a test in `test_logic.py` that fails without it, and bump `CHECKER_VERSION`.
