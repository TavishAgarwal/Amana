"use client";
import { use, useState } from "react";
import { get } from "@/lib/api";
import { t } from "@/lib/i18n";

type A = { attempts: [string, string][]; plain_hash_matching_leaks: string[]; amana_leaks: string[] };
export default function Attack({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [a, setA] = useState<A | null>(null);
  return (<>
    <p className="demo-banner">{t(locale, "demo_banner")}</p>
    <h1>{t(locale, "attack")}</h1>
    <p>{t(locale, "attack_line")}</p>
    <button onClick={() => get("/api/attack").then(setA)}>{t(locale, "run")}</button>
    {a && (<div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
      <div className="card"><h2>AMANA</h2>{a.attempts.map(([n, r]) => <p key={n}><code dir="ltr">{n}</code>: <span className="badge">{t(locale, "rejected")}</span> <span className="muted" dir="ltr">{r.replace("rejected:", "")}</span></p>)}
        <p>{t(locale, "amana_leaks")}: <strong>{t(locale, "nothing")}</strong></p></div>
      <div className="card"><h2>SHA-256</h2><p>{t(locale, "plain")}:</p><p dir="ltr"><strong>{a.plain_hash_matching_leaks.join(", ")}</strong></p></div></div>)}
  </>);
}
