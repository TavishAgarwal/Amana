"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { get } from "@/lib/api";
import { t } from "@/lib/i18n";
import { ConditionCard, type CardData } from "@/components/card";
import { LiteracyPick, TeachBack, type Q } from "@/components/teachback";
import { Steps } from "@/components/ui";

type Study = { letter: string; card: CardData; questions: Q[] };
// Understanding study (docs/study-kit.md): the same 3 questions after a typical lab letter ("before")
// and after the AMANA card ("after"). Anonymous: language, reading comfort and answers only.
export default function StudyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [s, setS] = useState<Study | null>(null);
  const [step, setStep] = useState(1);
  const [lit, setLit] = useState("mid");
  const [agree, setAgree] = useState(false);
  const [down, setDown] = useState(false);
  useEffect(() => { get(`/api/study?lang=${locale}`).then((x) => (x?.questions ? setS(x) : setDown(true))).catch(() => setDown(true)); }, [locale]);
  if (down) return (<div className="stack"><p className="banner-warn" role="alert">{t(locale, "api_down")}</p>
    <Link className="btn secondary block" href={`/${locale}/welcome`}>{t(locale, "back")}</Link></div>);
  if (!s) return null;
  return (<div>
    <Steps locale={locale} n={step} of={4} />
    {step === 1 && (<div className="stack">
      <h1>{t(locale, "study_title")}</h1>
      <p>{t(locale, "study_intro")}</p>
      <ul>{["study_p1", "study_p2", "study_p3"].map((k) => <li key={k}>{t(locale, k)}</li>)}</ul>
      <LiteracyPick locale={locale} value={lit} onChange={setLit} />
      <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>{t(locale, "study_agree")}</span></label>
      <button className="block" disabled={!agree} onClick={() => setStep(2)}>{t(locale, "study_start")}</button>
    </div>)}
    {step === 2 && (<>
      <h1>{t(locale, "study_letter_title")}</h1>
      <p className="small muted">{t(locale, "study_letter_note")}</p>
      <article className="card" style={{ fontFamily: "ui-serif, Georgia, serif" }}><p style={{ margin: 0 }}>{s.letter}</p></article>
      <TeachBack locale={locale} card="beta-thalassaemia" questions={s.questions} stage="before" literacy={lit} onDone={() => setStep(3)} />
    </>)}
    {step === 3 && (<>
      <h1>{t(locale, "study_card_title")}</h1>
      <ConditionCard locale={locale} c={s.card} />
      <TeachBack locale={locale} card="beta-thalassaemia" questions={s.questions} stage="after" literacy={lit} onDone={() => setStep(4)} />
    </>)}
    {step === 4 && (<div className="stack">
      <h1>{t(locale, "study_thanks")}</h1><p>{t(locale, "study_thanks_line")}</p>
      <Link className="btn block" href={`/${locale}/welcome`}>{t(locale, "continue")}</Link></div>)}
  </div>);
}
