"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { declineModel, downloadModel, useAsk } from "@/lib/ask/load";
import type { Answer } from "@/lib/ask/engine";
import { t } from "@/lib/i18n";
import { Icon, InheritanceDiagram, ReviewBadge } from "./ui";

export type CardData = { card: string; gene: string; title: string; text: string; review_status: string; sources: string[];
  sections: { key: string; sentences: string[] }[]; teachback?: { q: string; options: string[]; answer: number }[] };

/** null while loading, "missing" when there is no such card or the service cannot be reached. */
export const useCardOr = (code: string | null, locale: string) => {
  const [c, setC] = useState<CardData | null | "missing">(null);
  useEffect(() => {
    if (!code) return;
    get(`/api/card/${encodeURIComponent(code)}?lang=${locale}`).then((x) => setC(Array.isArray(x?.sections) ? x : "missing")).catch(() => setC("missing"));
  }, [code, locale]);
  return c;
};
export const useCard = (code: string | null, locale: string) => {
  const c = useCardOr(code, locale);
  return c === "missing" ? null : c;
};

/** Short preview on the home screen: title, first line, "Learn more". */
export function CardPreview({ locale, code, gene }: { locale: string; code: string | null; gene: string }) {
  const c = useCard(code, locale);
  return (<div className="card">
    <div className="spread"><h3 style={{ margin: 0 }}>{c?.title ?? <span className="ltr">{gene}</span>}</h3><span className="badge ltr">{gene}</span></div>
    {c && <p>{c.sections.find((s) => s.key === "carrier")?.sentences[0]}</p>}
    {code ? <Link className="btn secondary" href={`/${locale}/card/${code}`}>{t(locale, "learn_more")}</Link>
      : <p className="muted small">{t(locale, "no_card_yet")}</p>}
  </div>);
}

/** A tinted card in the swipe row on My result: gene, condition, first line, round arrow. */
export function TileCard({ locale, code, gene, title }: { locale: string; code: string; gene?: string; title?: string }) {
  const c = useCard(code, locale);
  const line = c?.sections.find((s) => s.key === "carrier")?.sentences[0] ?? c?.sections[0]?.sentences[0] ?? c?.text;
  return (<Link className="tile-card" href={`/${locale}/card/${code}`}>
    {gene && <span className="badge ltr">{gene}</span>}
    <h3>{title ?? c?.title ?? gene}</h3>
    {line && <p>{line}</p>}
    <span className="go" aria-hidden="true"><span className="flip"><Icon name="arrow" /></span></span>
  </Link>);
}

/** The reviewed card in the design's sections. Every sentence is shown word for word. */
export function ConditionCard({ locale, c }: { locale: string; c: CardData }) {
  const [simple, setSimple] = useState(false);
  const { engine } = useAsk();
  // Key points are chosen on the phone, from the same reviewed sentences.
  const kp = simple && engine ? engine.keyPoints(c.card, locale === "ar" ? "ar" : "en") : null;
  const toggle = () => setSimple((s) => !s);
  return (<article className="card">
    <ReviewBadge locale={locale} status={c.review_status} />
    <h1 style={{ marginBlock: "8px 4px" }}>{c.title}</h1>
    {c.review_status !== "reviewed" && <p className="small muted">{t(locale, "pending_review_why")}</p>}
    <p><button className="secondary" aria-pressed={simple} onClick={toggle} disabled={!engine}>{t(locale, simple ? "full_card" : "simpler")}</button></p>
    {simple && kp ? (<div className="soft">
      <ul>{kp.sentences.map((s, i) => <li key={i}>{s}</li>)}</ul>
      <p className="small muted" style={{ marginBlockEnd: 0 }}>{t(locale, "selected_note")}</p>
      <InheritanceDiagram locale={locale} /></div>)
      : c.sections.map((s, i) => (<details className="section" key={s.key} open={i < 2}>
        <summary>{t(locale, "sec_" + s.key)}</summary>
        {s.sentences.map((x, j) => <p key={j}>{x}</p>)}
        {s.key === "both" && <InheritanceDiagram locale={locale} />}
      </details>))}
    <p className="small muted">{t(locale, "sources")}: {c.sources.join(", ")}</p>
  </article>);
}

