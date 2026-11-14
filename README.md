# AMANA

Private, consented couple carrier check for premarital genetic screening.
Built for the Future Health Digital Innovation Challenge, Abu Dhabi: challenge F3, *Understanding and Reducing Inherited Disease Risk*.

AMANA (Arabic for "trust") lets two people learn only one thing: **whether they share a change in the same gene**. Neither of them, their families, nor the AMANA operator sees the other person's carrier results. It then explains the result in plain Arabic or English, checks that it was understood, and connects the couple to a counsellor.

> **Status: prototype.** Synthetic data only. Not deployed, not a medical device, and the condition cards are still waiting for clinical review. [`docs/limitations.md`](docs/limitations.md) lists what is and is not built.

## What it does

- **My result:** each person's lab-signed carrier result is delivered once to their phone and kept there, encrypted. Programme results ("compatible" / "not compatible") show in the same panel.
- **Check together:** two phones learn only "do we share a change in the same gene?"; the gene is shown only if both agree. The server never sees genes.
- **Help:** reviewed condition cards, questions answered **on the phone** with reviewed sentences only (every phone gets rules; phones that can take it may add a 4.9 MB multilingual model, only after the person agrees; questions are never sent), a question to a counsellor (Tier 2) or a one-to-one booking (Tier 3), anonymous family invites.
- **Sharing:** every permission and every access in one list, signed by the phone's key; revoking works at once.
- **Counsellor console** with consent-scoped cases, AI-drafted notes and mandatory sign-off; **dashboard** with privacy, safety, understanding and fairness results; an **attack demo** that shows what plain hash matching would leak.

## How it works, in short

1. A lab signs each person's result. A national token service turns each carried gene into a token that only matches the same gene, and only for 7 days.
2. The wallet stores the result and tokens on the phone, encrypted with a key that cannot leave the device (optional PIN lock on top).
3. For a couple check the two phones pair in person (QR or typed code) and run private set intersection (OpenMined PSI) through a relay that only passes scrambled messages. Each phone works out its own yes/no.
4. Anything shared with a counsellor or relative is a signed, time-limited permission in a hash-chained consent ledger, and can be revoked.

Full design: [`docs/architecture.md`](docs/architecture.md). Threats and answers: [`docs/threat-model.md`](docs/threat-model.md).

## Repository map

| Path | What is there |
|---|---|
| `apps/wallet` | The phone app (Next.js, Arabic and English, works offline as a PWA) |
| `apps/console` | Counsellor console, dashboard and attack demo (Next.js) |
| `services/token-service`, `lab-issuer`, `consent-ledger`, `explainer` | Python services: tokens, signed results, consent and audit, reviewed-sentence answers |
| `services/relay` | Node WebSocket relay for the couple check (never sees genes) |
| `services/demo-api` | FastAPI app that wires the services together for the demo |
| `services/adapters` | Mock national-ID sign-in and health-records exchange ([`docs/integration.md`](docs/integration.md) says what a real connection needs) |
| `packages/schemas`, `packages/ui`, `packages/config` | Shared data models, design tokens, config |
| `content` | Condition cards, carrier basics, study material, on-device answer index |
| `packs` | Country packs (Abu Dhabi, and a second demo country to show the config swap) |
| `sim` | Synthetic population, evaluation harness, attack demo |
| `redteam`, `loadtest` | Red-team prompts and results; server load test |
| `infra` | Dockerfiles and the Azure Container Apps template |
| `docs`, `pitch` | Documents (table below) and pitch material |

## Requirements

