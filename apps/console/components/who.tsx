"use client";
import { t } from "@/lib/i18n";
import { COUNSELLORS, useCounsellor } from "@/lib/who";

export default function Who({ locale }: { locale: string }) {
  const [c, setC] = useCounsellor();
  return (<label className="small" style={{ marginBlockStart: "auto", padding: 8 }}>{t(locale, "signed_in_as")}<br />
    <select value={c} onChange={(e) => { setC(e.target.value); location.reload(); }}>
      {COUNSELLORS.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>);
}
