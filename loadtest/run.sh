#!/usr/bin/env bash
# Runs the server-side load tests on this machine and writes loadtest/results.json.
# Everything runs on one machine, so the load client competes with the server for the same cores.
# Relay runs are short bursts with 35 s pauses: each couple opens two fresh connections, and a
# single client machine runs out of local ports (about 16,000, held 30 s after closing) otherwise.
set -euo pipefail
cd "$(dirname "$0")/.."
O=loadtest/.out; mkdir -p $O; : > $O/results.jsonl
PYTHONPATH=packages/schemas:services/lab-issuer uv run python loadtest/make_token_requests.py 2000
wait_up() { for _ in $(seq 1 30); do curl -sf "$1" > /dev/null && return; sleep 1; done; echo "not up: $1"; exit 1; }
cores=$(sysctl -n hw.ncpu 2>/dev/null || nproc)

for w in 1 2 4 8; do
  rm -f $O/key.json
  PYTHONPATH=packages/schemas:services/token-service NATIONAL_TOKEN_KEY_FILE=$O/key.json \
    LAB_REGISTRY=$O/labs.json TOKEN_RATE_PER_MINUTE=100000000 \
    uv run uvicorn token_service.app:api --port 18100 --workers $w --log-level warning > $O/token.log 2>&1 &
  wait_up http://localhost:18100/healthz; sleep 2
  if [ $w -ge 4 ]; then
    node loadtest/token-load.mjs http://localhost:18100 64 15 > $O/a.json & pa=$!
    node loadtest/token-load.mjs http://localhost:18100 64 15 > $O/b.json; wait $pa
    node -e "const [a,b]=process.argv.slice(1).map(f=>JSON.parse(require('fs').readFileSync(f,'utf8')));console.log(JSON.stringify({test:'token',workers:$w,clients:2,concurrency:128,seconds:15,issued:a.issued+b.issued,per_second:+(a.per_second+b.per_second).toFixed(1),p50_ms:Math.max(a.p50_ms,b.p50_ms),p95_ms:Math.max(a.p95_ms,b.p95_ms),p99_ms:Math.max(a.p99_ms,b.p99_ms),errors:{...a.errors,...b.errors}}))" $O/a.json $O/b.json >> $O/results.jsonl
  else
    node loadtest/token-load.mjs http://localhost:18100 64 15 | sed "s/^{/{\"test\":\"token\",\"workers\":$w,\"clients\":1,/" >> $O/results.jsonl
  fi
  kill $(lsof -tiTCP:18100 -sTCP:LISTEN) 2>/dev/null || true; sleep 3
done

(cd services/relay && RELAY_MAX_PER_MINUTE=100000000 RELAY_QUIET=1 PORT=18080 node src/server.js > /dev/null 2>&1 &)
wait_up http://localhost:18080/healthz
R=$(lsof -tiTCP:18080 -sTCP:LISTEN)
for c in "25 1" "50 1" "100 2"; do
  set -- $c; sleep 35
  node loadtest/relay-load.mjs ws://localhost:18080 $1 3 $2 | sed "s/^{/{\"test\":\"relay\",/" >> $O/results.jsonl
done
kill $R

node -e "
const rows=require('fs').readFileSync('$O/results.jsonl','utf8').trim().split('\n').map(JSON.parse);
const meta={date:'$(date +%F)',machine:'$(uname -sm)',cores:$cores,node:process.version,
 note:'Load client and server share the same machine and cores. Synthetic data only.'};
require('fs').writeFileSync('loadtest/results.json',JSON.stringify({...meta,runs:rows},null,1)+'\n');"
cat loadtest/results.json
