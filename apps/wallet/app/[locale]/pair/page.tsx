"use client";
import QRCode from "qrcode";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { post } from "@/lib/api";
import { createPeer, type PeerEvent } from "@/lib/check";
import { deviceKeys, loadWallet, saveWallet, sign, signedPermission, tokensStale, verifyWith } from "@/lib/device";
import { t } from "@/lib/i18n";
import { clientStart, serverRespond } from "@/lib/psi";
import { connect, PAIR_PREFIX, relayUrl } from "@/lib/relay";
import { CardPreview } from "@/components/card";
import { ConsentSheet, PrivacyNote, ResultPanel } from "@/components/ui";
import Scanner from "./scanner";

type Phase = "start" | "showing" | "joining" | "checking" | "result" | "error";
const SID = /^[A-Za-z0-9_-]{16,64}$/;
const QR_SECONDS = 300;

// W6–W8: pair two phones in person, each computes its own yes/no, then an optional two-step reveal.
// The result and tokens stay on this phone; the relay only passes scrambled messages.
export default function Pair({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [phase, setPhase] = useState<Phase>("start");
  const [ask, setAsk] = useState<null | { mode: "show" | "join"; sid?: string }>(null);
  const [revealAsk, setRevealAsk] = useState(false);
  const [qr, setQr] = useState<{ sid: string; img: string; at: number } | null>(null);
  const [left, setLeft] = useState(QR_SECONDS);
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
  useEffect(() => {
    if (phase !== "showing" || !qr) return;
    const i = setInterval(() => {
      const l = QR_SECONDS - Math.floor((Date.now() - qr.at) / 1000);
      setLeft(l); if (l <= 0) fail("code_expired");
    }, 1000);
    return () => clearInterval(i);
  }, [phase, qr]);

  const onEvent = async (e: PeerEvent) => {
    if (e.type === "result") {
      setShared(e.shared); go("result");
      const w = await loadWallet(); if (w) await saveWallet({ ...w, last_shared: e.shared });
    } else if (e.type === "partner_consented") setTheyAgreed(true);
    else if (e.type === "revealed") {
      setGenes(e.genes);
      const w = await loadWallet();
      if (w) await saveWallet({ ...w, last_revealed: e.genes.map((g) => ({ gene: g, card: w.genes.find((x) => x.gene === g)?.card ?? null })) });
    } else if (e.type === "error") fail(e.reason);
  };

  // Sign in again to fetch this period's token set. The mock sign-in stands in for UAE PASS here.
  const [renewing, setRenewing] = useState(false);
  const renew = async () => {
    setRenewing(true);
    const w = await loadWallet();
    const tok = w && await post("/api/signin", { persona: w.persona });
    const r = tok?.ok && await post("/api/enroll", { ...tok.data, holder_pk: (await deviceKeys()).pk });
    setRenewing(false);
    if (!w || !r || !r.ok) return setErr("renew_failed");
    await saveWallet({ ...w, ...r.data, persona: w.persona });
    setErr(""); go("start");
  };

  const begin = async (mode: "show" | "join", joinSid = "") => {
    const w = await loadWallet();
    if (!w) return fail("no_wallet");
    if (tokensStale(w)) return fail("codes_old");
    setCards(Object.fromEntries(w.genes.map((g) => [g.gene, g.card])));
    void signedPermission("check_only", "partner", 1).then((signed) => post("/api/consent", { signed }));
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
      created: async (sid) => { setup(sid); setQr({ sid, img: await QRCode.toDataURL(PAIR_PREFIX + sid, { margin: 1, width: 440 }), at: Date.now() }); go("showing"); },
      joined: () => { if (mode === "join") setup(joinSid); go("checking"); void peer.current?.start(); },
      message: (m) => { void peer.current?.receive(m as { t: string }); },
      closed: () => { if (["showing", "checking", "joining"].includes(phaseRef.current)) fail("session_closed"); },
    });
    conn.current = c;
    try { await c.ready; } catch { return fail("relay_unreachable"); }
    if (mode === "show") c.create(); else { go("joining"); c.join(joinSid); }
  };
  const joinWith = (text: string) => {
    const sid = text.trim().replace(PAIR_PREFIX, "");
    if (!SID.test(sid)) return setErr("scan_bad");
    setErr(""); setAsk({ mode: "join", sid });
  };
  const agreeReveal = async () => {
    setRevealAsk(false); setIAgreed(true);
    void signedPermission("reveal_condition", "partner", 1).then((signed) => post("/api/consent", { signed }));
    await peer.current?.consentReveal();
  };
  const mm = `${Math.floor(Math.max(left, 0) / 60)}:${String(Math.max(left, 0) % 60).padStart(2, "0")}`;

  return (<div>
    <h1>{t(locale, "pair")}</h1>
    <PrivacyNote locale={locale} k="pair_privacy" />
    {phase === "start" && (<>
      <p>{t(locale, "pair_help")}</p>
      <button className="block" onClick={() => setAsk({ mode: "show" })}>{t(locale, "show_code")}</button>
      <div className="card"><h2>{t(locale, "enter_code")}</h2>
        <Scanner locale={locale} onCode={joinWith} />
        <form onSubmit={(e) => { e.preventDefault(); joinWith(code); }}>
          <label htmlFor="code">{t(locale, "code_label")}</label>{" "}<input id="code" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
          <p><button type="submit" className="secondary" disabled={!code.trim()}>{t(locale, "join")}</button></p></form>
        {err === "scan_bad" && <p role="alert" className="banner-warn">{t(locale, "scan_bad")}</p>}</div>
    </>)}
    <ConsentSheet locale={locale} open={!!ask} title={t(locale, "consent_check_title")}
      items={[[t(locale, "c_what"), t(locale, "c_check_what")], [t(locale, "c_who"), t(locale, "c_check_who")],
        [t(locale, "c_long"), t(locale, "c_check_long")], [t(locale, "c_undo"), t(locale, "c_check_undo")]]}
      onCancel={() => setAsk(null)} onAgree={() => { const a = ask!; setAsk(null); void begin(a.mode, a.sid); }} />
    {phase === "showing" && qr && (<div className="card" style={{ textAlign: "center" }}>
      <p>{t(locale, "qr")}</p>
      <img src={qr.img} alt={t(locale, "qr_alt")} width={240} height={240} style={{ maxInlineSize: "100%", blockSize: "auto" }} />
      <p className="small muted">{t(locale, "qr_left")} <strong className="ltr">{mm}</strong> · {t(locale, "qr_why")}</p>
      <details><summary className="small">{t(locale, "manual_code")}</summary><p className="ltr small" style={{ overflowWrap: "anywhere" }}>{qr.sid}</p></details>
      <p role="status" className="soft">{t(locale, "waiting_partner")}</p></div>)}
    {(phase === "joining" || phase === "checking") && <div className="card" role="status"><p><strong>{t(locale, "checking")}</strong></p><p className="muted">{t(locale, "checking_line")}</p></div>}
    {phase === "result" && shared !== null && !genes && (shared
      ? <ResultPanel title={t(locale, "shared_yes")} line={t(locale, iAgreed ? (theyAgreed ? "checking" : "waiting") : "shared_yes_line")}>
          {!iAgreed && <button onClick={() => setRevealAsk(true)}>{t(locale, "show_cond")}</button>}
          <Link className="btn secondary" href={`/${locale}/help?book=1&from=private_check`}>{t(locale, "talk")}</Link></ResultPanel>
      : <ResultPanel title={t(locale, "shared_no")} line={t(locale, "shared_no_line")}>
          <Link className="btn" href={`/${locale}/result`}>{t(locale, "learn_own")}</Link>
          <Link className="btn secondary" href={`/${locale}/help`}>{t(locale, "talk")}</Link></ResultPanel>)}
    {phase === "result" && shared && !iAgreed && theyAgreed && <p className="soft">{t(locale, "partner_agreed")}</p>}
    <ConsentSheet locale={locale} open={revealAsk} title={t(locale, "reveal_ask")}
      items={[[t(locale, "c_what"), t(locale, "c_reveal_what")], [t(locale, "c_who"), t(locale, "c_reveal_who")],
        [t(locale, "c_long"), t(locale, "c_reveal_long")], [t(locale, "c_undo"), t(locale, "c_reveal_undo")]]}
      onCancel={() => setRevealAsk(false)} onAgree={agreeReveal} />
    {genes && (<>
      <ResultPanel title={t(locale, "revealed")} line={t(locale, "revealed_line")}>
        <Link className="btn" href={`/${locale}/help?book=1&from=private_check`}>{t(locale, "book")}</Link></ResultPanel>
      {genes.map((g) => <CardPreview key={g} locale={locale} code={cards[g] ?? null} gene={g} />)}
      <p className="soft">{t(locale, "options")}</p></>)}
    {phase === "error" && (err === "codes_old" || err === "renew_failed") && (<div className="card" role="alert">
      <p>{t(locale, err === "codes_old" ? "codes_old" : "renew_failed")}</p>
      <button className="block" onClick={() => void renew()} disabled={renewing}>{t(locale, renewing ? "enrolling" : "renew_codes")}</button></div>)}
    {phase === "error" && err !== "codes_old" && err !== "renew_failed" && (<div className="card" role="alert">
      <p>{t(locale, err === "no_wallet" ? "no_wallet" : err === "relay_unreachable" ? "relay_down" : err === "code_expired" ? "code_expired" : err === "expired_token_set" ? "partner_codes_old" : "check_failed")}</p>
      {!["no_wallet", "relay_unreachable", "code_expired", "expired_token_set"].includes(err) && <p className="muted small ltr">{err}</p>}
      <Link className="btn" href={`/${locale}/${err === "no_wallet" ? "welcome" : "pair"}`} onClick={() => { if (err !== "no_wallet") location.reload(); }}>{t(locale, err === "no_wallet" ? "signin" : "again")}</Link></div>)}
  </div>);
}
