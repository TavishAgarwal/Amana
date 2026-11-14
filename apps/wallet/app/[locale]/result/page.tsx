"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { get } from "@/lib/api";
import { loadWallet, verifyWallet, type WalletPkg } from "@/lib/device";
import { t } from "@/lib/i18n";
import NoWallet from "@/components/no-wallet";
import { TileCard } from "@/components/card";
import { Icon, Label, PrivacyNote, Rail, ResultPanel } from "@/components/ui";

// Where a gene sits in the dot matrix. Only a picture: the same gene always lands on the same dot.
const spot = (gene: string, n: number) => [...gene].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % n;

/** One dot per gene on the panel; the genes this person carries are the dark ones. */
function GeneDots({ locale, genes, n }: { locale: string; genes: string[]; n: number }) {
  const on = new Set<number>();
  for (const g of genes) { let i = spot(g, n); while (on.has(i)) i = (i + 1) % n; on.add(i); }
  const near = (i: number, d: number) => [...on].some((j) => Math.abs(j - i) === d);
  const cols = Math.ceil(n / 3);
  return (<figure style={{ margin: 0 }}>
    <div className="dots" style={{ ["--cols" as string]: cols }} role="img"
      aria-label={t(locale, "dots_alt").replace("{k}", String(genes.length)).replace("{n}", String(n))}>
      {Array.from({ length: n }, (_, i) => <i key={i} style={{ ["--i" as string]: i }}
        className={on.has(i) ? "on" : near(i, 1) ? "near2" : near(i, 2) ? "near" : ""} />)}
    </div>
    <figcaption className="dots-key" aria-hidden="true"><span>1</span><span>{t(locale, "dots_key")}</span><span>{n}</span></figcaption>
  </figure>);
}

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
  const cred = w.credential.credential as typeof w.credential.credential & { issued_at?: number };
  const cr = cred.couple_result;
  const k = w.genes.length;
  const date = cred.issued_at ? new Date(cred.issued_at * 1000).toLocaleDateString(locale === "ar" ? "ar-AE" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  const tiles = [
    ...w.genes.filter((g) => g.card).map((g) => <TileCard key={g.gene} locale={locale} code={g.card!} gene={g.gene} />),
    <TileCard key="basics" locale={locale} code="carrier-basics" title={t(locale, "basics")} />,
  ];
  return (<div>
    <section className="hero" aria-labelledby="res-title">
      <h1 id="res-title" style={{ marginBlockEnd: 2, fontSize: "1.6rem" }}>{t(locale, "result")}</h1>
      <p className="sub">{t(locale, "res_sub").replace("{date}", date)}</p>
      <p className="big serif" aria-hidden="true">{k}<small>{t(locale, "res_of").replace("{n}", String(n))}</small></p>
      <p className="line" id="genes"><strong>{k === 0 ? t(locale, "none_n").replace("{n}", String(n))
        : t(locale, k === 1 ? "carry_one" : "carry_many").replace("{k}", String(k))}</strong></p>
      <GeneDots locale={locale} genes={w.genes.map((g) => g.gene)} n={n} />
      {k > 0 && <div className="chips">{w.genes.map((g) => <span key={g.gene} className="chip ltr">{g.gene}</span>)}</div>}
    </section>
    <PrivacyNote locale={locale} center />
    {ok === false && <p className="banner-warn" role="alert">{t(locale, "not_verified")}</p>}
    {cr && (cr === "incompatible"
      ? <ResultPanel title={t(locale, "prog_incompatible")} line={t(locale, "prog_incompatible_line")}>
          <Link className="btn" href={`/${locale}/help?book=1&from=programme`}>{t(locale, "share_counsellor")}</Link></ResultPanel>
      : <ResultPanel title={t(locale, "prog_compatible")} line={t(locale, k ? "prog_compatible_carrier" : "prog_compatible_none")}>
          <Link className="btn" href={k ? `#cards` : `/${locale}/card/carrier-basics`}>{t(locale, k ? "what_it_means" : "learn_more")}</Link></ResultPanel>)}
    <section className="card">
      <Label icon="lines">{t(locale, "res_about")}</Label>
      <p className="serif" style={{ fontSize: "1.15rem", lineHeight: 1.45, marginBlock: "4px 8px" }}>{t(locale, k > 0 ? "carriers_healthy" : "none_line")}</p>
      {ok && <p className="small muted" style={{ marginBlockEnd: 0 }}>✓ {t(locale, "verified")}</p>}
    </section>
    <section id="cards">
      <Label icon="cards" as="h2">{t(locale, "your_cards")}</Label>
      <Rail label={t(locale, "your_cards")}>{tiles}</Rail>
    </section>
    <div className="stack" style={{ marginBlockStart: 8 }}>
      <Link className="btn ink block" href={`/${locale}/help#ask`}><Icon name="ask" />{t(locale, "ask_anything")}</Link>
      <Link className="btn secondary block" href={`/${locale}/help`}>{t(locale, "talk")}</Link>
    </div>
  </div>);
}
