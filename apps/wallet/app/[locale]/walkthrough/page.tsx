"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { t } from "@/lib/i18n";

/** Where the console runs: NEXT_PUBLIC_CONSOLE_URL; on a host named after the wallet (Azure: amana-wallet.…),
 *  the same name with "console"; locally, the wallet's port plus one (3010→3011, 3030→3031). */
function useConsoleUrl() {
  const [url, setUrl] = useState(process.env.NEXT_PUBLIC_CONSOLE_URL ?? "");
  useEffect(() => {
    if (url) return;
    const { protocol, hostname, port } = location;
    if (!port && hostname.includes("wallet")) setUrl(`${protocol}//${hostname.replace("wallet", "console")}`);
    else setUrl(`${protocol}//${hostname}:${Number(port || (protocol === "https:" ? 443 : 80)) + 1}`);
  }, [url]);
  return url;
}

// A guided route for reviewers: one at-risk couple, from result to a signed counsellor note, in about 5 minutes.
export default function Walkthrough({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const consoleUrl = useConsoleUrl();
  const steps: [string, string | null, string?][] = [
    ["walk_1", `/${locale}/welcome?as=layla`, "walk_1_btn"],
    ["walk_2", `/${locale}/result#meaning`, "walk_2_btn"],
    ["walk_3", `/${locale}/help?book=1&from=programme`, "walk_3_btn"],
    ["walk_4", consoleUrl ? `${consoleUrl}/${locale}/queue` : null, "walk_4_btn"],
    ["walk_5", null],
    ["walk_6", `/${locale}/help#cases`, "walk_6_btn"],
    ["walk_7", null],
  ];
  return (<div>
    <h1>{t(locale, "walk_title")}</h1>
    <p className="lead serif">{t(locale, "walk_lead")}</p>
    <section className="card">
      <ol className="journey">{steps.map(([k, href, btn], i) => (
        <li key={k}><span className="mark" aria-hidden="true">{i + 1}</span>
          <span><span className="block-line">{t(locale, k)}</span>
            {href && btn && (href.startsWith("http")
              ? <a className="btn secondary" href={href} target="_blank" rel="noreferrer">{t(locale, btn)}</a>
              : <Link className="btn secondary" href={href}>{t(locale, btn)}</Link>)}</span></li>))}</ol>
    </section>
    <section className="card">
      <h2>{t(locale, "walk_pair_title")}</h2>
      <p>{t(locale, "walk_pair")}</p>
      <Link className="btn secondary" href={`/${locale}/pair`}>{t(locale, "check_partner")}</Link>
    </section>
    <p className="small muted">{t(locale, "walk_note")}</p>
  </div>);
}
