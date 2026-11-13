"use client";
import { useMemo, useState } from "react";
import { post } from "@/lib/api";
import { randomHex } from "@/lib/device";
import { t } from "@/lib/i18n";
import { Steps } from "./ui";

export type Q = { q: string; options: string[]; answer: number };
/** One question per screen, gentle feedback that gives the right answer, no grades.
 *  Answers are sent with a random id made fresh for this quiz, never the device key or a name. */
export function TeachBack({ locale, card, questions, stage = "after", literacy, onDone }: {
  locale: string; card: string; questions: Q[]; stage?: "before" | "after"; literacy: string; onDone?: () => void;
}) {
  const attempt = useMemo(() => randomHex(8), []);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  if (!questions.length) return null;
  if (i >= questions.length) return <p className="soft" role="status">{t(locale, "tb_done")}</p>;
  const q = questions[i];
  const pick = (j: number) => {
    if (picked !== null) return;
    setPicked(j);
    void post("/api/teachback", { card, q: i, correct: j === q.answer, lang: locale, literacy, stage, attempt });
  };
  const next = () => { setPicked(null); if (i + 1 >= questions.length) onDone?.(); setI(i + 1); };
  return (<fieldset>
    <legend>{t(locale, "teachback")}</legend>
    <Steps locale={locale} n={i + 1} of={questions.length} />
    <p><strong>{q.q}</strong></p>
    <div className="answers">{q.options.map((o, j) => (
      <button key={j} className="secondary" aria-pressed={picked === j} onClick={() => pick(j)} disabled={picked !== null && picked !== j}>{o}</button>))}</div>
    {picked !== null && stage === "after" && (<p role="status" className="soft">
      {picked === q.answer ? t(locale, "correct") : `${t(locale, "notyet_answer")} ${q.options[q.answer]}.`}</p>)}
    {picked !== null && <button onClick={next}>{t(locale, i + 1 < questions.length ? "next" : "finish")}</button>}
  </fieldset>);
}

export function LiteracyPick({ locale, value, onChange }: { locale: string; value: string; onChange: (v: string) => void }) {
  return (<label>{t(locale, "literacy")}{" "}<select value={value} onChange={(e) => onChange(e.target.value)}>
    {["low", "mid", "high"].map((x) => <option key={x} value={x}>{t(locale, x)}</option>)}</select></label>);
}
