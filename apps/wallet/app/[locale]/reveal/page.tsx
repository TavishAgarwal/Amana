"use client";
import Link from "next/link";
import { use, useState } from "react";
import { post } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function Reveal({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [waiting, setWaiting] = useState<string[]>([]);
  const [genes, setGenes] = useState<{ gene: string; card: string | null }[] | null>(null);
  const [agreed, setAgreed] = useState<string[]>([]);
  let pr = { a: "mariam", b: "khalid" };
  try { pr = JSON.parse(sessionStorage.getItem("pair") ?? "") ?? pr; } catch {}
  const agree = async (who: string) => {
    const { data } = await post("/api/reveal/consent", { persona: who });
    setAgreed((a) => [...a, who]);
    if (data.genes) setGenes(data.genes); else setWaiting(data.waiting_for);
  };
  return (<>
    <h1>{t(locale, "reveal")}</h1><p className="soft">{t(locale, "reveal_info")}</p>
    {[pr.a, pr.b].map((w) => <button key={w} disabled={agreed.includes(w)} onClick={() => agree(w)}>{t(locale, "agree")} ({w})</button>)}
    {!genes && waiting.length > 0 && <p role="status">{t(locale, "waiting")}</p>}
    {genes && (<div className="card"><h2>{t(locale, "revealed")}</h2>
      {genes.map((g) => <p key={g.gene}><strong dir="ltr">{g.gene}</strong>{" "}{g.card && <Link className="btn secondary" href={`/${locale}/teach-back/${g.card}`}>{t(locale, "read_card")}</Link>}</p>)}
      <p className="soft">{t(locale, "options")}</p></div>)}
  </>);
}
