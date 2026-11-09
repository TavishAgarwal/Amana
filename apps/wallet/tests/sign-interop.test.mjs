// Signatures made by the Python services verify in the browser code, and the other way round.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const dev = await import("../lib/device.ts");
const mem = new Map();
dev.useStore({ get: async (k) => mem.get(k), set: async (k, v) => { mem.set(k, v); }, clear: async () => mem.clear() });
const root = resolve(import.meta.dirname, "../../..");
const PYTHONPATH = ["packages/schemas", "services/token-service", "services/lab-issuer", "services/consent-ledger"]
  .map((p) => join(root, p)).join(":");
const peer = (cmd, dir) => execFileSync("uv", ["run", "python", join(root, "apps/wallet/tests/sign_peer.py"), cmd, dir],
  { cwd: root, stdio: "pipe", env: { ...process.env, PYTHONPATH } });

test("Python-issued result, token set and attestation verify in the wallet", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sign-"));
  const { pk } = await dev.deviceKeys();
  writeFileSync(join(dir, "holder_pk.txt"), pk);
  peer("issue", dir);
  const x = JSON.parse(readFileSync(join(dir, "issued.json"), "utf8"));
  assert.ok(await dev.verifyWallet(x));
  const ts = x.token_set.token_set;
  assert.ok(await dev.verifyWith(x.national_pk, { holder_pk: pk, period: ts.period }, x.token_set.attestation_signature));
  x.credential.credential.carrier_genes = ["PAH"];  // tampered result must fail
  assert.ok(!(await dev.verifyWallet(x)));
});

test("permission and request signed in the wallet are accepted by the Python ledger", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sign-"));
  writeFileSync(join(dir, "permission.json"), JSON.stringify(await dev.signedPermission("share_counsellor", "c-001")));
  writeFileSync(join(dir, "request.json"), JSON.stringify({ ...(await dev.signedRequest("list")), op: "list" }));
  peer("verify", dir);  // throws if Python rejects either signature
});
