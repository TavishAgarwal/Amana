// Relay load test: many couples at once, each doing a real-sized two-way check through the relay.
// Message sizes are measured from the wallet's PSI (128 padded items, base64): hello ~0.6 KB,
// request 6.0 KB, setup + response 6.8 KB, sent once in each direction (count step, no reveal).
// Usage: node loadtest/relay-load.mjs ws://localhost:18080 <concurrent couples> <seconds> [client processes]
// The relay must run with RELAY_MAX_PER_MINUTE set high: every client here shares one IP address.
import { fork } from "node:child_process";

const [url = "ws://localhost:18080", conc = "200", secs = "20", procs = "1"] = process.argv.slice(2);
const SIZES = { hello: 600, req: 5976, resp: 6820 };
const filler = (n) => "x".repeat(n);

function open() {
  return new Promise((res, rej) => {
    const w = new WebSocket(url);
    w.onopen = () => res(w);
    w.onerror = () => rej(new Error("connect"));
  });
}
const next = (w, type) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("timeout:" + type)), 10_000);
  w.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === type) { clearTimeout(t); res(m); } };
  w.onclose = () => { clearTimeout(t); rej(new Error("closed")); };
});
const relay = (w, payload) => w.send(JSON.stringify({ type: "relay", payload }));

async function couple() {
  const t0 = performance.now();
  const a = await open();
  const created = next(a, "created");
  a.send(JSON.stringify({ type: "create" }));
  const { sid } = await created;
  const b = await open();
  const aj = next(a, "joined"), bj = next(b, "joined");
  b.send(JSON.stringify({ type: "join", sid }));
  await Promise.all([aj, bj]);
  // hello both ways, then each side asks and the other answers
  for (const [from, to] of [[a, b], [b, a]]) {
    const got = next(to, "relay"); relay(from, filler(SIZES.hello)); await got;
  }
  for (const [from, to] of [[a, b], [b, a]]) {
    let got = next(to, "relay"); relay(from, filler(SIZES.req)); await got;
    got = next(from, "relay"); relay(to, filler(SIZES.resp)); await got;
  }
  a.close(); b.close();
  return performance.now() - t0;
}

async function worker(until, out) {
  while (performance.now() < until) {
    try { out.lat.push(await couple()); } catch (e) { out.err[e.message] = (out.err[e.message] ?? 0) + 1; }
  }
}

async function runHere(n, seconds) {
  const out = { lat: [], err: {} };
  const until = performance.now() + seconds * 1000;
  await Promise.all(Array.from({ length: n }, () => worker(until, out)));
  return out;
}

const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))] ?? null;

if (process.env.RELAY_LOAD_CHILD) {
  const out = await runHere(Number(conc), Number(secs));
  process.send(out, () => process.exit(0));
} else {
  const P = Number(procs), per = Math.ceil(Number(conc) / P);
  const parts = await Promise.all(Array.from({ length: P }, () => new Promise((res) => {
    const c = fork(new URL(import.meta.url).pathname, [url, String(per), secs], { env: { ...process.env, RELAY_LOAD_CHILD: "1" } });
    c.on("message", res);
  })));
  const lat = parts.flatMap((p) => p.lat).sort((x, y) => x - y);
  const err = {};
  for (const p of parts) for (const [k, v] of Object.entries(p.err)) err[k] = (err[k] ?? 0) + v;
  const r = {
    concurrent_couples: per * P, seconds: Number(secs), client_processes: P,
    couples_done: lat.length, couples_per_second: +(lat.length / Number(secs)).toFixed(1),
    p50_ms: +pct(lat, 0.5)?.toFixed(1), p95_ms: +pct(lat, 0.95)?.toFixed(1), p99_ms: +pct(lat, 0.99)?.toFixed(1),
    errors: err,
  };
  console.log(JSON.stringify(r));
}
