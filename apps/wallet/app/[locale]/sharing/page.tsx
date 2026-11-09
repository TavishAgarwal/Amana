"use client";
import { use, useCallback, useEffect, useState } from "react";
import { post } from "@/lib/api";
import { deviceKeys, loadWallet, sign, signedPermission, signedRequest, type WalletPkg } from "@/lib/device";
import { t } from "@/lib/i18n";
import NoWallet from "@/components/no-wallet";

type S = { permissions: { id: string; grantee: string; type: string; revoked: boolean }[]; audit: { ts: number; action: string; who: string }[]; chain_ok: boolean };
// Every request here is signed by this phone's device key; nobody else can read or change these permissions.
export default function Sharing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [w, setW] = useState<WalletPkg | null | undefined>(undefined);
  const [s, setS] = useState<S | null>(null);
  const load = useCallback(async () => { const r = await post("/api/sharing", await signedRequest("list")); if (r.ok) setS(r.data); }, []);
  useEffect(() => { loadWallet().then((x) => { setW(x); if (x) void load(); }); }, [load]);
  if (w === undefined) return null;
  if (!w) return <NoWallet locale={locale} />;
  const share = async () => {
    const couple_result = w.credential.credential.couple_result ?? (w.last_shared ? "incompatible" : null);
    await post("/api/consent", { signed: await signedPermission("share_counsellor", "c-001"), couple_result });
    await load();
  };
  const revoke = async (id: string) => {
    await post("/api/revoke", { holder_pk: (await deviceKeys()).pk, permission: id, sig: await sign({ revoke: id }) });
    await load();
  };
  if (!s) return null;
  return (<>
    <h1>{t(locale, "sharing")}</h1>
    <h2>{t(locale, "perm")}</h2>
    {s.permissions.length === 0 && <p className="soft">{t(locale, "none_perm")}</p>}
    {s.permissions.map((p) => (<div className="card" key={p.id}>{p.type} → {p.grantee}{" "}
      {p.revoked ? <span className="badge">{t(locale, "revoked")}</span> : <button className="secondary" onClick={() => revoke(p.id)}>{t(locale, "revoke")}</button>}</div>))}
    <button onClick={share}>{t(locale, "share")}</button>
    <h2>{t(locale, "log")}</h2>
    <p role="status">{t(locale, s.chain_ok ? "chain_ok" : "chain_bad")}</p>
    <table><tbody>{s.audit.map((a, i) => <tr key={i}><td>{new Date(a.ts * 1000).toLocaleTimeString()}</td><td>{a.action}</td><td dir="ltr">{a.who}</td></tr>)}</tbody></table>
  </>);
}
