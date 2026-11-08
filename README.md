# AMANA

Private, consented couple carrier check. Docs: `docs/PRD.md`, `architecture.md`, `rules.md`, `phases.md`, `design.md`, and `docs/limitations.md` (what is and is not built).

## Run
```bash
cp .env.example .env
docker compose up -d postgres      # port 5433
uv sync --group dev
uv run pytest -q                   # Python services, PSI check, privacy tests (needs Postgres)
pnpm install && pnpm test          # Node relay
```
Evaluation (about 10 minutes, writes `sim/eval/results.json`):
```bash
PYTHONPATH=packages/schemas:services/token-service:services/lab-issuer:services/consent-ledger:services/explainer:sim:. uv run python -m sim.eval.harness
```
Attack demo: same `PYTHONPATH`, `uv run python -m sim.eval.attack_demo`.

Tooling: Node 20+, pnpm 9, uv, Docker. Synthetic data only.

## Run the demo (laptop only, works offline)
```bash
export PYTHONPATH=packages/schemas:services/token-service:services/lab-issuer:services/consent-ledger:services/explainer:services/adapters/mock-signin:services/adapters/records-exchange:services/demo-api:sim:.
uv run uvicorn demo_api.app:api --port 8000
pnpm -C apps/wallet dev      # http://localhost:3010/ar/welcome
pnpm -C apps/console dev     # http://localhost:3011/en/queue
```
Demo order: wallet (Mariam) result, card, pair, check, reveal, share with counsellor; console queue, case, sign-off; revoke in the wallet; attack demo and dashboard.
