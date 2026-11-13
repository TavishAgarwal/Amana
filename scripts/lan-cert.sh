#!/usr/bin/env sh
# Makes a self-signed certificate for testing AMANA on real phones over your Wi-Fi.
# It installs nothing and trusts nothing on this machine. Output: .local/certs/{cert,key}.pem (git-ignored).
# Usage: scripts/lan-cert.sh [LAN_IP]   (default: this Mac's Wi-Fi address)
set -eu
IP="${1:-$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')}"
[ -n "$IP" ] || { echo "Could not find a LAN IP. Pass it: scripts/lan-cert.sh 192.168.1.20" >&2; exit 1; }
DIR="$(cd "$(dirname "$0")/.." && pwd)/.local/certs"
mkdir -p "$DIR"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 30 \
  -subj "/CN=AMANA LAN test" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$IP" \
  -addext "basicConstraints=critical,CA:FALSE" -addext "extendedKeyUsage=serverAuth" \
  -keyout "$DIR/key.pem" -out "$DIR/cert.pem" 2>/dev/null
chmod 600 "$DIR/key.pem"
echo "Certificate for $IP written to $DIR (valid 30 days)."
echo "Next: AMANA_LAN_IP=$IP pnpm -C apps/wallet dev:lan   and   TLS_CERT=$DIR/cert.pem TLS_KEY=$DIR/key.pem pnpm -C services/relay start"
