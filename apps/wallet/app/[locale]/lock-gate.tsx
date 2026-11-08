"use client";
import { useEffect, useState, type ReactNode } from "react";
import { hasPin, isUnlocked, unlock } from "@/lib/vault";
import { t } from "@/lib/i18n";

// Shows a PIN screen before any page when the user has set an app lock.
export default function LockGate({ locale, children }: { locale: string; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [bad, setBad] = useState(false);
  useEffect(() => { setLocked(hasPin() && !isUnlocked()); setReady(true); }, []);
  if (!ready) return null;
  if (!locked) return <>{children}</>;
  return (
    <form className="card" onSubmit={async (e) => { e.preventDefault(); if (await unlock(pin)) setLocked(false); else { setBad(true); setPin(""); } }}>
      <h1>{t(locale, "lock_title")}</h1>
      <label>{t(locale, "pin")}{" "}<input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} /></label>
      <p><button type="submit">{t(locale, "unlock")}</button></p>
      {bad && <p role="alert" className="soft">{t(locale, "pin_bad")}</p>}
    </form>
  );
}
