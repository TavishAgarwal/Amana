"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { post } from "@/lib/api";
import { loadWallet, signedRequest, wipeDevice } from "@/lib/device";
import { t } from "@/lib/i18n";
import * as vault from "@/lib/vault";
import { PrivacyNote } from "@/components/ui";
import { downloadModel, offerModel, removeModel, useAsk } from "@/lib/ask/load";
import { ModelOffer } from "@/components/card";

/** Which level answers questions on this phone, and the choice to add or remove the model. */
function ModelSetting({ locale }: { locale: string }) {
  const s = useAsk();
  const size = t(locale, "mb").replace("{n}", (s.bytes / 1e6).toFixed(1));
  const line = s.state === "ready" ? "model_ready" : s.state === "unsupported" ? "model_unsupported" : "model_rules";
  return (<div className="card"><p style={{ marginBlockStart: 0 }}><strong>{t(locale, "model_title")}</strong></p>
    <p>{t(locale, line).replace("{size}", size)}</p>
    {s.state === "ready" && <button className="secondary" onClick={() => void removeModel()}>{t(locale, "model_remove")}</button>}
    {s.state === "declined" && <button className="secondary" onClick={() => void downloadModel()}>{t(locale, "model_get").replace("{size}", size)}</button>}
    {(s.state === "offer" || s.state === "downloading" || s.state === "failed") && <ModelOffer locale={locale} />}
  </div>);
}

const SIZES = ["100", "115", "130"];
const setSize = (v: string) => { document.documentElement.style.fontSize = v === "100" ? "" : `${v}%`; try { localStorage.setItem("text_size", v); } catch { /* private mode */ } };

// W11: language, text size, app lock, and delete everything (with a confirm screen).
export default function Settings({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [done, setDone] = useState(false), [confirm, setConfirm] = useState(false);
  const [lockOn, setLockOn] = useState(false);
  const [pin, setPin] = useState("");
  const [size, setS] = useState("100");
  useEffect(() => { setLockOn(vault.hasPin()); try { setS(localStorage.getItem("text_size") ?? "100"); } catch { /* ignore */ } }, []);
  const other = locale === "ar" ? "en" : "ar";
  if (confirm) return (<div className="stack">
    <h1>{t(locale, "delete_title")}</h1>
    <ul>{["delete_1", "delete_2", "delete_3"].map((k) => <li key={k}>{t(locale, k)}</li>)}</ul>
    <p className="banner-warn">{t(locale, "delete_cannot_undo")}</p>
    <button className="danger block" onClick={async () => {
      if (await loadWallet()) await post("/api/withdraw", await signedRequest("withdraw_all"));
      await wipeDevice(); vault.wipe(); await removeModel(); offerModel(); setLockOn(false); setConfirm(false); setDone(true);
    }}>{t(locale, "delete_confirm")}</button>
    <button className="secondary block" onClick={() => setConfirm(false)}>{t(locale, "cancel")}</button>
  </div>);
  return (<div>
    <h1>{t(locale, "settings")}</h1>
    <PrivacyNote locale={locale} k="settings_privacy" />
    {done && <p className="soft" role="status">{t(locale, "done")}</p>}
    <div className="card spread"><span>{t(locale, "lang")}</span>
      <Link className="btn secondary" href={`/${other}/settings`} lang={other}>{other === "ar" ? "العربية" : "English"}</Link></div>
    <div className="card"><p style={{ marginBlockStart: 0 }}>{t(locale, "text_size")}</p>
      <div className="row">{SIZES.map((v) => <button key={v} className="secondary" aria-pressed={size === v} onClick={() => { setS(v); setSize(v); }}>
        <span style={{ fontSize: `${Number(v) / 100}em` }}>{t(locale, "size_" + v)}</span></button>)}</div></div>
    <div className="card">
      <p style={{ marginBlockStart: 0 }}>{t(locale, lockOn ? "lock_on" : "lock_off")}</p>
      {!lockOn && (<form onSubmit={async (e) => { e.preventDefault(); if (pin.length >= 4) { await vault.setPin(pin); setPin(""); setLockOn(true); } }}>
        <label htmlFor="pin">{t(locale, "set_pin")}</label>{" "}<input id="pin" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value)} />
        <p><button type="submit" disabled={pin.length < 4}>{t(locale, "save_pin")}</button></p></form>)}
      {lockOn && <button className="secondary" onClick={() => { vault.wipe(); setLockOn(false); }}>{t(locale, "remove_lock")}</button>}
    </div>
    <ModelSetting locale={locale} />
    <div className="card"><p style={{ marginBlockStart: 0 }}>{t(locale, "delete_line")}</p>
      <button className="danger" onClick={() => setConfirm(true)}>{t(locale, "delete")}</button></div>
    <p className="small muted">{t(locale, "about")}</p>
  </div>);
}
