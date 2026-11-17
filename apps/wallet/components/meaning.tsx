"use client";
// What a result means, the options, and the path to a counsellor. Shown on every result screen, so
// nobody is left with a bare yes or no. Text: messages/*.json (wm_*, opt_*, ns_*), pending clinical review.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { post } from "@/lib/api";
import { loadWallet, saveWallet, signedRequest } from "@/lib/device";
import { t } from "@/lib/i18n";
import { TeachBack, type Q } from "./teachback";
import { fmtTime, InheritanceDiagram, Label, ReviewBadge } from "./ui";

/** both: the couple share a gene. partner_clear: I carry, we share nothing. clear: neither. self: no couple result yet. */
export type Outcome = "both" | "partner_clear" | "clear" | "self";

export type MyCase = { id: string; tier: number; slot_at: number | null; counsellor: string; signed_off: boolean; label: string; note: string | null };

/** The person's own cases with counsellors, asked for with a signature made on this phone. */
export function useMyCases() {
  const [cases, setCases] = useState<MyCase[]>([]);
  const reload = useCallback(async () => {
    const r = await post("/api/my-cases", await signedRequest("my_cases")).catch(() => null);
    if (r?.ok) setCases(r.data);
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { cases, reload };
}

/** Remembers, on this phone only, that the person finished a check of understanding. */
export async function markUnderstood() {
  const w = await loadWallet();
  if (w && !w.understood) await saveWallet({ ...w, understood: true });
}

// Four dots per row, so "1 in 4" and "1 in 2" look like what they say. The words carry the meaning too.
const Chance = ({ locale, n, text }: { locale: string; n: 0 | 1 | 2; text: string }) => (
  <li><span className="odds" aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={i < n ? "on" : ""} />)}</span>
    <span><strong>{t(locale, ["wm_none", "wm_1in4", "wm_1in2"][n])}</strong>: {text}</span></li>);

/** The chance for each pregnancy, in plain words, with the four-children picture when both carry. */
export function WhatItMeans({ locale, outcome, condition, n, onUnderstood }: {
  locale: string; outcome: Outcome; condition?: string; n: number; onUnderstood?: () => void;
}) {
  const quiz: Q[] = [
    { q: t(locale, "wm_q1"), options: [t(locale, "wm_q1_a"), t(locale, "wm_q1_b"), t(locale, "wm_q1_c")], answer: 1 },
    { q: t(locale, "wm_q2"), options: [t(locale, "wm_q2_a"), t(locale, "wm_q2_b")], answer: 0 },
  ];
  const cond = condition ? t(locale, "wm_cond").replace("{c}", condition) : "";
  return (<section className="card meaning" id="meaning">
    <Label icon="lines" as="h2">{t(locale, "wm_title")}</Label>
    {outcome === "both" && (<>
      <p className="lead serif">{t(locale, "wm_both_lead").replace("{cond}", cond)}</p>
      <p className="small muted">{t(locale, "wm_each")}</p>
      <ul className="chances">
        <Chance locale={locale} n={1} text={t(locale, "wm_affected")} />
        <Chance locale={locale} n={2} text={t(locale, "wm_carrier")} />
        <Chance locale={locale} n={1} text={t(locale, "wm_neither")} />
      </ul>
      <InheritanceDiagram locale={locale} />
      <p>{t(locale, "wm_same_every")}</p>
      <details className="section">
        <summary>{t(locale, "wm_check")}</summary>
        <TeachBack locale={locale} card="couple-risk" questions={quiz} literacy="mid"
          onDone={() => { void markUnderstood(); onUnderstood?.(); }} />
      </details>
    </>)}
    {outcome === "partner_clear" && (<>
      <p className="lead serif">{t(locale, "wm_pc_lead")}</p>
      <ul className="chances">
        <Chance locale={locale} n={0} text={t(locale, "wm_pc_affected")} />
        <Chance locale={locale} n={2} text={t(locale, "wm_carrier")} />
      </ul>
      <p>{t(locale, "wm_family")} <Link href={`/${locale}/help/invite`}>{t(locale, "wm_family_link")}</Link></p>
    </>)}
    {outcome === "clear" && <p className="lead serif">{t(locale, "wm_clear_lead")}</p>}
    {outcome === "self" && (<>
      <p className="lead serif">{t(locale, "wm_self_lead")}</p>
      <ul className="chances">
        <Chance locale={locale} n={1} text={t(locale, "wm_self_both")} />
        <Chance locale={locale} n={0} text={t(locale, "wm_self_one")} />
      </ul>
      <p>{t(locale, "wm_self_next")}</p>
      <Link className="btn secondary" href={`/${locale}/pair`}>{t(locale, "wm_self_btn")}</Link>
    </>)}
    {outcome !== "both" && <p className="small muted">{t(locale, "wm_panel").replace("{n}", String(n))}</p>}
  </section>);
}

