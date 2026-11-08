// Interop test: the browser PSI library (@openmined/psi.js) against the Python library the helper service uses.
// JS client <-> Python server, and Python client <-> JS server, in count-only and reveal modes.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import PSI from "@openmined/psi.js";

const FPR = 1e-9, PAD_TO = 128;
const root = resolve(import.meta.dirname, "../../..");
const peer = (cmd, dir) =>
  execFileSync("uv", ["run", "python", join(root, "apps/wallet/tests/psi_peer.py"), cmd, dir], { cwd: root, stdio: "pipe" });
const tok = () => randomBytes(16).toString("hex");
const set = (shared) => [...shared, ...Array.from({ length: PAD_TO - shared.length }, tok)];
const psi = await PSI();

function scenario(shared, reveal) {
  const common = Array.from({ length: shared }, tok);
  const dir = mkdtempSync(join(tmpdir(), "psi-"));
  writeFileSync(join(dir, "reveal.json"), JSON.stringify(reveal));
  return { dir, client: set(common), server: set(common), common };
}

for (const reveal of [false, true]) for (const shared of [0, 3]) {
  test(`JS client <-> Python server (reveal=${reveal}, shared=${shared})`, () => {
    const s = scenario(shared, reveal);
    const client = psi.client.createWithNewKey(reveal);
    writeFileSync(join(s.dir, "server_items.json"), JSON.stringify(s.server));
    writeFileSync(join(s.dir, "request.bin"), client.createRequest(s.client).serializeBinary());
    peer("server-respond", s.dir);
    const setup = psi.serverSetup.deserializeBinary(readFileSync(join(s.dir, "setup.bin")));
    const resp = psi.response.deserializeBinary(readFileSync(join(s.dir, "response.bin")));
    if (!reveal) assert.equal(client.getIntersectionSize(setup, resp), shared);
    else assert.deepEqual([...client.getIntersection(setup, resp)].map((i) => s.client[i]).sort(), [...s.common].sort());
  });

  test(`Python client <-> JS server (reveal=${reveal}, shared=${shared})`, () => {
    const s = scenario(shared, reveal);
    writeFileSync(join(s.dir, "client_items.json"), JSON.stringify(s.client));
    peer("client-request", s.dir);
    const server = psi.server.createWithNewKey(reveal);
    const setup = server.createSetupMessage(FPR, PAD_TO, s.server, psi.dataStructure.GCS);
    const resp = server.processRequest(psi.request.deserializeBinary(readFileSync(join(s.dir, "request.bin"))));
    writeFileSync(join(s.dir, "setup.bin"), setup.serializeBinary());
    writeFileSync(join(s.dir, "response.bin"), resp.serializeBinary());
    peer("client-finish", s.dir);
    const out = JSON.parse(readFileSync(join(s.dir, "result.json"), "utf8"));
    if (!reveal) assert.equal(out.size, shared);
    else assert.deepEqual(out.idx.map((i) => s.client[i]).sort(), [...s.common].sort());
  });
}
