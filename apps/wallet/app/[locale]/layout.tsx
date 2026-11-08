import "@amana/ui/tokens.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { dir, t } from "@/lib/i18n";
import RegisterSW from "./register-sw";
import LockGate from "./lock-gate";

export const metadata = {
  title: "AMANA",
  manifest: "/manifest.webmanifest",
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "AMANA", statusBarStyle: "default" as const },
};
export const viewport = { viewportFit: "cover" as const, themeColor: "#0F5E63" };

export default async function L({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const other = locale === "ar" ? "en" : "ar";
  return (
    <html lang={locale} dir={dir(locale)}>
      <body>
        <nav aria-label="main">
          <Link href={`/${locale}/result`}>{t(locale, "nav_result")}</Link>
          <Link href={`/${locale}/pair`}>{t(locale, "nav_pair")}</Link>
          <Link href={`/${locale}/sharing`}>{t(locale, "nav_sharing")}</Link>
          <Link href={`/${locale}/settings`}>{t(locale, "nav_settings")}</Link>
          <Link href={`/${other}/welcome`} lang={other}>{other === "ar" ? "العربية" : "English"}</Link>
        </nav>
        <main><LockGate locale={locale}>{children}</LockGate></main>
        <RegisterSW />
      </body>
    </html>
  );
}
