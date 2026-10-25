import os
import logging
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from core import db, client, PROJECT_CTX
import auth_routes
import project_routes
import assistant_routes
import graph_routes
import items_routes
import quote_routes
import media_routes
import review_routes
import extract_routes
import billing_routes
import qual_routes

app = FastAPI(title="Assemble")
app.include_router(auth_routes.router)
app.include_router(project_routes.router)
app.include_router(qual_routes.router)
app.include_router(project_routes.projects_router)
app.include_router(assistant_routes.router)
app.include_router(graph_routes.router)
app.include_router(items_routes.router)
app.include_router(quote_routes.router)
app.include_router(quote_routes.public)
app.include_router(media_routes.router)
app.include_router(review_routes.router)
app.include_router(extract_routes.router)
app.include_router(billing_routes.router)


@app.get("/api/")
async def root():
    return {"app": "Assemble", "status": "ok"}


@app.middleware("http")
async def origin_guard(request: Request, call_next):
    PROJECT_CTX.set((request.headers.get("x-project-id") or "").strip()[:40] or None)
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.url.path.startswith("/api"):
        origin = request.headers.get("origin")
        hosts = {h.strip() for k in ("x-forwarded-host", "host") for h in (request.headers.get(k) or "").split(",") if h.strip()}
        hosts |= {urlparse(o.strip()).netloc for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip() not in ("", "*")}
        if origin and hosts and urlparse(origin).netloc not in hosts:
            return JSONResponse(status_code=403, content={"detail": "Request origin not allowed."})
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip() not in ("", "*")],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@app.on_event("startup")
async def startup():
    await db.users.create_index([("email", 1), ("sandbox_id", 1)], unique=True)
    await db.users.create_index("user_id", unique=True)
    idx = await db.projects.index_information()
    if idx.get("firm_id_1", {}).get("unique"):
        await db.projects.drop_index("firm_id_1")
    await db.projects.create_index([("firm_id", 1), ("position", 1), ("created_at", 1)])
    await db.projects.create_index([("firm_id", 1), ("create_key", 1)], unique=True,
                                   partialFilterExpression={"create_key": {"$type": "string"}})
    await db.projects.create_index("project_id", unique=True)
    await db.versions.create_index("version_id", unique=True)
    await db.links.create_index("token", unique=True)
    await db.responses.create_index([("project_id", 1), ("partner_id", 1), ("idempotency_key", 1)], unique=True)
    await db.sandboxes.create_index("sandbox_id", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.user_sessions.create_index("session_token")
    await db.events.create_index([("project_id", 1), ("at", -1)])
    await db.fixtures.create_index("fixture_id", unique=True)
    from fixtures import ensure_fixtures
    await ensure_fixtures()
    try:
        import asyncio
        from storage import init_storage
        await asyncio.to_thread(init_storage)
        logging.info("Object storage initialized")
    except Exception as e:  # noqa: BLE001
        logging.error(f"Object storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
