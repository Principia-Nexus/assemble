# infra/

How Assemble ships: one container image holding the API and the built web client, served from one
origin. `.github/workflows/image.yml` publishes it to `ghcr.io/principia-nexus/assemble` (tags
`main` and the commit sha) on every push to `main`. Nothing here deploys it or creates anything
that costs money; choosing and paying for a host is a separate decision.

## Connects

| Direction | Where | Through |
|---|---|---|
| in | `apps/web` | `assemble.Dockerfile` stage `web`: `yarn build` with an empty `REACT_APP_BACKEND_URL`, so the client calls `/api` on its own origin |
| in | `apps/api` | `assemble.Dockerfile` final stage: `requirements.txt` and the `assemble` package, run by uvicorn on port 8000 |
| out | the host | needs MongoDB (`MONGO_URL`, `DB_NAME`), `JWT_SECRET`, `DEMO_PASSWORD`, `ANTHROPIC_API_KEY`, and `APP_URL` = `CORS_ORIGINS` = the public https origin; optional settings in `apps/api/.env.example` |
| out | the host | a volume at `/data` for uploaded PDFs and photos; TLS in front (auth cookies are `Secure`) |

## Change recipes

- Run the image: `docker run -p 8000:8000 --env-file apps/api/.env -v assemble-data:/data ghcr.io/principia-nexus/assemble:main`.
