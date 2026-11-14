import "@amana/ui/tokens.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { dir, t } from "@/lib/i18n";
import Who from "@/components/who";

const ICON = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1F4E46"/><text x="16" y="23" font-family="Georgia,serif" font-size="20" text-anchor="middle" fill="#F6F1E9">A</text></svg>');
export const metadata = { title: "AMANA console", icons: { icon: ICON } };
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
