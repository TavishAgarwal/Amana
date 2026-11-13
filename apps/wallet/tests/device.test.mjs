import test from "node:test";
import assert from "node:assert/strict";
const dev = await import("../lib/device.ts");
const mem = new Map();
dev.useStore({ get: async (k) => mem.get(k), set: async (k, v) => { mem.set(k, v); }, clear: async () => mem.clear() });

test("canonical JSON matches Python's sort_keys + compact separators", () => {
  assert.equal(dev.canonical({ b: 1, a: [true, null, "x"], c: { z: "é", y: 2 } }), '{"a":[true,null,"x"],"b":1,"c":{"y":2,"z":"é"}}');
});

test("wallet is encrypted at rest and the device key cannot be exported", async () => {
  const pkg = { persona: "mariam", genes: [{ gene: "HBB", token: "ab".repeat(32), card: "beta-thalassaemia" }] };
  await dev.saveWallet(pkg);
  const raw = JSON.stringify([...mem.values()].map((v) => (v?.ct ? Buffer.from(v.ct).toString("latin1") : "")));
  assert.ok(!raw.includes("HBB") && !raw.includes("abab"), "plaintext in storage");
  assert.deepEqual(await dev.loadWallet(), pkg);
  const { priv, pk } = await dev.deviceKeys();
  assert.equal(priv.extractable, false);
  await assert.rejects(crypto.subtle.exportKey("pkcs8", priv));
  assert.equal((await dev.deviceKeys()).pk, pk, "same key on reload");
  const sig = await dev.sign({ op: "list", ts: 1 });
  assert.ok(await dev.verifyWith(pk, { op: "list", ts: 1 }, sig));
  assert.ok(!(await dev.verifyWith(pk, { op: "list", ts: 2 }, sig)));
  await dev.wipeDevice();
  assert.equal(await dev.loadWallet(), null);
});

test("a token set from an earlier 7-day period needs renewing", async () => {
  const { tokensStale, currentPeriod, PERIOD_SECONDS } = await import("../lib/device.ts");
  const now = 1_800_000_000_000, p = currentPeriod(now);
  const w = (period) => ({ token_set: { token_set: { period } } });
  assert.equal(p, Math.floor(now / 1000 / PERIOD_SECONDS));
  assert.equal(tokensStale(w(p), now), false);
  assert.equal(tokensStale(w(p - 1), now), true);
  assert.equal(tokensStale(w(p), now + PERIOD_SECONDS * 1000), true);
});
