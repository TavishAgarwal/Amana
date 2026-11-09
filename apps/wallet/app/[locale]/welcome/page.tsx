"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { deviceKeys, loadWallet, saveWallet, wipeDevice, type WalletPkg } from "@/lib/device";
import { t } from "@/lib/i18n";

export default function Welcome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const router = useRouter();
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [p, setP] = useState("mariam");
  const [w, setW] = useState<WalletPkg | null | undefined>(undefined);
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  useEffect(() => { get("/api/personas").then(setList); loadWallet().then(setW); }, []);
  const signIn = async () => {
    setBusy(true); setErr("");
    try {
      const tok = await post("/api/signin", { persona: p });
      const r = await post("/api/enroll", { ...tok.data, holder_pk: (await deviceKeys()).pk });
      if (!r.ok) throw new Error(r.data?.detail ?? "enroll_failed");
      await saveWallet({ ...r.data, persona: p });
      router.push(`/${locale}/result`);
    } catch (e) { setErr(String((e as Error).message)); setBusy(false); }
  };
  if (w === undefined) return null;
  return (<>
    <h1>{t(locale, "welcome")}</h1>
    {w ? (<div className="card"><p>{t(locale, "signed_in_as")} <strong>{w.name}</strong></p>
      <Link className="btn" href={`/${locale}/result`}>{t(locale, "continue")}</Link>
      <button className="secondary" onClick={async () => { await wipeDevice(); setW(null); }}>{t(locale, "switch")}</button></div>)
      : (<div className="card"><label>{t(locale, "choose")}{" "}
        <select value={p} onChange={(e) => setP(e.target.value)}>{list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <p><button onClick={signIn} disabled={busy}>{t(locale, busy ? "enrolling" : "signin")}</button></p>
        <p className="soft">{t(locale, "signin_note")}</p>
        {err && <p role="alert" className="soft" dir="ltr">{err}</p>}</div>)}
  </>);
}