Node 20+, pnpm 9, [uv](https://docs.astral.sh/uv/) (Python 3.12+), and Docker for Postgres and the container stack. `pnpm e2e` and `pnpm a11y` drive an installed Google Chrome.

## Set up and test

```bash
cp .env.example .env
docker compose up -d postgres      # port 5433
uv sync --group dev
uv run pytest -q                   # Python services, PSI check, privacy tests (needs Postgres)
pnpm install && pnpm test          # Node relay and wallet tests
pnpm lint                          # type checks
```

Without Postgres running, one test (`test_postgres_store_is_append_only_and_chain_verifies`) fails and the rest pass.

Evaluation (about 10 minutes, writes `sim/eval/results.json`):
```bash
PYTHONPATH=packages/schemas:services/token-service:services/lab-issuer:services/consent-ledger:services/explainer:sim:. uv run python -m sim.eval.harness
```
Attack demo: same `PYTHONPATH`, `uv run python -m sim.eval.attack_demo`.

## Run the demo (laptop only, works offline)

Four terminals:
```bash
export PYTHONPATH=packages/schemas:services/token-service:services/lab-issuer:services/consent-ledger:services/explainer:services/adapters/mock-signin:services/adapters/records-exchange:services/demo-api:sim:.
uv run uvicorn demo_api.app:api --port 8000
pnpm -C services/relay start  # ws://localhost:8080, the private check runs through it
pnpm -C apps/wallet dev      # http://localhost:3010/ar/welcome
pnpm -C apps/console dev     # http://localhost:3011/en/queue
```

Other ways to run it:

- **Whole demo in containers:** `pnpm stack` (wallet http://localhost:3030, console http://localhost:3031).
- **Two real phones on the same Wi-Fi:** `pnpm two-phones` (HTTPS and `wss://` on their own ports; see [`docs/lan-testing.md`](docs/lan-testing.md)).
- **Azure UAE North:** [`docs/deployment-guide.md`](docs/deployment-guide.md) (not deployed yet).

Checks that need the app running (for example `pnpm stack`): `pnpm e2e` (two browsers do the full couple check) and `pnpm a11y` (axe-core on every screen, English and Arabic, light and dark). Both take the wallet address as an argument, for example `node scripts/e2e.mjs http://localhost:3010`. Server load test: `pnpm load` (results in `loadtest/results.json`).

### Demo people (all synthetic)

| Couple | Situation |
|---|---|
| **Mariam + Khalid** | Not yet screened; use the private check. Both carry HBB |
| **Noura + Omar** | Programme result: compatible. Noura carries PAH |
| **Layla + Yousef** | Programme result: not compatible |

The understanding study is at `/en/study` (no sign-in needed).

**Two "phones" on one laptop:** open the wallet at `http://localhost:3010` and at `http://127.0.0.1:3010`. They are different origins, so each has its own device key and storage. Sign in as Mariam in one and Khalid in the other; "Show my code" in one, paste the code in the other.

Real phones need HTTPS for the wallet and `wss://` for the relay (WebCrypto and the camera are blocked on plain `http://<laptop-ip>`). Set `NEXT_PUBLIC_RELAY_URL` and `AMANA_API` to point the wallet at other addresses.

### Demo order

Sign in (result is delivered once to the phone), my result, card (simpler words, quick check, ask), check together (pair, both see yes/no, reveal after both agree), book a counsellor and share the condition name; console queue, case, AI draft, sign-off; the note appears in the wallet; revoke in Sharing; Layla's programme result; family invite; study; attack demo and dashboard.

### Good to know before a demo

- The demo API keeps everything in memory. **Restart it for a clean slate**: cases, permissions and booked appointments all reset. There are 9 appointment times per counsellor, so repeated rehearsals can use them up.
- Results are tied to the browser's device key. To switch person, use "Use a different demo persona" on the welcome screen, or Settings, "Delete all my data".
- A forgotten app-lock PIN cannot be recovered; the lock screen offers "Forgot your PIN?", which deletes the data on that phone so you can sign in again.
- If the wallet says it cannot reach the AMANA service or the pairing service, the API (port 8000) or the relay (port 8080) is not running.

## Optional pieces

**AI (local):** install [Ollama](https://ollama.com), `ollama pull llama3.1:8b`, and start the API with `AMANA_LLM_URL=http://localhost:11434/v1`. Without it, fixed rules do the same jobs. The AI only **selects** reviewed sentences for people and **drafts** notes for counsellors ([`docs/model-card.md`](docs/model-card.md)).

**On-device answers:** the card index and model ship in `apps/wallet/public/ask`. After editing cards, rebuild the index with `PYTHONPATH=services/explainer uv run python scripts/build_ask_index.py` (a test fails if you forget). To rebuild the model from the original (Apache-2.0, about 430 MB), download `sentence-transformers/static-similarity-mrl-multilingual-v1` and run `node scripts/build-ask-model.mjs <its folder> 64`.

## Evidence

Numbers are copied from [`docs/evaluation-report.md`](docs/evaluation-report.md); the source of truth is `sim/eval/results.json`.

| Area | Result |
|---|---|
| Correctness | 5,000 simulated couples: 0 missed, 0 false alarms |
| Privacy and security | 26 tests passed (forged token, all-genes attack, replay, expiry, revoke, audit tamper, relay log scan) |
| Red-team | 100 prompts in Arabic, English and mixed: 0 directive, 0 unsupported answers (automated check; human review still needed) |
| Load | Up to 3,176 couples/s through one relay process; about 2,983 token sets/s on one worker ([`loadtest/results.json`](loadtest/results.json)) |
| Accessibility | axe-core on every screen, both languages, light and dark ([`docs/review/a11y-results.json`](docs/review/a11y-results.json)) |
| Not yet measured | Understanding and fairness with real people, time to counselling, phones on real networks |

## Documents

| Document | About |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Problem, users, requirements |
| [`docs/architecture.md`](docs/architecture.md) | How it is built |
| [`docs/design.md`](docs/design.md) | Screens and components |
| [`docs/rules.md`](docs/rules.md), [`docs/decisions.md`](docs/decisions.md) | Engineering rules and decisions |
| [`docs/threat-model.md`](docs/threat-model.md), [`docs/data-map.md`](docs/data-map.md) | Threats; what data lives where |
| [`docs/compliance.md`](docs/compliance.md) | UAE rules and how AMANA maps to them |
| [`docs/model-card.md`](docs/model-card.md) | What the AI does and does not do |
| [`docs/evaluation-report.md`](docs/evaluation-report.md), [`docs/review-packet.md`](docs/review-packet.md) | Results; packet for clinical reviewers |
| [`docs/study-kit.md`](docs/study-kit.md) | Understanding study protocol |
| [`docs/limitations.md`](docs/limitations.md), [`docs/integration.md`](docs/integration.md) | What is not built; what is mocked |
| [`docs/commercial-case.md`](docs/commercial-case.md), [`docs/cost-model.md`](docs/cost-model.md), [`pitch/pilot-proposal.md`](pitch/pilot-proposal.md) | Commercial case, costs, pilot proposal |
| [`docs/deployment-guide.md`](docs/deployment-guide.md), [`docs/lan-testing.md`](docs/lan-testing.md) | Deploying; testing on real phones |
| [`docs/phases.md`](docs/phases.md) | Build schedule |
