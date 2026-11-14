"use client";
import Link from "next/link";
import { use, useState } from "react";
import { t } from "@/lib/i18n";
import { AskBox, ConditionCard, useCardOr } from "@/components/card";
import { LiteracyPick, TeachBack } from "@/components/teachback";

// W4 condition card + teach-back + questions answered from reviewed cards only.
export default function CardPage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = use(params);
  const c = useCardOr(code, locale);
  const [lit, setLit] = useState("mid");
  if (!c) return null;
  if (c === "missing") return (<div className="card"><h1>{t(locale, "nf_title")}</h1><p>{t(locale, "card_missing")}</p>
    <div className="row"><Link className="btn" href={`/${locale}/card/carrier-basics`}>{t(locale, "basics")}</Link>
      <Link className="btn secondary" href={`/${locale}/result`}>{t(locale, "nf_home")}</Link></div></div>);
  return (<div>
    <ConditionCard locale={locale} c={c} />
    <p className="soft">{t(locale, "options")}</p>
    {c.teachback && c.teachback.length > 0 && (<section>
      <p className="small muted">{t(locale, "tb_private")}</p>
      <LiteracyPick locale={locale} value={lit} onChange={setLit} />
      <TeachBack locale={locale} card={code} questions={c.teachback} literacy={lit} />
    </section>)}
    <AskBox locale={locale} card={code} />
    <Link className="btn secondary block" href={`/${locale}/help`}>{t(locale, "talk")}</Link>
  </div>);
}
