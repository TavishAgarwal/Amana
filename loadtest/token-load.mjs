// National token service load test: signed credential in, signed token set out.
// Inputs come from loadtest/make_token_requests.py. Also checks that every worker issues the same
// token for the same gene (they must share the national key), so a mismatch counts as an error.
// Usage: node loadtest/token-load.mjs http://localhost:18100 <concurrency> <seconds>
import { readFileSync } from "node:fs";

const [base = "http://localhost:18100", conc = "32", secs = "15"] = process.argv.slice(2);
const reqs = JSON.parse(readFileSync(new URL("./.out/requests.json", import.meta.url)));
const bodies = reqs.map((r) => JSON.stringify(r));
const seen = new Map(); // gene list -> token list
const lat = [], err = {};
let i = 0;
const until = performance.now() + Number(secs) * 1000;

async function worker() {
  while (performance.now() < until) {
    const k = i++ % bodies.length, t0 = performance.now();
    try {
      const res = await fetch(base + "/tokens", { method: "POST", headers: { "content-type": "application/json" }, body: bodies[k] });
      if (!res.ok) { err[res.status] = (err[res.status] ?? 0) + 1; await res.text(); continue; }
      const { token_set } = await res.json();
      lat.push(performance.now() - t0);
      const key = reqs[k].genes.join(","), toks = token_set.tokens.join(",");
      if (!seen.has(key)) seen.set(key, toks);
      else if (seen.get(key) !== toks) err.token_mismatch = (err.token_mismatch ?? 0) + 1;
    } catch (e) { err[e.cause?.code ?? e.message] = (err[e.cause?.code ?? e.message] ?? 0) + 1; }
  }
}
await Promise.all(Array.from({ length: Number(conc) }, worker));
lat.sort((a, b) => a - b);
const pct = (p) => +lat[Math.min(lat.length - 1, Math.floor(lat.length * p))]?.toFixed(1);
console.log(JSON.stringify({
  concurrency: Number(conc), seconds: Number(secs), issued: lat.length,
  per_second: +(lat.length / Number(secs)).toFixed(1), p50_ms: pct(0.5), p95_ms: pct(0.95), p99_ms: pct(0.99),
  gene_sets_cross_checked: seen.size, errors: err,
}));
