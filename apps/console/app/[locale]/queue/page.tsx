"use client";
import { use, useCallback, useEffect, useState } from "react";
import { get } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useCounsellor } from "@/lib/who";
import CaseDetail from "@/components/case";
import { SLATimer, TierBadge } from "@/components/ui";

type C = { id: string; tier: number; due_at: number | null; created_at: number; slot_at: number | null; language: string; source: string; scope: string[]; signed_off: boolean };
const ICON: Record<string, string> = { result: "◐", condition: "🧬", question: "?", one_to_one: "👥" };

// C2 queue: no names, genes or questions in the list. Tier 3 first, then least time left.
export default function Queue({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [who] = useCounsellor();
  const [cases, setCases] = useState<C[]>([]);
  const [tier, setTier] = useState("all"), [status, setStatus] = useState("open"), [lang, setLang] = useState("all");
  const [sel, setSel] = useState<string | null>(null);
  const load = useCallback(() => get(`/api/cases?counsellor=${who}`).then(setCases), [who]);
  useEffect(() => { void load(); const i = setInterval(load, 2000); return () => clearInterval(i); }, [load]);
  const shown = cases.filter((c) => (tier === "all" || String(c.tier) === tier) && (lang === "all" || c.language === lang)
    && (status === "all" || (status === "open") !== c.signed_off))
    .sort((a, b) => b.tier - a.tier || (a.due_at ?? Infinity) - (b.due_at ?? Infinity));
  const sel_ = (name: string, v: string, set: (x: string) => void, opts: [string, string][]) => (<label className="small">{t(locale, name)}{" "}
    <select value={v} onChange={(e) => set(e.target.value)}>{opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>);
  return (<>
    <h1>{t(locale, "queue")}</h1>
    <div className="row" style={{ marginBlockEnd: 12 }}>
      {sel_("tier", tier, setTier, [["all", t(locale, "all")], ["3", "3"], ["2", "2"], ["1", "1"]])}
      {sel_("status", status, setStatus, [["open", t(locale, "open_cases")], ["done", t(locale, "done_cases")], ["all", t(locale, "all")]])}
      {sel_("language", lang, setLang, [["all", t(locale, "all")], ["ar", "العربية"], ["en", "English"]])}
      <span className="small muted">{shown.length} / {cases.length}</span>
    </div>
    <div className="split">
      <div>
        {shown.length === 0 && <p className="soft">{t(locale, "none")}</p>}
        {shown.map((c) => (<button key={c.id} className="card queue-row secondary" aria-current={sel === c.id} onClick={() => setSel(c.id)}
          style={{ inlineSize: "100%", textAlign: "start", color: "var(--text)", borderColor: c.tier === 3 ? "var(--info)" : "var(--border)" }}>
          <TierBadge locale={locale} tier={c.tier} />
          <span><span className="small">{t(locale, "src_" + c.source)} · {c.language === "ar" ? "ع" : "EN"}</span><br />
            <span role="img" aria-label={c.scope.map((s) => t(locale, "scope_" + s)).join(", ")} title={c.scope.map((s) => t(locale, "scope_" + s)).join(", ")}>{c.scope.map((s) => ICON[s]).join(" ") || "–"}</span></span>
          {c.signed_off ? <span className="badge ok">{t(locale, "done_cases")}</span> : <SLATimer locale={locale} created={c.created_at} due={c.due_at} />}
        </button>))}
      </div>
      <div>{sel ? <CaseDetail key={sel} locale={locale} id={sel} counsellor={who} onChange={load} /> : <p className="muted">{t(locale, "pick_case")}</p>}</div>
    </div>
  </>);
}
