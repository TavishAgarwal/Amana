"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { loadWallet, verifyWallet, type WalletPkg } from "@/lib/device";
import { t } from "@/lib/i18n";
import NoWallet from "@/components/no-wallet";

// The result comes from this phone's encrypted storage, never from the server.
export default function Result({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [w, setW] = useState<WalletPkg | null | undefined>(undefined);
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => { loadWallet().then(async (x) => { setW(x); if (x) setOk(await verifyWallet(x)); }); }, []);
  if (w === undefined) return null;
  if (!w) return <NoWallet locale={locale} />;
  return (<>
    <h1>{t(locale, "result")}</h1>
    <p className="soft">{t(locale, "only_you")}</p>
    {ok !== null && <p className={ok ? "soft" : "card"} role="status">{t(locale, ok ? "verified" : "not_verified")}</p>}
    {w.genes.length === 0 ? <p>{t(locale, "none")}</p> : <p>{t(locale, "carrier_intro")}</p>}
    {w.genes.map((g) => (
      <div className="card" key={g.gene}><strong dir="ltr">{g.gene}</strong>
        {g.card && <p><Link className="btn secondary" href={`/${locale}/teach-back/${g.card}`}>{t(locale, "read_card")}</Link></p>}</div>))}
  </>);
}

