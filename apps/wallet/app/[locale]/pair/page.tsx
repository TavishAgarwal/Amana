"use client";
import QRCode from "qrcode";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { post } from "@/lib/api";
import { createPeer, type PeerEvent } from "@/lib/check";
import { deviceKeys, loadWallet, saveWallet, sign, signedPermission, verifyWith } from "@/lib/device";
import { t } from "@/lib/i18n";
import { clientStart, serverRespond } from "@/lib/psi";
import { connect, PAIR_PREFIX, relayUrl } from "@/lib/relay";
import Scanner from "./scanner";

type Phase = "start" | "showing" | "joining" | "checking" | "result" | "error";
const SID = /^[A-Za-z0-9_-]{16,64}$/;

// Check together: pair two phones, each computes its own yes/no, then an optional two-step reveal.
// The result and tokens stay on this phone; the relay only passes scrambled messages.
export default function Pair({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [phase, setPhase] = useState<Phase>("start");
  const [qr, setQr] = useState<{ sid: string; img: string } | null>(null);
  const [code, setCode] = useState("");
  const [shared, setShared] = useState<boolean | null>(null);
  const [genes, setGenes] = useState<string[] | null>(null);
  const [cards, setCards] = useState<Record<string, string | null>>({});
  const [iAgreed, setIAgreed] = useState(false), [theyAgreed, setTheyAgreed] = useState(false);
  const [err, setErr] = useState("");
  const conn = useRef<ReturnType<typeof connect> | null>(null);
  const peer = useRef<ReturnType<typeof createPeer> | null>(null);
  const phaseRef = useRef<Phase>("start");
  const go = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  const fail = (reason: string) => { setErr(reason); go("error"); conn.current?.close(); };
  useEffect(() => () => conn.current?.close(), []);

  const onEvent = async (e: PeerEvent) => {
    if (e.type === "result") {
      setShared(e.shared); go("result");
      const w = await loadWallet(); if (w) await saveWallet({ ...w, last_shared: e.shared });
    } else if (e.type === "partner_consented") setTheyAgreed(true);
    else if (e.type === "revealed") setGenes(e.genes);
    else if (e.type === "error") fail(e.reason);
  };

  const begin = async (mode: "show" | "join", joinSid = "") => {
    const w = await loadWallet();
    if (!w) return fail("no_wallet");
    setCards(Object.fromEntries(w.genes.map((g) => [g.gene, g.card])));
    const keys = await deviceKeys();
    const setup = (sid: string) => {
      peer.current = createPeer({
        sid, holderPk: keys.pk, period: w.token_set.token_set.period, attestation: w.token_set.attestation_signature,
        nationalPk: w.national_pk, tokens: w.genes.map((g) => g.token),
        geneOf: Object.fromEntries(w.genes.map((g) => [g.token, g.gene])),
        sign, verify: verifyWith, psi: { clientStart, serverRespond },
        send: (m) => conn.current?.send(m), on: (e) => { void onEvent(e); },
      });
    };
    const c = connect(relayUrl(), {
      created: async (sid) => { setup(sid); setQr({ sid, img: await QRCode.toDataURL(PAIR_PREFIX + sid) }); go("showing"); },
      joined: () => {
        if (mode === "join") setup(joinSid);
        go("checking");
        void signedPermission("check_only", "partner", 1).then((signed) => post("/api/consent", { signed }));
        void peer.current?.start();
      },
      message: (m) => { void peer.current?.receive(m as { t: string }); },
      closed: () => { if (phaseRef.current === "showing" || phaseRef.current === "checking" || phaseRef.current === "joining") fail("session_closed"); },
    });
    conn.current = c;
    try { await c.ready; } catch { return fail("relay_unreachable"); }
    if (mode === "show") c.create(); else { go("joining"); c.join(joinSid); }
  };
  const joinWith = (text: string) => {
    const sid = text.trim().replace(PAIR_PREFIX, "");
    if (!SID.test(sid)) return setErr("scan_bad");
    setErr(""); void begin("join", sid);
  };
  const agree = async () => {
    setIAgreed(true);
    void signedPermission("reveal_condition", "partner", 1).then((signed) => post("/api/consent", { signed }));
    await peer.current?.consentReveal();
  };

  return (<>
    <h1>{t(locale, "pair")}</h1>
    {phase === "start" && (<>
      <p className="soft">{t(locale, "pair_help")}</p>
      <div className="card"><button onClick={() => begin("show")}>{t(locale, "show_code")}</button></div>
      <div className="card"><h2>{t(locale, "enter_code")}</h2>
        <Scanner locale={locale} onCode={joinWith} />
        <form onSubmit={(e) => { e.preventDefault(); joinWith(code); }}>
          <label>{t(locale, "code_label")}{" "}<input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" /></label>
          <p><button type="submit" className="secondary" disabled={!code.trim()}>{t(locale, "join")}</button></p></form>
        {err === "scan_bad" && <p role="alert" className="soft">{t(locale, "scan_bad")}</p>}</div>
    </>)}
    {phase === "showing" && qr && (<div className="card">
      <p>{t(locale, "qr")}</p>
      <img src={qr.img} alt={t(locale, "qr")} width={220} height={220} />
      <p className="muted" dir="ltr" style={{ overflowWrap: "anywhere" }}>{qr.sid}</p>
      <p role="status" className="soft">{t(locale, "waiting_partner")}</p></div>)}
    {(phase === "joining" || phase === "checking") && <p role="status" className="soft">{t(locale, "checking")}</p>}
    {phase === "result" && shared !== null && (<div className="card" role="status">
      <h2>{t(locale, shared ? "shared_yes" : "shared_no")}</h2>
      {shared && !genes && (<>
        <p>{t(locale, "reveal_info")}</p>
        {!iAgreed ? <button onClick={agree}>{t(locale, "show_cond")}</button> : <p className="soft">{t(locale, theyAgreed ? "checking" : "waiting")}</p>}
        {!iAgreed && theyAgreed && <p className="soft">{t(locale, "partner_agreed")}</p>}
        <p><Link className="btn secondary" href={`/${locale}/sharing`}>{t(locale, "talk")}</Link></p></>)}
      {genes && (<><h3>{t(locale, "revealed")}</h3>
        {genes.map((g) => <p key={g}><strong dir="ltr">{g}</strong>{" "}{cards[g] && <Link className="btn secondary" href={`/${locale}/teach-back/${cards[g]}`}>{t(locale, "read_card")}</Link>}</p>)}
        <p className="soft">{t(locale, "options")}</p>
        <Link className="btn secondary" href={`/${locale}/sharing`}>{t(locale, "talk")}</Link></>)}
    </div>)}
    {phase === "error" && (<div className="card" role="alert">
      <p>{t(locale, err === "no_wallet" ? "no_wallet" : err === "relay_unreachable" ? "relay_down" : "check_failed")}</p>
      {err !== "no_wallet" && err !== "relay_unreachable" && <p className="muted" dir="ltr">{err}</p>}
      <Link className="btn" href={`/${locale}/${err === "no_wallet" ? "welcome" : "pair"}`} onClick={() => { if (err !== "no_wallet") location.reload(); }}>{t(locale, err === "no_wallet" ? "signin" : "again")}</Link></div>)}
  </>);
}
