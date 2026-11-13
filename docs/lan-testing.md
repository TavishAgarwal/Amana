# Testing on two real phones (same Wi-Fi)

Phones only allow the camera, WebCrypto keys and secure WebSockets on `https://` pages. On a laptop,
`localhost` counts as secure; on a phone, the laptop's Wi-Fi address does not. So for a real-phone
test the wallet and the relay must both be served over HTTPS.

Nothing here installs or trusts a certificate on your laptop. Trusting it on the phones is your choice.

**Quickest way:** `scripts/two-phones.sh` does steps 1 and 2 below in one command, on its own ports
(wallet `https://<ip>:3443`, relay `wss://<ip>:18443`), so it runs beside the normal dev servers. It
prints what to open on each phone. `node scripts/e2e.mjs https://<ip>:3443` runs the same check
automatically in two browsers on the laptop, as a test of the setup before using the phones.

## 1. Make a certificate for your laptop's Wi-Fi address
```bash
scripts/lan-cert.sh            # uses this Mac's en0 address; or: scripts/lan-cert.sh 192.168.1.20
```
This writes `.local/certs/cert.pem` and `key.pem` (git-ignored, valid 30 days), for `localhost`,
`127.0.0.1` and your LAN IP.

## 2. Start the services
```bash
export PYTHONPATH=packages/schemas:services/token-service:services/lab-issuer:services/consent-ledger:services/explainer:services/adapters/mock-signin:services/adapters/records-exchange:services/demo-api:sim:.
uv run uvicorn demo_api.app:api --port 8000                     # only the wallet server talks to it
TLS_CERT=.local/certs/cert.pem TLS_KEY=.local/certs/key.pem pnpm -C services/relay start   # wss://<ip>:8080
AMANA_LAN_IP=<ip> pnpm -C apps/wallet dev:lan                  # https://<ip>:3010
```
The wallet finds the relay at `wss://<same host>:8080` on its own. To use another address, set
`NEXT_PUBLIC_RELAY_URL` before starting the wallet.

## 3. On each phone
1. Open `https://<ip>:8080` once and accept the certificate warning (the page then says
   "Upgrade Required"; that is expected). This lets the phone open the secure WebSocket later.
2. Open `https://<ip>:3010/ar/welcome` and accept the warning again.
3. Sign in as Mariam on one phone and Khalid on the other. "Check together" → one phone shows its
   code, the other scans it.

If the camera does not open, type the code shown under "Can't scan? Show the code as text".

## Optional: no warnings
Self-signed certificates always show a warning, and some browsers will not install the app offline
(service worker) from such a page. For a warning-free test you can use a local certificate
authority such as `mkcert`. That installs a root certificate on your laptop and phones, so do it only
on devices you control, and remove it afterwards. AMANA does not do this for you.

## What still differs from production
- The demo API and relay run on your laptop. In production they run in UAE North behind a real
  certificate (see `docs/deployment-guide.md`).
- Sign-in is the mock national-ID provider with synthetic people.
