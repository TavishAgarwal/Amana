"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { get, usePersona } from "@/lib/api";
import * as vault from "@/lib/vault";
import { t } from "@/lib/i18n";

export default function Result({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [p] = usePersona();
  const [r, setR] = useState<{ verified: boolean; carrier_cards: { gene: string; card: string | null }[] } | null>(null);
  const [offline, setOffline] = useState(false);
  type R = NonNullable<typeof r>;
  useEffect(() => {
    get(`/api/result/${p}?lang=${locale}`).then((d: R) => { setR(d); setOffline(false); void vault.put(`result.${p}.${locale}`, d); })
      .catch(async () => { const c = await vault.get<R>(`result.${p}.${locale}`); if (c) { setR(c); setOffline(true); } });
  }, [p, locale]);
  if (!r) return null;
  return (<>
    <h1>{t(locale, "result")}</h1>
    <p className="soft">{t(locale, "verified")}</p>
    {offline && <p role="status" className="soft">{t(locale, "offline_copy")}</p>}
    {r.carrier_cards.length === 0 ? <p>{t(locale, "none")}</p> : <p>{t(locale, "carrier_intro")}</p>}
    {r.carrier_cards.map((c) => (
      <div className="card" key={c.gene}><strong dir="ltr">{c.gene}</strong>
        {c.card && <p><Link className="btn secondary" href={`/${locale}/teach-back/${c.card}`}>{t(locale, "read_card")}</Link></p>}</div>))}
  </>);
}
