"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { get } from "@/lib/api";
import { loadWallet, verifyWallet, type WalletPkg } from "@/lib/device";
import { t } from "@/lib/i18n";
import NoWallet from "@/components/no-wallet";
import { CardPreview } from "@/components/card";
import { PrivacyNote, ResultPanel } from "@/components/ui";

// W3 my result + W5 programme result. Everything here comes from this phone's encrypted storage.
export default function Result({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [w, setW] = useState<WalletPkg | null | undefined>(undefined);
  const [ok, setOk] = useState<boolean | null>(null);
  const [n, setN] = useState(111);
  useEffect(() => {
    loadWallet().then(async (x) => { setW(x); if (x) setOk(await verifyWallet(x)); });
    get("/api/pack").then((p) => setN(p.panel_size)).catch(() => {});
  }, []);
  if (w === undefined) return null;
  if (!w) return <NoWallet locale={locale} />;
  const cr = w.credential.credential.couple_result;
  const k = w.genes.length;
  return (<div>
    <h1>{t(locale, "result")}</h1>
    <PrivacyNote locale={locale} />
    {ok === false && <p className="banner-warn" role="alert">{t(locale, "not_verified")}</p>}
    {cr && (cr === "incompatible"
      ? <ResultPanel title={t(locale, "prog_incompatible")} line={t(locale, "prog_incompatible_line")}>
          <Link className="btn" href={`/${locale}/help?book=1&from=programme`}>{t(locale, "share_counsellor")}</Link></ResultPanel>
      : <ResultPanel title={t(locale, "prog_compatible")} line={t(locale, k ? "prog_compatible_carrier" : "prog_compatible_none")}>
          <Link className="btn" href={k ? `#genes` : `/${locale}/card/carrier-basics`}>{t(locale, k ? "what_it_means" : "learn_more")}</Link></ResultPanel>)}
    <h2 id="genes">{k === 0 ? t(locale, "none_n").replace("{n}", String(n))
      : t(locale, k === 1 ? "carry_one" : "carry_many").replace("{k}", String(k))}</h2>
    {w.genes.map((g) => <CardPreview key={g.gene} locale={locale} code={g.card} gene={g.gene} />)}
    {k > 0 && <p className="soft">{t(locale, "carriers_healthy")}</p>}
    {ok && <p className="small muted">✓ {t(locale, "verified")}</p>}
    <div className="stack" style={{ marginBlockStart: 16 }}>
      <Link className="btn block" href={`/${locale}/pair`}>{t(locale, "check_partner")}</Link>
      <Link className="btn secondary block" href={`/${locale}/help`}>{t(locale, "talk")}</Link>
    </div>
  </div>);
}
