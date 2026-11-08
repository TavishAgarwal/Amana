"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { get, usePersona } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function Welcome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [p, setP] = usePersona();
  useEffect(() => { get("/api/personas").then(setList); }, []);
  return (<>
    <h1>{t(locale, "welcome")}</h1>
    <div className="card"><label>{t(locale, "choose")}{" "}
      <select value={p} onChange={(e) => setP(e.target.value)}>{list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
    <Link className="btn" href={`/${locale}/result`}>{t(locale, "start")}</Link>
  </>);
}
