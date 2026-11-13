# AMANA: Deployment guide

> **Status (10 Nov 2026):** the container images build and run locally (`docker-compose.stack.yml`), and
> the Azure template passes `az bicep build`. **Nothing is deployed to Azure** (student credit kept for
> later). The first real deploy will need small fixes; treat this as a tested plan, not a proven one.

## 1. Run the whole stack locally in containers
```bash
docker compose -f docker-compose.stack.yml up --build
```
Wallet <http://localhost:3030>, console <http://localhost:3031>, relay `ws://localhost:18081`. These
ports do not clash with the dev servers (3010, 3011, 8000, 8080). To turn on the server AI, set
`AMANA_LLM_URL=http://host.docker.internal:11434/v1` with Ollama running on the machine.

## 2. What gets deployed
| Container | Image | Ingress | Copies | State |
|---|---|---|---|---|
| wallet | `infra/docker/web.Dockerfile` (`APP=wallet`) | public HTTPS | 1–5 | none |
| console | same (`APP=console`) | public HTTPS, limited to `consoleAllowedCidrs` | 0–2 | none |
| relay | `infra/docker/relay.Dockerfile` | public HTTPS + WSS | **1** | sessions in memory, 5 min |
| api (demo) | `infra/docker/api.Dockerfile` (`APP=demo`) | internal | **1** | in memory (demo only) |
| token | same (`APP=token`) | internal | 0–3 | none; keys from Key Vault |

Region: `uaenorth` or `uaecentral` only; the template refuses any other (`docs/compliance.md` L1).
With `alwaysOn=false`, wallet, relay and API also scale to zero when idle: cheaper, but the first
visit waits a few seconds and the demo API's in-memory state is lost.

**Why one relay.** Both phones of a couple must reach the copy that holds their session. One relay
process handled about 2,900 couples a second in the load test (`loadtest/results.json`), far above
Abu Dhabi's volume (about 2,600 couples a **year**). More copies would need sessions shared between
them (for example, the session id naming its copy); not built.

**Token service copies.** All copies load the same national keys, so tokens match across copies and
restarts (`test_copies_built_from_the_same_keys_issue_the_same_tokens`). Each copy counts its own
per-lab rate limit, so 3 copies allow up to 3 × the limit. Keep `TOKEN_RATE_PER_MINUTE` divided by the
number of copies, or move the limiter to a shared store.

## 3. First deploy, step by step
1. Create a resource group in UAE North and an Azure Container Registry.
2. Create an Entra app with a federated credential for this GitHub repo (OIDC; no passwords). Give it
   Contributor on the resource group and AcrPush on the registry.
3. In GitHub, environment `staging`: secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
   `AZURE_SUBSCRIPTION_ID`; variables `AZURE_RG`, `ACR_NAME`, `CONSOLE_CIDRS` (JSON list), `RELAY_URL`.
4. Run **deploy-staging** once (Actions → Run workflow). It prints `relayUrl`; put it in `RELAY_URL`
   and run again, because the wallet build bakes the relay address in.
5. Add the national keys and lab registry to Key Vault (commands are in `infra/azure/main.bicep`).
   The token service refuses to start in production without them. Generate keys with
   `python -c "import os;print(os.urandom(32).hex())"`, twice, on a trusted machine.
6. Restart the token container app so it reads the secrets.

## 4. Onboarding a lab
1. The lab makes an Ed25519 key pair and keeps the private key in its own vault.
2. DoH adds `{lab_id, public_key, api_key_sha256}` to the `lab-registry` secret. Only the **hash** of the
   API key is stored; the lab keeps the key itself.
3. The lab signs each credential and asks for tokens only for genes in that credential. The service
   refuses unregistered labs, wrong keys, other labs' credentials and genes not in the credential.

## 5. Settings
| Variable | Service | Meaning |
|---|---|---|
| `NATIONAL_MASTER_KEY`, `NATIONAL_SIGNING_KEY` | token | 32-byte hex keys (Key Vault) |
| `NATIONAL_TOKEN_KEY_FILE` | token | Local runs: key file, created on first use with mode 0600 |
| `LAB_REGISTRY` | token | Path to the lab registry JSON |
| `TOKEN_RATE_PER_MINUTE` | token | Token sets per lab per minute, per copy (default 600) |
| `AMANA_ENV=production` | token | Refuse to start without fixed keys |
| `TRUST_PROXY=1` | relay | Rate-limit by the address the Azure proxy reports, not the proxy's own |
| `RELAY_MAX_PER_MINUTE` | relay | Connections per address per minute (default 60) |
| `TLS_CERT`, `TLS_KEY` | relay | Serve `wss://` directly (LAN testing; Azure ends TLS itself) |
| `AMANA_LLM_URL`, `AMANA_LLM_MODEL`, `AMANA_LLM_KEY`, `AMANA_LLM_AUTH` | api | Server AI for counsellor drafts; off if unset |
| `AMANA_API`, `NEXT_PUBLIC_RELAY_URL` | wallet, console (build time) | API address and relay address |

## 6. Not done
- No Azure deploy has run; Key Vault, registry and identity wiring are untested in a real tenant.
- The demo API keeps state in memory; the consent ledger's Postgres store exists
  (`consent_ledger.core.PostgresStore`) but the demo API does not use it yet.
- No backup plan for Postgres, no alerting rules, no custom domain or certificate.
