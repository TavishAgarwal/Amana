# Python services: the demo API (APP=demo) or the national token service (APP=token).
# Build from the repo root: docker build -f infra/docker/api.Dockerfile -t amana-api .
# linux/amd64: openmined-psi 2.0.6 ships Linux wheels for x86-64 only. Azure Container Apps runs x86-64;
# on an ARM Mac, Docker emulates it (slower, fine for local runs).
FROM --platform=linux/amd64 python:3.12-slim AS base
COPY --from=ghcr.io/astral-sh/uv:0.12.16 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/opt/venv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY packages ./packages
COPY services ./services
COPY sim ./sim
COPY content ./content
COPY packs ./packs
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONPATH=/app/packages/schemas:/app/services/token-service:/app/services/lab-issuer:/app/services/consent-ledger:/app/services/explainer:/app/services/adapters/mock-signin:/app/services/adapters/records-exchange:/app/services/adapters:/app/services/demo-api:/app/sim:/app \
    APP=demo PORT=8000
RUN useradd --uid 10001 --no-create-home amana && mkdir /keys && chown amana /keys
USER amana
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD python -c "import os,urllib.request;urllib.request.urlopen('http://127.0.0.1:%s/%s' % (os.environ['PORT'], 'healthz' if os.environ['APP']=='token' else 'api/pack'))"
CMD ["sh", "-c", "if [ \"$APP\" = token ]; then exec uvicorn token_service.app:api --host 0.0.0.0 --port $PORT --workers ${WORKERS:-2}; else exec uvicorn demo_api.app:api --host 0.0.0.0 --port $PORT; fi"]
