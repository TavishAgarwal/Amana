import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { createRelay, scrub } from "../src/server.js";

const open = (port) => new Promise((res) => { const w = new WebSocket(`ws://localhost:${port}`); w.on("open", () => res(w)); });
const next = (w) => new Promise((res) => w.once("message", (d) => res(JSON.parse(d))));

test("pair, forward opaque payload, log has no payload, nothing stored", async () => {
  const logs = [];
  const r = createRelay({ log: (m) => logs.push(m) });
  await r.ready; const port = r.address().port;
  const a = await open(port), b = await open(port);
  a.send(JSON.stringify({ type: "create" }));
  const { sid } = await next(a);
  b.send(JSON.stringify({ type: "join", sid }));
  await next(a); await next(b);
  const secret = "ab".repeat(32) + " HBB";
  const got = next(b);
  a.send(JSON.stringify({ type: "relay", payload: secret }));
  assert.equal((await got).payload, secret);
  assert.ok(!logs.join(" ").includes("abab"));
  a.close(); await new Promise((r2) => setTimeout(r2, 50));
  assert.equal(r.sessions.size, 0);
  b.close(); r.close();
});

test("expired and reused sessions refused", async () => {
  const r = createRelay({ ttlMs: 10 });
  await r.ready; const port = r.address().port;
  const a = await open(port);
  a.send(JSON.stringify({ type: "create" }));
  const { sid } = await next(a);
  await new Promise((r2) => setTimeout(r2, 30));
  const b = await open(port);
  const closed = new Promise((res) => b.on("close", (code) => res(code)));
  b.send(JSON.stringify({ type: "join", sid }));
  assert.equal(await closed, 1008);
  a.close(); r.close();
});

test("scrub removes token-like hex", () => assert.equal(scrub("x " + "f".repeat(64)), "x [token]"));

test("serves wss:// when given a certificate (phones on a LAN need it)", async (t) => {
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, readFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "relay-tls-"));
  try {
    execFileSync("openssl", ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-days", "1",
      "-subj", "/CN=localhost", "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem")], { stdio: "ignore" });
  } catch { t.skip("openssl not available"); return; }
  const r = createRelay({ tls: { cert: readFileSync(join(dir, "cert.pem")), key: readFileSync(join(dir, "key.pem")) } });
  await r.ready;
  const w = new WebSocket(`wss://localhost:${r.address().port}`, { rejectUnauthorized: false });
  await new Promise((res, rej) => { w.on("open", res); w.on("error", rej); });
  w.send(JSON.stringify({ type: "create" }));
  const m = await next(w);
  assert.equal(m.type, "created");
  w.close(); r.close();
});

test("rate limit counts the forwarded client address only when the proxy is trusted", async () => {
  const { clientIp } = await import("../src/server.js");
  const req = { headers: { "x-forwarded-for": "6.6.6.6, 10.0.0.9" }, socket: { remoteAddress: "10.0.0.1" } };
  assert.equal(clientIp(req, false), "10.0.0.1");
  assert.equal(clientIp(req, true), "10.0.0.9");
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: "10.0.0.1" } }, true), "10.0.0.1");
});

test("health check answers over plain HTTP", async () => {
  const r = createRelay();
  await r.ready;
  const res = await fetch(`http://localhost:${r.address().port}/healthz`);
  assert.equal(res.status, 200);
  assert.equal((await fetch(`http://localhost:${r.address().port}/`)).status, 404);
  r.close();
});
