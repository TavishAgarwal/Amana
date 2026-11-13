"use client";
import { useCallback, useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { t } from "@/lib/i18n";
import { SLATimer, TierBadge } from "./ui";

type Card = { title: string; gene: string; review_status: string; sources: string[]; sections: { key: string; sentences: string[] }[] };
type Case = { id: string; tier: number; summary: string; label: string; signed_off_by: string | null; created_at: number; due_at: number | null;
  slot_at: number | null; language: string; source: string; scope: string[]; question: string | null; result: string | null; note: string;
  card: Card | null; ai_draft: boolean };

// C3 case detail + C4 sign-off. Only what the person consented to is returned by the API.
export default function CaseDetail({ locale, id, counsellor, onChange }: { locale: string; id: string; counsellor: string; onChange?: () => void }) {
  const [c, setC] = useState<Case | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [ai, setAi] = useState<{ enabled: boolean; model: string | null } | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/case/${id}?counsellor=${counsellor}`);
    if (r.ok) { const x: Case = await r.json(); setC(x); setNote((n) => n || x.note || x.summary); setErr(""); } else setErr(t(locale, r.status === 403 ? "denied" : "no_case"));
  }, [id, counsellor, locale]);
  useEffect(() => { setNote(""); setReviewed(false); void load(); get("/api/ai").then(setAi); }, [load]);
  useEffect(() => { // the AI draft arrives a few seconds after the case opens
    if (!c || c.signed_off_by || !ai?.enabled || c.summary.startsWith("DRAFT prepared by AI")) return;
    const i = setInterval(async () => {
      const s = await get(`/api/case/${id}/status?counsellor=${counsellor}`).catch(() => null);
      if (!s?.ai_draft_ready) return;
      clearInterval(i);
      const r = await fetch(`/api/case/${id}?counsellor=${counsellor}`); if (!r.ok) return;
      const x: Case = await r.json();
      setC(x); setNote((n) => (n === c.summary ? x.summary : n));
    }, 2000);
    return () => clearInterval(i);
  }, [c, ai, id, counsellor]);
  if (err) return <p role="alert" className="card banner-warn">{err}</p>;
  if (!c) return null;
  const signoff = async () => {
    const r = await post(`/api/case/${id}/signoff?counsellor=${counsellor}`, { note, reviewed });
    if (r.ok) await post(`/api/case/${id}/label`, { label: "clinical_advice" });
    await load(); onChange?.();
  };
  return (<article>
    <div className="spread"><h1 style={{ margin: 0 }}>{t(locale, "case")} <span className="ltr">{c.id}</span></h1><TierBadge locale={locale} tier={c.tier} /></div>
    <div className="row small muted" style={{ marginBlock: 8 }}>
      <SLATimer locale={locale} created={c.created_at} due={c.due_at} />
      <span>{t(locale, "src_" + c.source)}</span><span>{c.language === "ar" ? "العربية" : "English"}</span>
      {c.slot_at && <span>{t(locale, "slot")}: {new Date(c.slot_at * 1000).toLocaleString(locale === "ar" ? "ar-AE" : "en-GB", { timeZone: "Asia/Dubai", dateStyle: "medium", timeStyle: "short" })}</span>}
    </div>
    <section className="card"><h2>{t(locale, "scope_title")}</h2>
      <ul>{c.scope.length === 0 && <li>{t(locale, "scope_none")}</li>}
        {c.scope.map((s) => <li key={s}>{s === "result" ? `${t(locale, "scope_result")}: ${t(locale, "res_" + c.result)}` : t(locale, "scope_" + s)}</li>)}</ul>
      <p className="small muted">{t(locale, "scope_rule")}</p></section>
    {c.question && <section className="card"><h2>{t(locale, "question")}</h2><p style={{ whiteSpace: "pre-wrap" }}>{c.question}</p></section>}
    {c.card && (<section className="card"><div className="spread"><h2 style={{ margin: 0 }}>{c.card.title} <span className="badge ltr">{c.card.gene}</span></h2>
      <span className={`badge ${c.card.review_status === "reviewed" ? "ok" : "warn"}`}>{c.card.review_status}</span></div>
      {c.card.sections.map((s) => <details key={s.key} className="section" open={s.key === "options"}><summary>{t(locale, "sec_" + s.key)}</summary>{s.sentences.map((x, i) => <p key={i}>{x}</p>)}</details>)}
      <p className="small muted">{c.card.sources.join(", ")}</p></section>)}
    <section className="card"><h2>{t(locale, "options_title")}</h2>
      <ul>{["opt_1", "opt_2", "opt_3", "opt_4"].map((k) => <li key={k}>{t(locale, k)}</li>)}</ul></section>
    <section className="card">
      <div className="spread"><h2 style={{ margin: 0 }}>{t(locale, "summary")}</h2>
        {!c.signed_off_by && <span className={`badge ${c.ai_draft ? "warn" : "info"}`}>{t(locale, c.ai_draft ? "draft_ai" : "draft_template")}{c.ai_draft && ai?.model ? ` (${ai.model})` : ""}</span>}</div>
      {c.signed_off_by ? (<><p style={{ whiteSpace: "pre-wrap" }}>{c.note}</p>
        <p className="soft">{t(locale, "signed_by")} <strong>{c.signed_off_by}</strong> · {t(locale, "label")}: <span className="badge">{t(locale, c.label === "clinical_advice" ? "advice" : "info")}</span></p></>)
        : (<>
          <label htmlFor="note" className="sr-only">{t(locale, "summary")}</label>
          <textarea id="note" rows={8} value={note} onChange={(e) => setNote(e.target.value)} />
          <label className="check"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} /><span>{t(locale, "reviewed_box")}</span></label>
          <button disabled={!reviewed || !note.trim()} onClick={signoff}>{t(locale, "signoff_send")}</button>
          <p className="small muted">{t(locale, "needs_signoff")}</p></>)}
    </section>
  </article>);
}
