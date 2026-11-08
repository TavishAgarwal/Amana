import "@amana/ui/tokens.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { dir, t } from "@/lib/i18n";

export const metadata = { title: "AMANA console" };
export default async function L({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const other = locale === "ar" ? "en" : "ar";
  return (<html lang={locale} dir={dir(locale)}><body>
    <nav aria-label="main"><Link href={`/${locale}/queue`}>{t(locale, "nav_queue")}</Link>
      <Link href={`/${locale}/dashboard`}>{t(locale, "nav_dash")}</Link>
      <Link href={`/${locale}/attack-demo`}>{t(locale, "nav_attack")}</Link>
      <Link href={`/${other}/queue`} lang={other}>{other === "ar" ? "العربية" : "English"}</Link></nav>
    <main style={{ maxInlineSize: 900 }}>{children}</main></body></html>);
}
