"use client";
import { use, useEffect, useState } from "react";
import { post, usePersona } from "@/lib/api";
import { t } from "@/lib/i18n";
import * as vault from "@/lib/vault";

export default function Settings({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [me] = usePersona();
  const [done, setDone] = useState(false);
  const [lockOn, setLockOn] = useState(false);
  const [pin, setPin] = useState("");
  useEffect(() => { setLockOn(vault.hasPin()); }, []);
  return (<>
    <h1>{t(locale, "settings")}</h1>
    <div className="card">
      <p className="soft">{t(locale, lockOn ? "lock_on" : "lock_off")}</p>
      {!lockOn && (<form onSubmit={async (e) => { e.preventDefault(); if (pin.length >= 4) { await vault.setPin(pin); setPin(""); setLockOn(true); } }}>
        <label>{t(locale, "set_pin")}{" "}<input type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value)} /></label>
        <p><button type="submit" disabled={pin.length < 4}>{t(locale, "save_pin")}</button></p></form>)}
      {lockOn && <button className="secondary" onClick={() => { vault.wipe(); setLockOn(false); }}>{t(locale, "remove_lock")}</button>}
    </div>
    <button onClick={async () => { await post(`/api/delete/${me}`); vault.wipe(); setLockOn(false); setDone(true); }}>{t(locale, "delete")}</button>
    {done && <p role="status">{t(locale, "done")}</p>}
  </>);
}
