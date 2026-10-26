# apps/api/assemble/demo/

The synthetic demo: each browser visitor gets an isolated sandbox firm with labelled example
projects, partners and documents. Nothing here touches a real firm's data, and a sandbox never
sends real email.

| Path | What it is |
|---|---|
| `sandbox.py` | creates and resets a visitor's sandbox (`ensure_demo_user`, `reset_project`) |
| `examples.py` | the example projects seeded into a sandbox |
| `fixtures.py` | loads the canonical fixture from `data/` into MongoDB on startup |
| `seed.py` | `python -m assemble.demo.seed`: reseeds the fixture by hand |
| `data/` | the canonical 12-branch fixture |
