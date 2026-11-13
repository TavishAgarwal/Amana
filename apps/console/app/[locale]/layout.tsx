import "@amana/ui/tokens.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { dir, t } from "@/lib/i18n";
import Who from "@/components/who";

export const metadata = { title: "AMANA console" };
// Side navigation on the start side (right in Arabic, left in English), design §4.2.
export default async function L({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const other = locale === "ar" ? "en" : "ar";
  return (<html lang={locale} dir={dir(locale)}><body><div className="console-shell">
    <nav aria-label="main">
      <strong style={{ color: "var(--primary)", letterSpacing: ".08em", padding: "8px" }}>AMANA</strong>
      <Link href={`/${locale}/queue`}>{t(locale, "nav_queue")}</Link>
      <Link href={`/${locale}/dashboard`}>{t(locale, "nav_dash")}</Link>
      <Link href={`/${locale}/attack-demo`}>{t(locale, "nav_attack")}</Link>
      <Link href={`/${other}/queue`} lang={other}>{other === "ar" ? "العربية" : "English"}</Link>
      <Who locale={locale} />
    </nav>
    <main>{children}</main></div></body></html>);
}
