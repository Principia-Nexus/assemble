# Assemble

Assemble helps a commercial contractor with a job too large to do alone split it across trusted
partner firms. The organizer turns briefs and documents into a plan of sites, firms and weeks;
each partner reviews only its own sites and terms through a private link; the customer gets a
quote they verify and accept. AI reads documents and proposes changes; deterministic checks
decide whether a plan passes. Private and proprietary: a FastAPI + MongoDB API and a React client.

Start with `AGENTS.md`: it is the operating contract and says what to load next.

## Connects

| Direction | Where | Through |
|---|---|---|
| out | `apps/` | the two runnable roles: `apps/api` (the sole mutation surface) and `apps/web` |
| out | `docs/` | product record, plan and build specs; loaded per the table in `AGENTS.md` |
| out | `.github/workflows/ci.yml` | the gate: `pyflakes` and `pytest` in `apps/api`, `yarn build` in `apps/web` |
| in | `.gitattributes` | every text file is LF in the index and the working tree |

## Run locally

Needs Python 3.12, Node 22 with Yarn 1, and a MongoDB you can reach.

```bash
cd apps/api && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # bin/ on macOS/Linux
cp apps/api/.env.example apps/api/.env        # MONGO_URL, JWT_SECRET, DEMO_PASSWORD, ANTHROPIC_API_KEY
cd apps/api && .venv/Scripts/uvicorn assemble.main:app --port 8001 --reload
cp apps/web/.env.example apps/web/.env
cd apps/web && yarn install && yarn start    # http://localhost:3000
```
