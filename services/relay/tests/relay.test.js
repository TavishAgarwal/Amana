import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { createRelay, scrub } from "../src/server.js";

const open = (port) => new Promise((res) => { const w = new WebSocket(`ws://localhost:${port}`); w.on("open", () => res(w)); });
const next = (w) => new Promise((res) => w.once("message", (d) => res(JSON.parse(d))));

test("pair, forward opaque payload, log has no payload, nothing stored", async () => {
  const logs = [];
  const r = createRelay({ log: (m) => logs.push(m) });
  const port = r.wss.address().port;
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
  const port = r.wss.address().port;
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
