"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { get } from "@/lib/api";
import { t } from "@/lib/i18n";

type C = { id: string; tier: number; due_at: number | null; created_at: number };
export default function Queue({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [cases, setCases] = useState<C[]>([]);
  useEffect(() => { const f = () => get("/api/cases").then(setCases); f(); const i = setInterval(f, 2000); return () => clearInterval(i); }, []);
  const sorted = [...cases].sort((a, b) => b.tier - a.tier);
  return (<>
    <h1>{t(locale, "queue")}</h1>
    {sorted.length === 0 && <p className="soft">{t(locale, "none")}</p>}
    {sorted.map((c) => (<div key={c.id} className={`card ${c.tier === 3 ? "tier3" : ""}`}>
      <strong>{t(locale, "tier")} {c.tier}</strong>{" "}
      {c.due_at && <span className="badge">{t(locale, "due")}: {new Date(c.due_at * 1000).toLocaleString(locale)}</span>}{" "}
      <Link className="btn secondary" href={`/${locale}/case/${c.id}`}>{t(locale, "open")}</Link></div>))}
  </>);
}
