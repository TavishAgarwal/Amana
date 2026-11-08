# AMANA: Deployment guide (how a lab and DoH would onboard)

1. Lab generates an Ed25519 key pair; public key and an API key are registered with the national token service.
2. Lab issues signed credentials (`lab_issuer`) and requests tokens only for genes in each credential.
3. DoH operates the token service with the national key in Key Vault, one key per environment.
4. Relay and consent ledger run in Azure Container Apps, UAE North; Postgres for the audit table.
5. Local: `docker compose up -d postgres`, `uv run pytest`, `pnpm test`.

**Not done:** Azure resources, `deploy-staging.yml` (stub), TLS and CORS configuration, Key Vault wiring.
