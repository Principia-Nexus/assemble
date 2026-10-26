# One image: the web client is built, then served by the API from the same origin (WEB_DIR).
# Build from the repository root: docker build -f infra/assemble.Dockerfile .
FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY apps/web/package.json apps/web/yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY apps/web/ ./
# Empty: the client calls /api on its own origin.
ENV REACT_APP_BACKEND_URL="" CI=false
RUN yarn build

FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 WEB_DIR=/app/web STORAGE_DIR=/data/objects
WORKDIR /app
COPY apps/api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/api/assemble ./assemble
COPY --from=web /web/build ./web
RUN useradd --uid 10001 --no-create-home assemble && mkdir -p /data/objects && chown -R assemble /data
USER 10001
# Uploaded PDFs and photos live here; mount a volume so they survive a restart.
VOLUME /data
EXPOSE 8000
CMD ["uvicorn", "assemble.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
