"use client";
import QRCode from "qrcode";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { get, post, usePersona } from "@/lib/api";
import { t } from "@/lib/i18n";
import Scanner from "./scanner";

export default function Pair({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [me] = usePersona();
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [partner, setPartner] = useState("khalid");
  const [qr, setQr] = useState<{ text: string; img: string } | null>(null);
  useEffect(() => { get("/api/personas").then(setList); }, []);
  const make = async () => {
    const { data } = await post("/api/pair", { a: me, b: partner });
    setQr({ text: data.qr, img: await QRCode.toDataURL(data.qr) });
    try { sessionStorage.setItem("pair", JSON.stringify({ a: me, b: partner })); } catch {}
  };
  const [scanned, setScanned] = useState("");
  return (<>
    <h1>{t(locale, "pair")}</h1><p className="soft">{t(locale, "pair_help")}</p>
    <label>{t(locale, "pair_with")}{" "}<select value={partner} onChange={(e) => setPartner(e.target.value)}>
      {list.filter((x) => x.id !== me).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <p><button onClick={make}>{t(locale, "qr")}</button></p>
    <Scanner locale={locale} onCode={setScanned} />
    {scanned && <p className="muted" dir="ltr">{scanned}</p>}
    {(qr || scanned) && (<div className="card">{qr && <><img src={qr.img} alt={qr.text} width={200} height={200} /><p className="muted" dir="ltr">{qr.text}</p></>}
      <Link className="btn" href={`/${locale}/check`}>{t(locale, "next")}</Link></div>)}
  </>);
}
