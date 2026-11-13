"use client";
// Wallet components from docs/design.md §5. Text comes from messages/*.json via t().
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState as useStateSafe, type ReactNode } from "react";
import { t } from "@/lib/i18n";

const P: Record<string, string> = {
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z",
  home: "M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5",
  pair: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5m-2-5c1-.6 2.4-1 4-1 3 0 6 2 6 5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  help: "M4 5h16v11H9l-5 4zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.4M12 14.5v.01",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z",
};
export function Icon({ name }: { name: keyof typeof P | string }) {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[name]} /></svg>);
}

export function PrivacyNote({ locale, k = "only_you" }: { locale: string; k?: string }) {
  return <p className="privacy"><Icon name="lock" /><span>{t(locale, k)}</span></p>;
}

/** Same size, colour and layout whatever the outcome, so a glance at the screen tells nobody anything. */
export function ResultPanel({ title, line, children }: { title: string; line?: string; children?: ReactNode }) {
  return (<section className="result-panel" role="status" aria-live="polite"><h2>{title}</h2>{line && <p>{line}</p>}
    {children && <div className="row">{children}</div>}</section>);
}

export function ReviewBadge({ locale, status }: { locale: string; status: string }) {
  const ok = status === "reviewed";
  return <span className={`badge ${ok ? "ok" : "warn"}`} title={ok ? undefined : t(locale, "pending_review_why")}>{t(locale, ok ? "reviewed" : "pending_review")}</span>;
}

function Person({ kind }: { kind: "clear" | "carrier" | "affected" }) {
  const fill = kind === "affected" ? "var(--info)" : kind === "carrier" ? "var(--primary)" : "var(--surface)";
  return (<svg viewBox="0 0 40 56" aria-hidden="true">
    <circle cx="20" cy="12" r="9" fill={fill} stroke="var(--border-strong)" strokeWidth="2" />
    <path d="M5 54c0-12 6-22 15-22s15 10 15 22z" fill={kind === "carrier" ? "url(#half)" : fill} stroke="var(--border-strong)" strokeWidth="2" />
    <defs><linearGradient id="half" x1="0" x2="1"><stop offset=".5" stopColor="var(--primary)" /><stop offset=".5" stopColor="var(--surface)" /></linearGradient></defs>
  </svg>);
}
/** The 1-in-4 idea as four children: 1 not a carrier, 2 carriers, 1 with the condition. */
export function InheritanceDiagram({ locale }: { locale: string }) {
  const kids: ["clear" | "carrier" | "affected", string][] = [["clear", "kid_clear"], ["carrier", "kid_carrier"], ["carrier", "kid_carrier"], ["affected", "kid_affected"]];
  return (<figure className="card" aria-label={t(locale, "diagram_alt")} style={{ margin: "12px 0" }}>
    <p className="small muted" style={{ marginBlock: 0 }}>{t(locale, "diagram_parents")}</p>
    <div className="inherit">{kids.map(([k, l], i) => <figure key={i}><Person kind={k} /><figcaption>{t(locale, l)}</figcaption></figure>)}</div>
    <figcaption><strong>{t(locale, "diagram_caption")}</strong></figcaption>
  </figure>);
}

/** Asks for one permission: what, with whom, how long, how to undo. Agree and Not now are equal. */
export function ConsentSheet({ locale, open, title, items, onAgree, onCancel, children, agreeLabel, busy }: {
  locale: string; open: boolean; title: string; items: [string, ReactNode][]; onAgree: () => void; onCancel: () => void;
  children?: ReactNode; agreeLabel?: string; busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>("h2")?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    addEventListener("keydown", esc); return () => removeEventListener("keydown", esc);
  }, [open, onCancel]);
  if (!open) return null;
  return (<div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" ref={ref}>
      <h2 id="sheet-title" tabIndex={-1}>{title}</h2>
      <dl>{items.map(([k, v]) => [<dt key={k + "t"}>{k}</dt>, <dd key={k + "d"}>{v}</dd>])}</dl>
      {children}
      <div className="choices">
        <button onClick={onAgree} disabled={busy}>{agreeLabel ?? t(locale, "agree")}</button>
        <button className="secondary" onClick={onCancel}>{t(locale, "not_now")}</button>
      </div>
    </div></div>);
}

export function Steps({ locale, n, of }: { locale: string; n: number; of: number }) {
  return (<p className="steps">
    {Array.from({ length: of }, (_, i) => <i key={i} aria-hidden="true" className={i < n ? "on" : ""} />)}
    <span>{t(locale, "step_of").replace("{n}", String(n)).replace("{of}", String(of))}</span></p>);
}

const TABS: [string, string, string][] = [["result", "nav_result", "home"], ["pair", "nav_pair", "pair"], ["sharing", "nav_sharing", "shield"], ["help", "nav_help", "help"]];
export function TabBar({ locale }: { locale: string }) {
  const path = usePathname() ?? "";
  if (/\/(welcome|invite\/)/.test(path)) return null;
  return (<nav className="tabbar" aria-label={t(locale, "nav_main")}>
    {TABS.map(([seg, k, ic]) => {
      const on = path.startsWith(`/${locale}/${seg}`) || (seg === "result" && path.startsWith(`/${locale}/card`));
      return <Link key={seg} href={`/${locale}/${seg}`} aria-current={on ? "page" : undefined}><Icon name={ic} />{t(locale, k)}</Link>;
    })}
  </nav>);
}

export function TopBar({ locale }: { locale: string }) {
  const path = usePathname() ?? `/${locale}/welcome`;
  const other = locale === "ar" ? "en" : "ar";
  const onboarding = /\/(welcome|invite\/|study)/.test(path);
  return (<header className="topbar">
    <Link className="brand" href={`/${locale}/result`}>AMANA</Link>
    <div className="row">
      {onboarding && <Link href={path.replace(`/${locale}`, `/${other}`)} lang={other} hrefLang={other}>{other === "ar" ? "العربية" : "English"}</Link>}
      {!onboarding && <Link href={`/${locale}/settings`} aria-label={t(locale, "settings")}><Icon name="gear" /></Link>}
    </div>
  </header>);
}

export const fmtTime = (locale: string, ts: number) =>
  new Date(ts * 1000).toLocaleString(locale === "ar" ? "ar-AE" : "en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" });

export function OfflineBanner({ locale }: { locale: string }) {
  const [off, setOff] = useStateSafe(false);
  useEffect(() => {
    const f = () => setOff(!navigator.onLine); f();
    addEventListener("online", f); addEventListener("offline", f);
    return () => { removeEventListener("online", f); removeEventListener("offline", f); };
  }, [setOff]);
  return off ? <p className="banner-warn" role="status">{t(locale, "offline")}</p> : null;
}
