# apps/api/assemble/demo/

The synthetic demo: each browser visitor gets an isolated sandbox firm with labelled example
projects and partners. Nothing here touches a real firm's data, and a sandbox never sends real
email.

## Connects

| Direction | Where | Through |
|---|---|---|
| in | `routes/auth.py` | demo sign-in calls `sandbox.ensure_demo_user`; `/auth/demo-accounts` lists `fixtures.accounts` |
| in | `routes/projects.py` | "Reset this example" and "Make a clean copy" |
| in | `routes/extract.py` | `/project/demo-content`: the fixture's sample customer change |
| out | MongoDB | the `fixtures` collection, filled from `data/` on startup when empty |

| Path | What it is |
|---|---|
| `sandbox.py` | creates and resets a visitor's sandbox (`ensure_demo_user`, `reset_project`) |
| `examples.py` | the example projects seeded into a sandbox |
| `fixtures.py` | loads `data/*.json` into MongoDB and builds an intake from a fixture |
| `seed.py` | `python -m assemble.demo.seed [--replace]`: reloads the fixtures by hand |
| `data/` | the canonical 12-branch fixture |

## Change recipes

- Edit the canonical job: change `data/canonical-12-branch.json`, then
  `python -m assemble.demo.seed --replace`, because startup loads fixtures only into an empty
  collection.
