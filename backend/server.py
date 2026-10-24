import os
import logging
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from core import db, client
import auth_routes
import project_routes
import review_routes
import extract_routes

app = FastAPI(title="Assemble")
app.include_router(auth_routes.router)
app.include_router(project_routes.router)
app.include_router(review_routes.router)
app.include_router(extract_routes.router)


@app.get("/api/")
async def root():
    return {"app": "Assemble", "status": "ok"}


@app.middleware("http")
async def origin_guard(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.url.path.startswith("/api"):
        origin = request.headers.get("origin")
        host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        if origin and host and urlparse(origin).netloc != host:
            return JSONResponse(status_code=403, content={"detail": "Request origin not allowed."})
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@app.on_event("startup")
async def startup():
    await db.users.create_index([("email", 1), ("sandbox_id", 1)], unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.projects.create_index("firm_id", unique=True)
    await db.projects.create_index("project_id", unique=True)
    await db.versions.create_index("version_id", unique=True)
    await db.links.create_index("token", unique=True)
    await db.responses.create_index([("project_id", 1), ("partner_id", 1), ("idempotency_key", 1)], unique=True)
    await db.sandboxes.create_index("sandbox_id", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.user_sessions.create_index("session_token")
    await db.events.create_index([("project_id", 1), ("at", -1)])


@app.on_event("shutdown")
async def shutdown():
    client.close()
