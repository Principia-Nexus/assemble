# apps/api/assemble/domain/

The deterministic core: what a valid intake is, how a plan is generated, and whether it passes.
No I/O except reading the JSON beside it, so every function here is testable without a database.

| Path | What it is |
|---|---|
| `logic.py` | intake validation, the plan generator, the checker, diffs between versions |
| `state.py` | partner review states and the public shape of a link |
| `qualify.py` | licence fit per firm and site, from `rules/ca_license_rules.json` |
| `rule_packs.py` | trade rule packs from `packs/*.json`, selected per message or source |
| `rules/`, `packs/` | the data those modules load |
