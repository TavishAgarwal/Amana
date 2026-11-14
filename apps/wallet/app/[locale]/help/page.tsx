"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState, type ReactNode } from "react";
import { get, post } from "@/lib/api";
import { loadWallet, signedPermission, signedRequest, type WalletPkg } from "@/lib/device";
import { t } from "@/lib/i18n";
import NoWallet from "@/components/no-wallet";
import { AskBox, TileCard } from "@/components/card";
import { ConsentSheet, fmtTime, Label, PrivacyNote, Rail } from "@/components/ui";

type Counsellor = { id: string; name: string; languages: string[]; tiers: number[]; slots: number[] };
type MyCase = { id: string; tier: number; slot_at: number | null; counsellor: string; signed_off: boolean; label: string; note: string | null };

// W9 help: self-serve (Tier 1), ask a question (Tier 2), book one-to-one (Tier 3). Nothing is shared
// until the person agrees on a sheet that lists exactly what the counsellor will see.
export default function Help({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [w, setW] = useState<WalletPkg | null | undefined>(undefined);
  const [dir, setDir] = useState<Counsellor[]>([]);
  const [mine, setMine] = useState<MyCase[]>([]);
  const [question, setQuestion] = useState("");
  const [slot, setSlot] = useState<{ c: Counsellor; at: number } | null>(null);
  const [sheet, setSheet] = useState<null | "question" | "book">(null);
  const [withCondition, setWithCondition] = useState(false);
  const [busy, setBusy] = useState(false), [done, setDone] = useState(""), [err, setErr] = useState("");
  const [from, setFrom] = useState("");
  const loadMine = useCallback(async () => {
    try { const r = await post("/api/my-cases", await signedRequest("my_cases")); if (r.ok) setMine(r.data); } catch { /* offline: the cards and questions below still work */ }
  }, []);
  useEffect(() => {
    setFrom(new URLSearchParams(location.search).get("from") ?? "");
    loadWallet().then((x) => { setW(x); if (x) void loadMine(); });
    get(`/api/directory?lang=${locale}`).then((d) => setDir(d.counsellors ?? [])).catch(() => setErr("api_down"));
  }, [locale, loadMine]);
  useEffect(() => {
    if (!w) return;
    // The page draws after the wallet opens, so the browser's own jump to #ask or #book comes too early.
    const id = from ? "book" : location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: "center" });
  }, [from, w]);
  if (w === undefined) return null;
  if (!w) return <NoWallet locale={locale} />;

  const programme = w.credential.credential.couple_result;
  const source = programme ? "programme" : w.last_shared ? "private_check" : "self";
  const coupleResult = programme ?? (w.last_shared ? "incompatible" : null);
  const revealed = w.last_revealed?.[0];
  const resultLine = coupleResult ? t(locale, source === "programme" ? `scope_prog_${coupleResult}` : "scope_check_shared") : t(locale, "scope_none");

  const share = async (kind: "question" | "book") => {
    setBusy(true); setErr("");
    const grantee = kind === "book" ? slot!.c.id : "c-001";
    const r = await post("/api/consent", {
      signed: await signedPermission("share_counsellor", grantee, 24 * 30), couple_result: coupleResult, source, language: locale,
      question_text: kind === "question" ? question : null, slot_at: kind === "book" ? slot!.at : null,
      condition_code: kind === "book" && withCondition ? revealed?.card : null,
    });
    setBusy(false); setSheet(null);
    if (!r.ok) { setErr(r.data?.detail === "slot_taken" ? "slot_taken" : "share_failed"); return; }
    setDone(kind); setQuestion(""); setSlot(null); setWithCondition(false);
    void loadMine(); get(`/api/directory?lang=${locale}`).then((d) => setDir(d.counsellors));
  };
  const sheetItems = (kind: "question" | "book"): [string, ReactNode][] => [
    [t(locale, "c_what"), (<ul style={{ margin: 0, paddingInlineStart: 18 }}>
      <li>{resultLine}</li>
      {kind === "question" && <li>{t(locale, "scope_question")}: “{question.slice(0, 120)}{question.length > 120 ? "…" : ""}”</li>}
      {kind === "book" && <li>{t(locale, "scope_slot")}: {fmtTime(locale, slot!.at)}</li>}
      {kind === "book" && withCondition && revealed && <li>{t(locale, "scope_condition")}: <span className="ltr">{revealed.gene}</span></li>}
      <li>{t(locale, "scope_not")}</li></ul>)],
    [t(locale, "c_who"), kind === "book" ? slot!.c.name : dir.find((c) => c.id === "c-001")?.name ?? "c-001"],
    [t(locale, "c_long"), t(locale, "c_share_long")],
    [t(locale, "c_undo"), t(locale, "c_share_undo")],
  ];

  return (<div>
    <h1>{t(locale, "help")}</h1>
    <PrivacyNote locale={locale} k="help_privacy" />
    {done && <p className="soft" role="status">{t(locale, done === "book" ? "booked" : "question_sent")}</p>}
    {err && <p className="banner-warn" role="alert">{t(locale, err)}</p>}

    {mine.length > 0 && (<section><h2>{t(locale, "my_cases")}</h2>
      {mine.map((c) => (<div className="card" key={c.id}>
        <div className="spread"><strong>{c.counsellor}</strong>
          <span className={`badge ${c.signed_off ? "ok" : "info"}`}>{t(locale, c.signed_off ? "case_answered" : "case_waiting")}</span></div>
        {c.slot_at && <p>{t(locale, "scope_slot")}: {fmtTime(locale, c.slot_at)}</p>}
        {c.note && (<div className="soft"><p className="small muted" style={{ marginBlockStart: 0 }}>{t(locale, c.label === "clinical_advice" ? "label_advice" : "label_signed")}</p><p style={{ marginBlockEnd: 0, whiteSpace: "pre-wrap" }}>{c.note}</p></div>)}
      </div>))}</section>)}

    <section><Label icon="cards" as="h2">{t(locale, "tier1_title")}</Label><p className="muted" style={{ marginBlockStart: 0 }}>{t(locale, "tier1_line")}</p>
      <Rail label={t(locale, "tier1_title")}>{[
        ...w.genes.filter((g) => g.card).map((g) => <TileCard key={g.gene} locale={locale} code={g.card!} gene={g.gene} />),
        <TileCard key="basics" locale={locale} code="carrier-basics" title={t(locale, "basics")} />]}</Rail></section>
    <AskBox locale={locale} />

    <section className="card"><h2>{t(locale, "tier2_title")}</h2><p>{t(locale, "tier2_line")}</p>
      <label htmlFor="q" className="sr-only">{t(locale, "tier2_title")}</label>
      <textarea id="q" value={question} maxLength={500} onChange={(e) => setQuestion(e.target.value)} placeholder={t(locale, "tier2_placeholder")} />
      <p><button disabled={!question.trim()} onClick={() => setSheet("question")}>{t(locale, "send_question")}</button></p></section>

    <section className="card" id="book"><h2>{t(locale, "tier3_title")}</h2>
      <p>{t(locale, coupleResult === "incompatible" ? "tier3_line_priority" : "tier3_line")}</p>
      {dir.map((c) => (<div key={c.id}><p><strong>{c.name}</strong> <span className="small muted">{c.languages.map((l) => (l === "ar" ? "العربية" : "English")).join(" · ")}</span></p>
        {c.slots.length === 0 && <p className="soft">{t(locale, "no_slots")}</p>}
        <div className="slots">{c.slots.map((s) => (<button key={s} className="secondary" aria-pressed={slot?.at === s && slot.c.id === c.id}
          onClick={() => setSlot({ c, at: s })}>{fmtTime(locale, s)}</button>))}</div></div>))}
      <p><button disabled={!slot} onClick={() => setSheet("book")}>{t(locale, "book")}</button></p></section>

    <section className="card"><h2>{t(locale, "family_title")}</h2><p>{t(locale, "family_line")}</p>
      <Link className="btn secondary" href={`/${locale}/help/invite`}>{t(locale, "family_btn")}</Link></section>
    <p className="small"><Link href={`/${locale}/study`}>{t(locale, "study_link")}</Link></p>

    <ConsentSheet locale={locale} open={sheet !== null} busy={busy} title={t(locale, sheet === "book" ? "consent_book_title" : "consent_q_title")}
      items={sheet ? sheetItems(sheet) : []} onCancel={() => setSheet(null)} onAgree={() => share(sheet!)}>
      {sheet === "book" && revealed && (<label className="check"><input type="checkbox" checked={withCondition} onChange={(e) => setWithCondition(e.target.checked)} />
        <span>{t(locale, "share_condition")} (<span className="ltr">{revealed.gene}</span>)</span></label>)}
    </ConsentSheet>
  </div>);
}
