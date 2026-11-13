"use client";
import { use, useState } from "react";
import { post } from "@/lib/api";
import { signedPermission } from "@/lib/device";
import { t } from "@/lib/i18n";
import { ConsentSheet } from "@/components/ui";

// W12: anonymous family invite. The relative sees no sender, no gene and no condition.
export default function InviteRelatives({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState(""), [copied, setCopied] = useState(false);
  const make = async () => {
    setOpen(false);
    const r = await post("/api/consent", { signed: await signedPermission("family_invite", "relative", 24 * 30) });
    if (r.ok) setLink(`${location.origin}/${locale}/invite/${r.data.invite}`);
  };
  return (<div>
    <h1>{t(locale, "family_title")}</h1>
    <p>{t(locale, "invite_explain")}</p>
    <h2>{t(locale, "invite_preview")}</h2>
    <blockquote className="card" style={{ margin: 0 }}><p style={{ marginBlockStart: 0 }}>{t(locale, "invite_text")}</p>
      <p className="small muted" style={{ marginBlockEnd: 0 }}>{t(locale, "invite_text_note")}</p></blockquote>
    <p className="small muted">{t(locale, "invite_counts")}</p>
    {!link ? <button className="block" onClick={() => setOpen(true)}>{t(locale, "invite_make")}</button> : (<div className="card">
      <p className="ltr small" style={{ overflowWrap: "anywhere" }}>{link}</p>
      <div className="row">
        <button onClick={async () => { await navigator.clipboard?.writeText(link); setCopied(true); }}>{t(locale, copied ? "copied" : "copy_link")}</button>
        {typeof navigator !== "undefined" && "share" in navigator && <button className="secondary" onClick={() => navigator.share({ text: t(locale, "invite_text"), url: link }).catch(() => {})}>{t(locale, "share_link")}</button>}
      </div><p className="small muted">{t(locale, "invite_revoke")}</p></div>)}
    <ConsentSheet locale={locale} open={open} title={t(locale, "invite_make")}
      items={[[t(locale, "c_what"), t(locale, "invite_c_what")], [t(locale, "c_who"), t(locale, "invite_c_who")],
        [t(locale, "c_long"), t(locale, "invite_c_long")], [t(locale, "c_undo"), t(locale, "c_share_undo")]]}
      onCancel={() => setOpen(false)} onAgree={make} />
  </div>);
}
