# AMANA

Private, consented couple carrier check for premarital genetic screening (Future Health Challenge F3, Abu Dhabi).

- **My result:** each person's lab-signed carrier result is delivered once to their phone and kept there, encrypted. Programme results ("compatible" / "not compatible") show in the same panel.
- **Check together:** two phones learn only "do we share a change in the same gene?"; the gene is shown only if both agree. The server never sees genes.
- **Help:** reviewed condition cards, questions answered **on the phone** with reviewed sentences only (every phone gets rules; phones that can take it may add a 4.9 MB multilingual model, only after the person agrees; questions are never sent), a question to a counsellor (Tier 2) or a one-to-one booking (Tier 3), anonymous family invites.
- **Counsellor console** with consent-scoped cases, AI-drafted notes and mandatory sign-off; **dashboard** with privacy, safety, understanding and fairness results.

Docs: `docs/PRD.md`, `architecture.md`, `rules.md`, `phases.md`, `design.md`, `docs/limitations.md` (what is and is not built), `model-card.md`, `study-kit.md`, `review-packet.md`, `commercial-case.md`, `compliance.md` (UAE rules), `deployment-guide.md`, `lan-testing.md`; pilot proposal in `pitch/pilot-proposal.md`.

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
pnpm -C services/relay start  # ws://localhost:8080, the private check runs through it
pnpm -C apps/wallet dev      # http://localhost:3010/ar/welcome
pnpm -C apps/console dev     # http://localhost:3011/en/queue
```
Two real phones on the same Wi-Fi: `pnpm two-phones` (HTTPS and `wss://` on their own ports; see [`docs/lan-testing.md`](docs/lan-testing.md)).

Whole demo in containers: `pnpm stack` (wallet http://localhost:3030, console http://localhost:3031). Deploying to Azure UAE North: [`docs/deployment-guide.md`](docs/deployment-guide.md) (not deployed yet).

Checks that need the app running (for example `pnpm stack`): `pnpm e2e` (two browsers do the full couple check) and `pnpm a11y` (axe-core on every screen, English and Arabic, light and dark). Server load test: `pnpm load` (results in `loadtest/results.json`).

On-device answers: the card index and model ship in `apps/wallet/public/ask`. After editing cards, rebuild the index with `PYTHONPATH=services/explainer uv run python scripts/build_ask_index.py` (a test fails if you forget). To rebuild the model from the original (Apache-2.0, about 430 MB), download `sentence-transformers/static-similarity-mrl-multilingual-v1` and run `node scripts/build-ask-model.mjs <its folder> 64`.

AI (optional, local): install [Ollama](https://ollama.com), `ollama pull llama3.1:8b`, and start the API with `AMANA_LLM_URL=http://localhost:11434/v1`. Without it, fixed rules do the same jobs. The AI only **selects** reviewed sentences for people and **drafts** notes for counsellors (`docs/model-card.md`).

Demo people (all synthetic): **Mariam + Khalid** (not yet screened; use the private check, both carry HBB), **Noura + Omar** (programme: compatible; Noura carries PAH), **Layla + Yousef** (programme: not compatible). The understanding study is at `/en/study`.

Two "phones" on one laptop: open the wallet at `http://localhost:3010` and at `http://127.0.0.1:3010`. They are different origins, so each has its own device key and storage. Sign in as Mariam in one and Khalid in the other; "Show my code" in one, paste the code in the other.

Real phones need HTTPS for the wallet and `wss://` for the relay (WebCrypto and the camera are blocked on plain `http://<laptop-ip>`). Set `NEXT_PUBLIC_RELAY_URL` and `AMANA_API` to point the wallet at other addresses.

Demo order: sign in (result is delivered once to the phone), my result, card (simpler words, quick check, ask), check together (pair, both see yes/no, reveal after both agree), book a counsellor and share the condition name; console queue, case, AI draft, sign-off; the note appears in the wallet; revoke in Sharing; Layla's programme result; family invite; study; attack demo and dashboard.
