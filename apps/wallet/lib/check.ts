// The private couple check between two phones, over the relay. Same protocol as sim/eval/protocol.py.
// 1. Each side sends a hello: national attestation (period + device key) and a signature over the
//    session id. Tokens are never sent, so a partner cannot match them directly.
// 2. Each side runs PSI once as client in count mode and computes its OWN yes/no.
// 3. Reveal: each side signs a consent. A side answers a reveal request only after both consents.
// Each side answers at most one count and one reveal request per session.
// No imports: PSI, signing and transport are passed in, so the same code runs in the browser and in tests.

export type Psi = {
  clientStart(tokens: string[], reveal: boolean): Promise<{ request: Uint8Array; finish(s: Uint8Array, r: Uint8Array): { count?: number; shared?: string[] } }>;
  serverRespond(tokens: string[], request: Uint8Array, reveal: boolean): Promise<{ setup: Uint8Array; response: Uint8Array }>;
};
export type PeerEvent =
  | { type: "verified" } | { type: "result"; shared: boolean } | { type: "partner_consented" }
  | { type: "revealed"; genes: string[] } | { type: "error"; reason: string };
export type PeerDeps = {
  sid: string; holderPk: string; period: number; attestation: string; nationalPk: string;
  tokens: string[]; geneOf: Record<string, string>;
  sign(obj: unknown): Promise<string>; verify(pk: string, obj: unknown, sig: string): Promise<boolean>;
  psi: Psi; send(msg: Record<string, unknown>): void; on(e: PeerEvent): void;
};
type Mode = "count" | "reveal";
type Msg = { t: string; [k: string]: unknown };

const b64 = (u: Uint8Array) => { let s = ""; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function createPeer(d: PeerDeps) {
  let partner: string | null = null, failed = false, mine = false, theirs = false;
  const pending: Msg[] = [], answered = { count: false, reveal: false };
  const asking: Record<Mode, Awaited<ReturnType<Psi["clientStart"]>> | null> = { count: null, reveal: null };
  const fail = (reason: string) => { if (!failed) { failed = true; d.on({ type: "error", reason }); } };

  async function ask(mode: Mode) {
    const c = await d.psi.clientStart(d.tokens, mode === "reveal");
    asking[mode] = c;
    d.send({ t: "req", mode, data: b64(c.request) });
  }
  async function answer(mode: Mode, data: string) {
    if (answered[mode]) return fail("duplicate_request");
    answered[mode] = true;
    const r = await d.psi.serverRespond(d.tokens, unb64(data), mode === "reveal");
    d.send({ t: "resp", mode, setup: b64(r.setup), response: b64(r.response) });
  }
  async function flush() { for (const m of pending.splice(0)) await handle(m); }

  async function handle(m: Msg) {
    if (failed) return;
    if (m.t === "hello") {
      if (partner) return fail("duplicate_hello");
      const pk = String(m.holder_pk), period = Number(m.period);
      if (pk === d.holderPk) return fail("self_pairing");
      if (!(await d.verify(d.nationalPk, { holder_pk: pk, period }, String(m.attestation)))) return fail("forged_token_set");
      if (period !== d.period) return fail("expired_token_set");
      if (!(await d.verify(pk, { sid: d.sid }, String(m.proof)))) return fail("replayed_token_set");
      partner = pk;
      d.on({ type: "verified" });
      await ask("count");
      return flush();
    }
    if (!partner) { pending.push(m); return; }  // nothing is answered before the partner is verified
    if (m.t === "req" && m.mode === "count") return answer("count", String(m.data));
    if (m.t === "req" && m.mode === "reveal") {
      if (mine && theirs) return answer("reveal", String(m.data));
      pending.push(m); return;  // held until both have agreed
    }
    if (m.t === "resp") {
      const mode = m.mode as Mode, c = asking[mode];
      if (!c) return fail("unexpected_response");
      asking[mode] = null;
      const out = c.finish(unb64(String(m.setup)), unb64(String(m.response)));
      if (mode === "count") return d.on({ type: "result", shared: (out.count ?? 0) > 0 });
      return d.on({ type: "revealed", genes: (out.shared ?? []).map((t) => d.geneOf[t]).filter(Boolean).sort() });
    }
    if (m.t === "consent") {
      if (theirs) return;
      if (!(await d.verify(partner, { sid: d.sid, reveal: true }, String(m.sig)))) return fail("bad_consent");
      theirs = true;
      d.on({ type: "partner_consented" });
      return flush();
    }
    fail("bad_message");
  }

  let chain = Promise.resolve();
  const run = (f: () => Promise<unknown>) => { chain = chain.then(f).then(() => undefined, (e) => fail(String(e))); return chain; };
  return {
    start: () => run(async () => d.send({ t: "hello", period: d.period, holder_pk: d.holderPk,
      attestation: d.attestation, proof: await d.sign({ sid: d.sid }) })),
    receive: (m: Msg) => run(() => handle(m)),
    consentReveal: () => run(async () => {
      if (mine || !partner) return;
      mine = true;
      d.send({ t: "consent", sig: await d.sign({ sid: d.sid, reveal: true }) });
      await ask("reveal");
      await flush();
    }),
  };
}
