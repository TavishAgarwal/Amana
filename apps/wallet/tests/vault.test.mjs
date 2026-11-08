import test from "node:test";
import assert from "node:assert/strict";
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k),
  get length() { return store.size; }, key: (i) => [...store.keys()][i] };
Object.defineProperty(globalThis.localStorage, "keys", { value: () => [...store.keys()] });
const orig = Object.keys; Object.keys = (o) => (o === globalThis.localStorage ? [...store.keys()] : orig(o));
const v = await import("../lib/vault.ts");

test("PIN lock encrypts data at rest and rejects a wrong PIN", async () => {
  await v.setPin("4821");
  await v.put("result.mariam.en", { carrier_cards: [{ gene: "HBB" }] });
  const raw = [...store.entries()].map(([k, x]) => k + x).join("|");
  assert.ok(!raw.includes("HBB") && !raw.includes("4821"), "plaintext or PIN leaked into storage");
  v.lock();
  assert.equal(await v.get("result.mariam.en"), null, "readable while locked");
  assert.equal(await v.unlock("0000"), false);
  assert.equal(await v.unlock("4821"), true);
  assert.deepEqual(await v.get("result.mariam.en"), { carrier_cards: [{ gene: "HBB" }] });
});
test("wipe removes everything", async () => {
  v.wipe();
  assert.equal(v.hasPin(), false);
  assert.equal([...store.keys()].filter((k) => k.startsWith("vault.")).length, 0);
});
