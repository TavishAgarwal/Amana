"use client";
import { use, useCallback, useEffect, useState } from "react";
import { post } from "@/lib/api";
import { deviceKeys, loadWallet, sign, signedRequest, type WalletPkg } from "@/lib/device";
import { t } from "@/lib/i18n";
import NoWallet from "@/components/no-wallet";
import { fmtTime, PrivacyNote } from "@/components/ui";

type Perm = { id: string; grantee: string; type: string; revoked: boolean };
type S = { permissions: Perm[]; audit: { ts: number; action: string; who: string }[]; chain_ok: boolean };
const who = (locale: string, g: string) => t(locale, g.startsWith("c-") ? "who_counsellor" : g === "partner" ? "who_partner" : g === "relative" ? "who_relative" : "who_you");

// W10: every permission and every access, signed by this phone's key. Revoking works at once.
export default function Sharing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [w, setW] = useState<WalletPkg | null | undefined>(undefined);
  const [s, setS] = useState<S | null>(null);
  const [pk8, setPk8] = useState("");
  const [down, setDown] = useState(false);
  const load = useCallback(async () => {
    try { const r = await post("/api/sharing", await signedRequest("list")); if (r.ok) { setS(r.data); setDown(false); } else setDown(true); } catch { setDown(true); }
  }, []);
  useEffect(() => { loadWallet().then(async (x) => { setW(x); if (x) { setPk8((await deviceKeys()).pk.slice(0, 8)); void load(); } }); }, [load]);
  if (w === undefined) return null;
  if (!w) return <NoWallet locale={locale} />;
  const revoke = async (id: string) => {
    await post("/api/revoke", { holder_pk: (await deviceKeys()).pk, permission: id, sig: await sign({ revoke: id }) });
    await load();
  };
  if (!s) return down ? (<div><h1>{t(locale, "sharing")}</h1><p className="banner-warn" role="alert">{t(locale, "api_down")}</p>
    <button className="secondary" onClick={() => void load()}>{t(locale, "try_again")}</button></div>) : null;
  const active = s.permissions.filter((p) => !p.revoked && p.type !== "check_only" && p.type !== "reveal_condition");
  const past = s.permissions.filter((p) => p.revoked || p.type === "check_only" || p.type === "reveal_condition");
  return (<div>
    <h1>{t(locale, "sharing")}</h1>
    <PrivacyNote locale={locale} k="sharing_privacy" />
    <h2>{t(locale, "perm")}</h2>
    {active.length === 0 && <p className="soft">{t(locale, "none_perm")}</p>}
    {active.map((p) => (<div className="card spread" key={p.id}>
      <div><strong>{who(locale, p.grantee)}</strong><br /><span className="small muted">{t(locale, "ptype_" + p.type)}</span></div>
      <button className="danger" onClick={() => revoke(p.id)}>{t(locale, "revoke")}</button></div>))}
    <p className="small muted">{t(locale, "revoke_note")}</p>
    {past.length > 0 && (<details className="card"><summary>{t(locale, "past_perm")} ({past.length})</summary>
      {past.map((p) => <p key={p.id} className="small">{who(locale, p.grantee)}: {t(locale, "ptype_" + p.type)} {p.revoked && <span className="badge">{t(locale, "revoked")}</span>}</p>)}</details>)}
    <h2>{t(locale, "log")}</h2>
    <p className={s.chain_ok ? "small muted" : "banner-warn"} role="status">{s.chain_ok ? "✓ " : ""}{t(locale, s.chain_ok ? "chain_ok" : "chain_bad")}</p>
    <table><thead><tr><th>{t(locale, "log_when")}</th><th>{t(locale, "log_who")}</th><th>{t(locale, "log_what")}</th></tr></thead>
      <tbody>{[...s.audit].reverse().map((a, i) => <tr key={i}><td className="small">{fmtTime(locale, a.ts)}</td>
        <td>{a.who === pk8 ? t(locale, "who_you") : who(locale, a.who)}</td><td>{t(locale, "act_" + a.action)}</td></tr>)}</tbody></table>
  </div>);
}
