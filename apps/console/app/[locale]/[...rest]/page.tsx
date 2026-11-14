import Link from "next/link";
import { t } from "@/lib/i18n";

// Any address that is not a screen: say so and offer a way back, inside the normal layout.
export default async function Missing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (<div className="card"><h1>{t(locale, "nf_title")}</h1><p>{t(locale, "nf_line")}</p>
    <Link className="btn" href={`/${locale}/queue`}>{t(locale, "nf_home")}</Link></div>);
}
