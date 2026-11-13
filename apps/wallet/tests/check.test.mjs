// Two wallets run the private check against each other over the real relay (services/relay),
// with the real PSI library. Checks results on both sides, consent rules, and that no token
// ever appears in anything sent through the relay.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import PSI from "@openmined/psi.js";
import { createRelay } from "../../../services/relay/src/server.js";
const { createPeer } = await import("../lib/check.ts");
const psiLib = await import("../lib/psi.ts");
const dev = await import("../lib/device.ts");
psiLib.setPsiLoader(() => PSI());

const PERIOD = 2930;
const national = await crypto.subtle.generateKey("Ed25519", false, ["sign", "verify"]);
const nationalPk = dev.toHex(await crypto.subtle.exportKey("raw", national.publicKey));
const TOKEN = Object.fromEntries(["HBB", "GJB2", "PAH", "CFTR"].map((g) => [g, randomBytes(32).toString("hex")]));

async function wallet(genes, { forge = false, period = PERIOD } = {}) {
  const kp = await crypto.subtle.generateKey("Ed25519", false, ["sign", "verify"]);
  const pk = dev.toHex(await crypto.subtle.exportKey("raw", kp.publicKey));
  const issuer = forge ? (await crypto.subtle.generateKey("Ed25519", false, ["sign"])).privateKey : national.privateKey;
  return { pk, priv: kp.privateKey, period, genes, attestation: await dev.signWith(issuer, { holder_pk: pk, period }) };
}

const relay = createRelay({ maxPerMinute: 10_000 });
await relay.ready;
const url = `ws://localhost:${relay.address().port}`;
test.after(() => relay.close());

/** Connects two wallets through the relay; returns their events, everything they sent, and the peers. */
async function pairUp(wa, wb, tamper = (m) => m) {
  const sent = [], events = { a: [], b: [] }, peers = {};
  const sockets = {};
  const open = (name) => new Promise((res) => { const ws = new WebSocket(url); ws.onopen = () => res(ws); sockets[name] = ws; });
  const a = await open("a"), b = await open("b");
  const msgs = (ws) => { const q = []; ws.onmessage = (e) => q.push(JSON.parse(e.data)); return q; };
  const qa = msgs(a), qb = msgs(b);
  const until = async (f, ms = 8000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 10)); } return true; };
  a.send(JSON.stringify({ type: "create" }));
  await until(() => qa.some((m) => m.type === "created"));
  const sid = qa.find((m) => m.type === "created").sid;
  b.send(JSON.stringify({ type: "join", sid }));
  await until(() => qa.some((m) => m.type === "joined") && qb.some((m) => m.type === "joined"));
  for (const [name, w, ws, q] of [["a", wa, a, qa], ["b", wb, b, qb]]) {
    peers[name] = createPeer({
      sid, holderPk: w.pk, period: w.period, attestation: w.attestation, nationalPk,
      tokens: w.genes.map((g) => TOKEN[g]), geneOf: Object.fromEntries(w.genes.map((g) => [TOKEN[g], g])),
      sign: (o) => dev.signWith(w.priv, o), verify: dev.verifyWith,
      psi: { clientStart: psiLib.clientStart, serverRespond: psiLib.serverRespond },
      send: (m) => { const out = tamper(m, name); sent.push(JSON.stringify(out)); ws.send(JSON.stringify({ type: "relay", payload: JSON.stringify(out) })); },
      on: (e) => events[name].push(e),
    });
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "relay") peers[name].receive(JSON.parse(m.payload)); };
    q.length = 0;
  }
  await peers.a.start(); await peers.b.start();
  return { events, sent, peers, until, close: () => { a.close(); b.close(); } };
}
const kinds = (ev) => ev.map((e) => e.type);
const resultOf = (ev) => ev.find((e) => e.type === "result")?.shared;

test("shared gene: both phones compute yes; reveal only after both consent", async () => {
  const s = await pairUp(await wallet(["HBB", "GJB2"]), await wallet(["HBB", "PAH"]));
  assert.ok(await s.until(() => resultOf(s.events.a) !== undefined && resultOf(s.events.b) !== undefined));
  assert.equal(resultOf(s.events.a), true); assert.equal(resultOf(s.events.b), true);
  await s.peers.a.consentReveal();
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(!kinds(s.events.a).includes("revealed"), "revealed before the partner agreed");
  assert.ok(kinds(s.events.b).includes("partner_consented"));
  await s.peers.b.consentReveal();
  assert.ok(await s.until(() => kinds(s.events.a).includes("revealed") && kinds(s.events.b).includes("revealed")));
  assert.deepEqual(s.events.a.find((e) => e.type === "revealed").genes, ["HBB"]);
  assert.deepEqual(s.events.b.find((e) => e.type === "revealed").genes, ["HBB"]);
  for (const g of ["HBB", "GJB2", "PAH"]) assert.ok(!s.sent.join("|").includes(TOKEN[g]), `token for ${g} was sent`);
  s.close();
});

test("no shared gene: both phones compute no", async () => {
  const s = await pairUp(await wallet(["PAH"]), await wallet(["CFTR", "GJB2"]));
  assert.ok(await s.until(() => resultOf(s.events.a) !== undefined && resultOf(s.events.b) !== undefined));
  assert.equal(resultOf(s.events.a), false); assert.equal(resultOf(s.events.b), false);
  s.close();
});

test("forged attestation and old period are rejected before any matching", async () => {
  const f = await pairUp(await wallet(["HBB"]), await wallet(["HBB"], { forge: true }));
  assert.ok(await f.until(() => kinds(f.events.a).includes("error")));
  assert.deepEqual(f.events.a.find((e) => e.type === "error"), { type: "error", reason: "forged_token_set" });
  assert.equal(resultOf(f.events.b), undefined, "the forger must not get a result");
  f.close();
  const o = await pairUp(await wallet(["HBB"]), await wallet(["HBB"], { period: PERIOD - 1 }));
  assert.ok(await o.until(() => kinds(o.events.a).includes("error")));
  assert.equal(o.events.a.find((e) => e.type === "error").reason, "expired_token_set");
  o.close();
});

test("a second count request in one session is refused", async () => {
  const s = await pairUp(await wallet(["HBB"]), await wallet(["HBB"]), (m, who) => m);
  assert.ok(await s.until(() => resultOf(s.events.b) !== undefined));
  // A malicious client re-asks with a new request to probe single genes.
  const c = await psiLib.clientStart([TOKEN.HBB], false);
  let s2 = ""; for (const x of c.request) s2 += String.fromCharCode(x);
  s.peers.b.receive({ t: "req", mode: "count", data: btoa(s2) });
  assert.ok(await s.until(() => kinds(s.events.b).includes("error")));
  assert.equal(s.events.b.find((e) => e.type === "error").reason, "duplicate_request");
  s.close();
});
