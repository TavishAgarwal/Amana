"use client";
import { use, useState } from "react";
import { post, usePersona } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function Settings({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [me] = usePersona();
  const [done, setDone] = useState(false);
  return (<>
    <h1>{t(locale, "settings")}</h1>
    <button onClick={async () => { await post(`/api/delete/${me}`); setDone(true); }}>{t(locale, "delete")}</button>
    {done && <p role="status">{t(locale, "done")}</p>}
  </>);
}
