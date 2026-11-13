"use client";
import Link from "next/link";
import { t } from "@/lib/i18n";

export default function NoWallet({ locale }: { locale: string }) {
  return (<div className="card"><h1>{t(locale, "empty_title")}</h1><p>{t(locale, "no_wallet")}</p>
    <Link className="btn" href={`/${locale}/welcome`}>{t(locale, "signin")}</Link></div>);
}
