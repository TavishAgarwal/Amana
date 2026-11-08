"use client";
import Link from "next/link";
import { use, useState } from "react";
import { post } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function Check({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [state, setState] = useState<"idle" | "busy" | boolean>("idle");
  const run = async () => {
    setState("busy");
    let pr = { a: "mariam", b: "khalid" };
    try { pr = JSON.parse(sessionStorage.getItem("pair") ?? "") ?? pr; } catch {}
    const { data } = await post("/api/check", pr);
    setState(!!data.shared_risk);
  };
  return (<>
    <h1>{t(locale, "pair")}</h1>
    <button onClick={run} disabled={state === "busy"}>{t(locale, "run")}</button>
    {state === "busy" && <p role="status">{t(locale, "checking")}</p>}
    {typeof state === "boolean" && (<div className="card" role="status"><h2>{t(locale, state ? "shared_yes" : "shared_no")}</h2>
      {state && (<><p>{t(locale, "next")}</p>
        <Link className="btn" href={`/${locale}/reveal`}>{t(locale, "show_cond")}</Link>
        <Link className="btn secondary" href={`/${locale}/sharing`}>{t(locale, "talk")}</Link></>)}</div>)}
  </>);
}
