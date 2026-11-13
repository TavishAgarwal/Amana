"use client";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

export const TierBadge = ({ locale, tier }: { locale: string; tier: number }) =>
  <span className={`tier tier-${tier}`}>{t(locale, "tier")} {tier}</span>;

/** Time left to respond, as text plus a thin bar; warning colour under 20% of the target left. */
export function SLATimer({ locale, created, due }: { locale: string; created: number; due: number | null }) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => { const i = setInterval(() => setNow(Date.now() / 1000), 30000); return () => clearInterval(i); }, []);
  if (!due) return <span className="small muted">{t(locale, "no_target")}</span>;
  const left = due - now, frac = Math.max(0, Math.min(1, left / (due - created)));
  const h = Math.floor(Math.abs(left) / 3600), m = Math.floor((Math.abs(left) % 3600) / 60);
  return (<span className={`sla ${frac < 0.2 ? "low" : ""}`}>
    <span>{left < 0 ? t(locale, "overdue") : t(locale, "left")} {h}{t(locale, "h")} {m}{t(locale, "m")}</span>
    <span className="bar" aria-hidden="true"><span style={{ inlineSize: `${frac * 100}%` }} /></span></span>);
}

export function StatTile({ num, label, note, n, source }: { num: string; label: string; note?: string; n?: string; source?: string }) {
  return (<div className="tile"><div className="num">{num}</div><div className="lab">{label}</div>
    {note && <p className="small" style={{ marginBlock: "6px 0" }}>{note}</p>}
    {(n || source) && <p className="small muted" style={{ marginBlock: "6px 0 0" }}>{n}{n && source ? " · " : ""}{source}</p>}</div>);
}

type Cell = { n: number | null; rate: number | null; hidden?: boolean };
/** Paired before/after bars per group. Hidden groups (under 5 people) show a notice, not a number. */
export function PairedBars({ locale, rows }: { locale: string; rows: Record<string, { before: Cell; after: Cell }> }) {
  const ORDER = ["ar", "en", "low", "mid", "high"];
  const keys = Object.keys(rows).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  if (!keys.length) return <p className="muted">{t(locale, "no_data")}</p>;
  const bar = (c: Cell, kind: string, label: string) => (<div className="b">
    <span className="small">{label}</span>
    {c.hidden ? <span className="small muted">{t(locale, "hidden_group")}</span>
      : <span className="track" role="img" aria-label={`${label}: ${c.rate === null ? "-" : Math.round(c.rate * 100) + "%"}`}><span className={`fill ${kind}`} style={{ display: "block", inlineSize: `${(c.rate ?? 0) * 100}%` }} /></span>}
    <span className="small">{c.rate === null ? "–" : `${Math.round(c.rate * 100)}%`}{c.n ? <span className="muted"> n={c.n}</span> : null}</span></div>);
  return (<div className="bars">{keys.map((k) => (<div key={k}><strong>{t(locale, "g_" + k)}</strong>
    {bar(rows[k].before, "before", t(locale, "before"))}{bar(rows[k].after, "after", t(locale, "after"))}</div>))}</div>);
}
