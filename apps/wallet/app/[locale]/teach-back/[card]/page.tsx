"use client";
import { use, useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { t } from "@/lib/i18n";

type Q = { q: string; options: string[]; answer: number };
export default function Card({ params }: { params: Promise<{ locale: string; card: string }> }) {
  const { locale, card } = use(params);
  const [c, setC] = useState<{ text: string; review_status: string; sources: string[]; teachback: Q[] } | null>(null);
  const [lit, setLit] = useState("mid");
  const [res, setRes] = useState<Record<number, boolean>>({});
  useEffect(() => { get(`/api/card/${card}?lang=${locale}`).then(setC); }, [card, locale]);
  if (!c) return null;
  const pick = (i: number, j: number) => {
    const ok = j === c.teachback[i].answer;
    setRes((r) => ({ ...r, [i]: ok }));
    post("/api/teachback", { card, q: i, correct: ok, lang: locale, literacy: lit });
  };
  return (<>
    <article className="card"><p>{c.text}</p>
      <p className="muted">{t(locale, "review")}: <span className="badge">{c.review_status}</span></p>
      <p className="muted">{t(locale, "sources")}: {c.sources.join(", ")}</p></article>
    <p className="soft">{t(locale, "options")}</p>
    <h2>{t(locale, "teachback")}</h2>
    <label>{t(locale, "literacy")}{" "}<select value={lit} onChange={(e) => setLit(e.target.value)}>
      {["low", "mid", "high"].map((x) => <option key={x} value={x}>{t(locale, x)}</option>)}</select></label>
    {c.teachback.map((q, i) => (<fieldset className="card" key={i}><legend>{q.q}</legend>
      {q.options.map((o, j) => <button className="secondary" key={j} onClick={() => pick(i, j)}>{o}</button>)}
      {i in res && <p role="status">{res[i] ? t(locale, "correct") : t(locale, "notyet")}</p>}</fieldset>))}
  </>);
}
