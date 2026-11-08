"use client";
import { use, useCallback, useEffect, useState } from "react";
import { get, post, usePersona } from "@/lib/api";
import { t } from "@/lib/i18n";

type S = { permissions: { id: string; grantee: string; type: string; revoked: boolean }[]; audit: { ts: number; action: string; who: string }[]; chain_ok: boolean };
export default function Sharing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [me] = usePersona();
  const [s, setS] = useState<S | null>(null);
  const load = useCallback(() => { get(`/api/sharing/${me}`).then(setS); }, [me]);
  useEffect(load, [load]);
  if (!s) return null;
  return (<>
    <h1>{t(locale, "sharing")}</h1>
    <h2>{t(locale, "perm")}</h2>
    {s.permissions.length === 0 && <p className="soft">{t(locale, "none_perm")}</p>}
    {s.permissions.map((p) => (<div className="card" key={p.id}>{p.type} → {p.grantee}{" "}
      {p.revoked ? <span className="badge">{t(locale, "revoked")}</span> : <button className="secondary" onClick={async () => { await post("/api/revoke", { persona: me, permission: p.id }); load(); }}>{t(locale, "revoke")}</button>}</div>))}
    <button onClick={async () => { await post("/api/share", { persona: me }); load(); }}>{t(locale, "share")}</button>
    <h2>{t(locale, "log")}</h2>
    <p role="status">{t(locale, s.chain_ok ? "chain_ok" : "chain_bad")}</p>
    <table><tbody>{s.audit.map((a, i) => <tr key={i}><td>{new Date(a.ts * 1000).toLocaleTimeString()}</td><td>{a.action}</td><td dir="ltr">{a.who}</td></tr>)}</tbody></table>
  </>);
}
