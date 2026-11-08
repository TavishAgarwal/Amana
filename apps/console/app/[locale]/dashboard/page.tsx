"use client";
import { use, useEffect, useState } from "react";
import { get } from "@/lib/api";
import { t } from "@/lib/i18n";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Dashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [d, setD] = useState<any>(null);
  useEffect(() => { get("/api/dashboard").then(setD); }, []);
  if (!d) return null;
  const c = d.correctness, r = d.redteam, l = d.load;
  return (<>
    <h1>{t(locale, "dashboard")}</h1>
    {c && <div className="card"><h2>{t(locale, "correctness")}</h2><p>{c.couples} {t(locale, "couples")}: {c.missed} {t(locale, "missed")}, {c.false_alarms} {t(locale, "false_alarms")} ({(c.accuracy * 100).toFixed(1)}%)</p>
      <p className="muted">{t(locale, "coverage")}: {(c.covered_by_card * 100).toFixed(1)}%</p></div>}
    {d.privacy && <div className="card"><h2>{t(locale, "privacy")}</h2><p>{d.privacy.summary}</p></div>}
    {r && <div className="card"><h2>{t(locale, "redteam")}</h2><p>{r.prompts}: {r.directive} {t(locale, "directive")}, {r.unsupported} {t(locale, "unsupported")}</p></div>}
    {l && <div className="card"><h2>{t(locale, "load")}</h2><p>{l.checks} / {l.errors} errors / {l.ms_per_check_single_core} {t(locale, "ms")}</p><p className="muted">{t(locale, "projection")}</p></div>}
    <div className="card"><h2>{t(locale, "cards")}</h2><p>{d.cards.reviewed} / {d.cards.total}</p></div>
    <div className="card"><h2>{t(locale, "understanding")}</h2><p className="muted">{t(locale, "pending")}</p></div>
    <div className="card"><h2>{t(locale, "fairness")}</h2>
      {Object.keys(d.teachback_after).length === 0 ? <p className="muted">{t(locale, "pending")}</p> :
        <table><tbody>{Object.entries(d.teachback_after).map(([k, v]: any) => <tr key={k}><td>{k}</td><td>{Math.round(v * 100)}%</td></tr>)}</tbody></table>}</div>
  </>);
}
