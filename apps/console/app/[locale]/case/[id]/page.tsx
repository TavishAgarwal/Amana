"use client";
import { use, useCallback, useEffect, useState } from "react";
import { post } from "@/lib/api";
import { t } from "@/lib/i18n";

type Case = { id: string; tier: number; summary: string; label: string; signed_off_by: string | null };
export default function CaseView({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = use(params);
  const [c, setC] = useState<Case | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const load = useCallback(async () => {
    const r = await fetch(`/api/case/${id}`);
    if (r.ok) { setC(await r.json()); setErr(""); } else setErr(t(locale, "denied"));
  }, [id, locale]);
  useEffect(() => { load(); }, [load]);
  if (err) return <p role="alert" className="card">{err}</p>;
  if (!c) return null;
  return (<>
    <h1>{t(locale, "case")} {c.id}</h1>
    <p><strong>{t(locale, "tier")} {c.tier}</strong></p>
    <div className="card"><h2>{t(locale, "summary")}</h2><p>{c.summary}</p></div>
    {note && <p role="alert" className="soft">{note}</p>}
    <p>{t(locale, "label")}: <span className="badge">{t(locale, c.label === "clinical_advice" ? "advice" : "info")}</span></p>
    <button onClick={async () => { await post(`/api/case/${id}/signoff`); setNote(""); load(); }}>{t(locale, "signoff")}</button>
    <button className="secondary" onClick={async () => { const r = await post(`/api/case/${id}/label`, { label: "clinical_advice" }); if (!r.ok) setNote(t(locale, "needs_signoff")); else { setNote(""); load(); } }}>{t(locale, "set_advice")}</button>
  </>);
}
