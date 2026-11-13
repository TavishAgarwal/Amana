"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { deviceKeys, loadWallet, saveWallet, wipeDevice, type WalletPkg } from "@/lib/device";
import { t } from "@/lib/i18n";
import { Steps } from "@/components/ui";

// W1 welcome + language, W2 sign in. The result is sent once to this phone and kept here, encrypted.
export default function Welcome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const router = useRouter();
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [p, setP] = useState("mariam");
  const [w, setW] = useState<WalletPkg | null | undefined>(undefined);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  useEffect(() => { get("/api/personas").then(setList).catch(() => setErr("api_down")); loadWallet().then(setW); }, []);
  const signIn = async () => {
    setBusy(true); setErr("");
    try {
      const tok = await post("/api/signin", { persona: p });
      if (!tok.ok) throw new Error("signin_failed");
      const r = await post("/api/enroll", { ...tok.data, holder_pk: (await deviceKeys()).pk });
      if (!r.ok) throw new Error(r.data?.detail ?? "enroll_failed");
      await saveWallet({ ...r.data, persona: p });
      router.push(`/${locale}/result`);
    } catch (e) { setErr(String((e as Error).message)); setBusy(false); }
  };
  if (w === undefined) return null;
  if (w) return (<div className="stack">
    <h1>{t(locale, "welcome_back")}</h1>
    <div className="card"><p>{t(locale, "signed_in_as")} <strong>{w.name}</strong></p>
      <Link className="btn block" href={`/${locale}/result`}>{t(locale, "continue")}</Link>
      <button className="tertiary" onClick={async () => { await wipeDevice(); setW(null); }}>{t(locale, "switch")}</button></div>
  </div>);
  return (<div className="stack">
    <Steps locale={locale} n={step} of={2} />
    {step === 1 ? (<>
      <h1 style={{ fontSize: "2rem", color: "var(--primary)", letterSpacing: ".08em" }}>AMANA</h1>
      <p style={{ fontSize: "1.25rem" }}>{t(locale, "promise")}</p>
      <div className="row">
        <Link className={`btn ${locale === "ar" ? "" : "secondary"}`} href="/ar/welcome" lang="ar">العربية</Link>
        <Link className={`btn ${locale === "en" ? "" : "secondary"}`} href="/en/welcome" lang="en">English</Link>
      </div>
      <details className="card"><summary><strong>{t(locale, "how_protect")}</strong></summary>
        <ul>{["protect_1", "protect_2", "protect_3", "protect_4"].map((k) => <li key={k}>{t(locale, k)}</li>)}</ul></details>
      <button className="block" onClick={() => setStep(2)}>{t(locale, "continue")}</button>
      <p className="small"><Link href={`/${locale}/study`}>{t(locale, "study_link")}</Link></p>
    </>) : (<>
      <h1>{t(locale, "signin_title")}</h1>
      <p>{t(locale, "signin_receives")}</p>
      <div className="card"><label htmlFor="persona">{t(locale, "choose")}</label>{" "}
        <select id="persona" value={p} onChange={(e) => setP(e.target.value)}>{list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <p className="small muted">{t(locale, "persona_hint")}</p></div>
      <button className="block" onClick={signIn} disabled={busy || !list.length}>{t(locale, busy ? "enrolling" : "signin")}</button>
      <p className="small muted">{t(locale, "signin_note")}</p>
      {err && <p role="alert" className="banner-warn">{t(locale, err === "api_down" ? "api_down" : "signin_failed")} <span className="ltr small muted">{err}</span></p>}
      <button className="tertiary" onClick={() => setStep(1)}>{t(locale, "back")}</button>
    </>)}
  </div>);
}
