"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { t } from "@/lib/i18n";

// What a relative sees. No sender, no gene, no condition: only general information and a choice.
export default function Invite({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = use(params);
  const [valid, setValid] = useState<boolean | null>(null);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => { get(`/api/invite/${encodeURIComponent(id)}`).then((r) => setValid(r.valid)).catch(() => setValid(false)); }, [id]);
  if (valid === null) return null;
  if (!valid) return <div className="card"><h1>{t(locale, "invite_gone_title")}</h1><p>{t(locale, "invite_gone")}</p>
    <Link className="btn secondary" href={`/${locale}/card/carrier-basics`}>{t(locale, "basics")}</Link></div>;
  return (<div className="stack">
    <h1>{t(locale, "invite_title")}</h1>
    <p>{t(locale, "invite_text")}</p>
    <p className="soft">{t(locale, "invite_no_sender")}</p>
    <Link className="btn secondary block" href={`/${locale}/card/carrier-basics`}>{t(locale, "basics")}</Link>
    {!accepted ? <button className="block" onClick={async () => { const r = await post(`/api/invite/${encodeURIComponent(id)}/accept`); if (r.ok) setAccepted(true); }}>{t(locale, "invite_accept")}</button>
      : <p className="soft" role="status">{t(locale, "invite_thanks")}</p>}
    <p className="small muted">{t(locale, "invite_choice")}</p>
  </div>);
}
