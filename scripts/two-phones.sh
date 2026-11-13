#!/usr/bin/env bash
# One command for the real two-phone test over Wi-Fi (docs/lan-testing.md). Uses its own ports, so it
# runs beside the normal dev servers (3010, 3011, 8000, 8080):
#   wallet https://<ip>:3443   relay wss://<ip>:18443   demo API http://127.0.0.1:18800 (laptop only)
# Makes a self-signed certificate if there isn't one for this IP. Installs and trusts nothing.
# Stop with Ctrl+C. Usage: scripts/two-phones.sh [LAN_IP]
set -euo pipefail
cd "$(dirname "$0")/.."
IP="${1:-$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')}"
[ -n "$IP" ] || { echo "No Wi-Fi address found. Pass it: scripts/two-phones.sh 192.168.1.20" >&2; exit 1; }
C=.local/certs
if [ ! -f $C/cert.pem ] || ! openssl x509 -in $C/cert.pem -noout -ext subjectAltName 2>/dev/null | grep -q "IP Address:$IP"; then
  scripts/lan-cert.sh "$IP"
fi
export PYTHONPATH=packages/schemas:services/token-service:services/lab-issuer:services/consent-ledger:services/explainer:services/adapters/mock-signin:services/adapters/records-exchange:services/adapters:services/demo-api:sim:.
pids=()
trap 'kill "${pids[@]}" 2>/dev/null' EXIT INT TERM
uv run uvicorn demo_api.app:api --host 127.0.0.1 --port 18800 --log-level warning & pids+=($!)
(cd services/relay && TLS_CERT=../../$C/cert.pem TLS_KEY=../../$C/key.pem PORT=18443 node src/server.js) & pids+=($!)
(cd apps/wallet && AMANA_DIST_DIR=.next-lan AMANA_DEV_ORIGINS="$IP" AMANA_API=http://127.0.0.1:18800 \
  NEXT_PUBLIC_RELAY_URL="wss://$IP:18443" pnpm exec next dev -H 0.0.0.0 -p 3443 --experimental-https \
  --experimental-https-key ../../$C/key.pem --experimental-https-cert ../../$C/cert.pem) & pids+=($!)
cat <<MSG

On each phone (same Wi-Fi as this laptop):
  1. Open https://$IP:18443/healthz and accept the certificate warning (lets the phone reach the relay).
  2. Open https://$IP:3443/en/welcome and accept the warning again.
  3. Sign in as Mariam on one phone and Khalid on the other, then "Check together".
     One phone shows its code; the other scans it (or types the text code).
Automated check of the same setup from this laptop:  node scripts/e2e.mjs https://$IP:3443
MSG
wait