const mb = (locale: string, bytes: number) => t(locale, "mb").replace("{n}", (bytes / 1e6).toFixed(1));

/** Offers the on-device model once, with its size. Download and Not now are equal; nothing downloads unasked. */
export function ModelOffer({ locale }: { locale: string }) {
  const s = useAsk();
  if (s.state === "downloading") return (<div className="soft" role="status">
    <p style={{ marginBlockStart: 0 }}>{t(locale, "model_downloading")} {Math.round(s.progress * 100)}%</p>
    <progress value={s.progress} max={1} style={{ inlineSize: "100%" }} aria-label={t(locale, "model_downloading")} /></div>);
  if (s.state === "failed") return (<div className="soft" role="status">
    <p style={{ marginBlockStart: 0 }}>{t(locale, "model_failed")}</p>
    <button className="secondary" onClick={() => void downloadModel()}>{t(locale, "try_again")}</button></div>);
  if (s.state !== "offer") return null;
  const metered = s.device?.cellular || s.device?.saveData || s.device?.slow;
  return (<div className="soft">
    <p style={{ marginBlockStart: 0 }}><strong>{t(locale, "model_offer_title")}</strong></p>
    <p>{t(locale, "model_offer_body").replace("{size}", mb(locale, s.bytes))}</p>
    {metered && <p className="banner-warn">{t(locale, "model_mobile_data").replace("{size}", mb(locale, s.bytes))}</p>}
    <div className="choices">
      <button type="button" onClick={() => void downloadModel()}>{t(locale, "model_download").replace("{size}", mb(locale, s.bytes))}</button>
      <button type="button" className="secondary" onClick={declineModel}>{t(locale, "not_now")}</button>
    </div>
  </div>);
}

/** Questions are answered on this phone, only with sentences from reviewed cards. The question is
 *  never sent anywhere. Decision questions get a fixed reply that points to a counsellor. */
export function AskBox({ locale, card }: { locale: string; card?: string }) {
  const [q, setQ] = useState(""), [a, setA] = useState<Answer | null>(null);
  const { engine, error } = useAsk();
  return (<form className="card" onSubmit={(e) => {
    e.preventDefault(); if (!q.trim() || !engine) return;
    setA(engine.answer(q, locale === "ar" ? "ar" : "en", card ?? null));
  }}>
    <label htmlFor="ask"><strong>{t(locale, "ask_title")}</strong></label>
    <p className="small muted" style={{ marginBlock: "4px 8px" }}>{t(locale, "ask_note")}</p>
    <textarea id="ask" value={q} maxLength={500} onChange={(e) => setQ(e.target.value)} />
    <p><button type="submit" disabled={!engine || !q.trim()}>{t(locale, engine ? "ask" : "thinking")}</button></p>
    {error && !engine && <p className="small muted">{t(locale, "ask_offline")}</p>}
    {a && (<div className="soft" role="status">
      <p style={{ marginBlockStart: 0 }}>{a.text}</p>
      <p className="small muted" style={{ marginBlockEnd: 0 }}>
        {a.card ? t(locale, "from_card") : t(locale, "from_none")} {a.card && <ReviewBadge locale={locale} status={a.review_status || "pending"} />}
        {" · "}{t(locale, a.selected_by === "on-device" ? "picked_model" : "picked_rules")}</p>
      {a.card && a.card !== "carrier-basics" && a.card !== card && <p style={{ marginBlockEnd: 0 }}><Link href={`/${locale}/card/${a.card}`}>{t(locale, "learn_more")}</Link></p>}
    </div>)}
    <ModelOffer locale={locale} />
  </form>);
}
