import "@amana/ui/tokens.css";
import type { ReactNode } from "react";
import { dir } from "@/lib/i18n";
import { OfflineBanner, TabBar, TopBar } from "@/components/ui";
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
  return (
    <html lang={locale} dir={dir(locale)}>
      <body>
        <TopBar locale={locale} />
        <main><OfflineBanner locale={locale} /><LockGate locale={locale}>{children}</LockGate></main>
        <TabBar locale={locale} />
        <RegisterSW />
      </body>
    </html>
  );
}