/** Every option with the same weight, in a fixed order, none highlighted. AMANA never records the choice. */
export function YourOptions({ locale }: { locale: string }) {
  return (<section className="card" id="options">
    <div className="spread"><Label icon="cards" as="h2">{t(locale, "opt_title")}</Label><ReviewBadge locale={locale} status="pending" /></div>
    <p className="lead serif">{t(locale, "opt_lead")}</p>
    <ul className="options">{[1, 2, 3, 4].map((i) => (<li key={i}>
      <h3>{t(locale, `opt_${i}_t`)}</h3><p>{t(locale, `opt_${i}_l`)}</p></li>))}</ul>
    <p>{t(locale, "opt_wait")}</p>
    <p className="small muted" style={{ marginBlockEnd: 0 }}>{t(locale, "opt_foot")}</p>
  </section>);
}

/** Where the person is on the path from result to their own decision. Built from what is on this phone. */
export function NextSteps({ locale, atRisk, cases, understood, meaningHref = "#meaning" }: {
  locale: string; atRisk: boolean; cases: MyCase[]; understood: boolean; meaningHref?: string;
}) {
  const booked = cases.find((c) => c.slot_at);
  const signed = cases.find((c) => c.signed_off);
  const steps: { key: string; done: boolean; line?: string; href?: string }[] = [
    { key: "ns_result", done: true },
    { key: "ns_understand", done: understood, href: meaningHref },
    { key: atRisk ? "ns_talk_risk" : "ns_talk", done: cases.length > 0, href: `/${locale}/help${booked ? "#cases" : "#book"}`,
      line: booked ? t(locale, "ns_booked").replace("{t}", fmtTime(locale, booked.slot_at!)) : cases.length ? t(locale, "ns_asked") : atRisk ? t(locale, "ns_priority") : undefined },
    { key: "ns_note", done: !!signed, href: cases.length ? `/${locale}/help#cases` : undefined, line: cases.length && !signed ? t(locale, "ns_note_wait") : undefined },
    { key: "ns_decide", done: false, line: t(locale, "ns_decide_line") },
  ];
  const now = steps.findIndex((s) => !s.done);
  return (<section className="card" aria-labelledby="ns-title">
    <Label icon="arrow" as="h2"><span id="ns-title">{t(locale, "ns_title")}</span></Label>
    <ol className="journey">{steps.map((s, i) => (
      <li key={s.key} className={s.done ? "done" : i === now ? "now" : ""} aria-current={i === now ? "step" : undefined}>
        <span className="mark" aria-hidden="true">{s.done ? "✓" : i + 1}</span>
        <span>{s.href && !s.done ? <Link href={s.href}>{t(locale, s.key)}</Link> : <strong>{t(locale, s.key)}</strong>}
          {s.done && <span className="sr-only"> ({t(locale, "ns_done")})</span>}
          {s.line && <span className="small muted block-line">{s.line}</span>}</span>
      </li>))}</ol>
  </section>);
}
