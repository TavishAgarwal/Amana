"use client";
import { use, useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { t } from "@/lib/i18n";
import { PairedBars, StatTile } from "@/components/ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Cell = { n: number | null; rate: number | null; hidden?: boolean };
const overall = (rows: Record<string, { before: Cell; after: Cell }>) => {
  const agg = (st: "before" | "after") => {
    let n = 0, s = 0;
    for (const r of Object.values(rows)) { const c = r[st]; if (c.n && c.rate !== null) { n += c.n; s += c.n * c.rate; } }
    return n ? s / n : null;
  };
  const b = agg("before"), a = agg("after");
  return b === null || a === null ? null : { b, a };
};

// C5: every number says n = and where it comes from (simulation, live demo, or synthetic).
export default function Dashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [d, setD] = useState<any>(null);
  const [src, setSrc] = useState<"live" | "synthetic">("live");
  const load = () => get("/api/dashboard").then(setD);
  useEffect(() => { void load(); }, []);
  if (!d) return null;
  const c = d.correctness, r = d.redteam, l = d.load, u = d.understanding?.[src];
  const o = u ? overall(u.by_language) : null;
  const pct = (x: number) => `${(x * 100).toFixed(x === 1 ? 0 : 1)}%`;
  return (<>
    <h1>{t(locale, "dashboard")}</h1>
    <div className="tiles">
      {c && <StatTile num={`${c.missed + c.false_alarms}`} label={t(locale, "tile_errors")} note={`${c.missed} ${t(locale, "missed")}, ${c.false_alarms} ${t(locale, "false_alarms")}, ${c.sides_disagree ?? 0} ${t(locale, "disagree")}`}
        n={`n = ${c.couples.toLocaleString()} ${t(locale, "couples")}`} source={t(locale, "src_sim")} />}
      {d.privacy && <StatTile num="0" label={t(locale, "tile_disclosures")} note={d.privacy.summary} source={t(locale, "src_tests")} />}
      {r && <StatTile num={`${r.directive + r.unsupported}`} label={t(locale, "tile_redteam")} note={`${r.directive} ${t(locale, "directive")}, ${r.unsupported} ${t(locale, "unsupported")}${r.benign_answered ? `, ${r.benign_answered} ${t(locale, "benign")}` : ""}`}
        n={`n = ${r.prompts} ${t(locale, "prompts")}`} source={r.ai ?? r.rewording} />}
      <StatTile num={o ? `${o.a - o.b >= 0 ? "+" : ""}${Math.round((o.a - o.b) * 100)} pts` : "–"} label={t(locale, "tile_understanding")}
        note={o ? `${pct(o.b)} → ${pct(o.a)}` : t(locale, "pending")} n={u ? `n = ${u.people}` : undefined} source={t(locale, "src_" + src)} />
    </div>

    <div className="row" style={{ marginBlock: 16 }}>
      <span>{t(locale, "data_source")}:</span>
      <button className={src === "live" ? "" : "secondary"} onClick={() => setSrc("live")}>{t(locale, "src_live")}</button>
      <button className={src === "synthetic" ? "" : "secondary"} onClick={() => setSrc("synthetic")}>{t(locale, "src_synthetic")}</button>
      {src === "synthetic" && <button className="tertiary" onClick={async () => { await post("/api/study/synthetic"); await load(); }}>{t(locale, "add_synthetic")}</button>}
    </div>
    {src === "synthetic" && <p className="demo-banner">{t(locale, "synthetic_warning")}</p>}
    <div className="tiles">
      <section className="tile"><h2>{t(locale, "understanding")}</h2><p className="small muted">{t(locale, "understanding_note")}</p>
        {u && <PairedBars locale={locale} rows={u.by_language} />}</section>
      <section className="tile"><h2>{t(locale, "fairness")}</h2><p className="small muted">{t(locale, "fairness_note")}</p>
        {u && <PairedBars locale={locale} rows={u.by_literacy} />}
        {u?.hidden_cells > 0 && <p className="small muted">{u.hidden_cells} {t(locale, "hidden_cells")}</p>}</section>
    </div>

    <h2>{t(locale, "scale")}</h2>
    <div className="tiles">
      {l && <StatTile num={`${l.ms_per_check_single_core} ms`} label={t(locale, "ms")} note={`${l.checks.toLocaleString()} ${t(locale, "checks")}, ${l.errors} ${t(locale, "errors")}. 100,000 ≈ ${l.projected_100k_core_hours} ${t(locale, "core_hours")}`}
        source={t(locale, "projection")} />}
      <StatTile num="0.11–0.21" label={t(locale, "cost")} note={t(locale, "cost_note")} source="docs/cost-model.md" />
      {c && <StatTile num={c.cross_lab ? "✓" : "✗"} label={t(locale, "cross_lab")} note={t(locale, "cross_lab_note")} source={t(locale, "src_sim")} />}
      <StatTile num="3" label={t(locale, "rollout")} note={t(locale, "rollout_note")} source={t(locale, "src_packs")} />
    </div>

    <h2>{t(locale, "ops")}</h2>
    <div className="tiles">
      <StatTile num={`${d.enrolments}`} label={t(locale, "enrolments")} source={t(locale, "src_live")} />
      {d.cases_live && <StatTile num={`${d.cases_live.total}`} label={t(locale, "cases")} note={`${t(locale, "tier")} 3: ${d.cases_live.by_tier[3]} · 2: ${d.cases_live.by_tier[2]} · 1: ${d.cases_live.by_tier[1]} · ${t(locale, "signed")}: ${d.cases_live.signed_off}`} source={t(locale, "src_live")} />}
      {d.routing && <StatTile num={`${d.routing.correct}/${d.routing.cases}`} label={t(locale, "routing")} source={t(locale, "src_sim")} />}
      {d.invites && <StatTile num={`${d.invites.accepted}/${d.invites.sent}`} label={t(locale, "invites")} note={t(locale, "invites_note")} source={t(locale, "src_live")} />}
      <StatTile num={`${d.cards.reviewed}/${d.cards.total}`} label={t(locale, "cards")} note={c ? `${t(locale, "coverage")}: ${pct(c.covered_by_card)}` : undefined} source="content/cards" />
    </div>
  </>);
}
