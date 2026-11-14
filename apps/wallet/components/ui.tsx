"use client";
// Wallet components from docs/design.md §5. Text comes from messages/*.json via t().
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState as useStateSafe, type ReactNode } from "react";
import { t } from "@/lib/i18n";

const P: Record<string, string> = {
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z",
  home: "M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5",
  pair: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5m-2-5c1-.6 2.4-1 4-1 3 0 6 2 6 5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  help: "M4 5h16v11H9l-5 4zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.4M12 14.5v.01",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z",
  back: "M15 5l-7 7 7 7",
  arrow: "M5 12h14M13 6l6 6-6 6",
  lines: "M4 6h16M4 10h16M4 14h10M4 18h7",
  cards: "M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 9h6M9 13h6",
  ask: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z",
};
export function Icon({ name }: { name: keyof typeof P | string }) {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[name]} /></svg>);
}

export function PrivacyNote({ locale, k = "only_you", center }: { locale: string; k?: string; center?: boolean }) {
  return <p className={`privacy${center ? " center" : ""}`}><Icon name="lock" /><span>{t(locale, k)}</span></p>;
}

/** Small-caps label at the top of a card: "ABOUT", "YOUR CARDS". */
/** Small-caps section label. Pass as="h2" when cards with their own headings follow it. */
export function Label({ icon, children, as: Tag = "p" }: { icon: string; children: ReactNode; as?: "p" | "h2" }) {
  return <Tag className="label"><Icon name={icon} />{children}</Tag>;
}

/** A row of cards you swipe through. It snaps to each card; the dots under it show where you are. */
export function Rail({ label, children }: { label: string; children: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useStateSafe(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const f = () => { const first = el.firstElementChild as HTMLElement | null; if (!first) return;
      setAt(Math.round(Math.abs(el.scrollLeft) / (first.offsetWidth + 12))); };
    el.addEventListener("scroll", f, { passive: true }); return () => el.removeEventListener("scroll", f);
  }, []);
  return (<>
    <div className="rail" ref={ref} role="list" aria-label={label}>{children.map((c, i) => <div role="listitem" key={i} style={{ display: "grid" }}>{c}</div>)}</div>
    {children.length > 1 && <div className="rail-dots" aria-hidden="true">{children.map((_, i) => <i key={i} className={i === Math.min(at, children.length - 1) ? "on" : ""} />)}</div>}
  </>);
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
  const fill = kind === "affected" ? "var(--dot-4)" : kind === "carrier" ? "var(--dot-2)" : "var(--surface)";
  return (<svg viewBox="0 0 40 56" aria-hidden="true">
    <circle cx="20" cy="12" r="9" fill={fill} stroke="var(--border-strong)" strokeWidth="2" />
    <path d="M5 54c0-12 6-22 15-22s15 10 15 22z" fill={kind === "carrier" ? "url(#half)" : fill} stroke="var(--border-strong)" strokeWidth="2" />
    <defs><linearGradient id="half" x1="0" x2="1"><stop offset=".5" stopColor="var(--dot-2)" /><stop offset=".5" stopColor="var(--surface)" /></linearGradient></defs>
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

// Five tabs; "Check together" sits in the middle as a raised round button.
const TABS: [string, string, string][] = [["result", "nav_result", "home"], ["sharing", "nav_sharing", "shield"], ["pair", "nav_pair", "pair"],
  ["help", "nav_help", "help"], ["settings", "nav_settings", "gear"]];
export function TabBar({ locale }: { locale: string }) {
  const path = usePathname() ?? "";
  if (/\/(welcome|invite\/)/.test(path)) return null;
  return (<nav className="tabbar" aria-label={t(locale, "nav_main")}>
    {TABS.map(([seg, k, ic]) => {
      const on = path.startsWith(`/${locale}/${seg}`) || (seg === "result" && path.startsWith(`/${locale}/card`));
      return seg === "pair"
        ? <Link key={seg} className="centre" href={`/${locale}/${seg}`} aria-current={on ? "page" : undefined}><span className="disc"><Icon name={ic} /></span>{t(locale, k)}</Link>
        : <Link key={seg} href={`/${locale}/${seg}`} aria-current={on ? "page" : undefined}><Icon name={ic} />{t(locale, k)}</Link>;
    })}
  </nav>);
}

/** Brand on the main screens, a round back button on inner ones. A hairline appears once you scroll. */
export function TopBar({ locale }: { locale: string }) {
  const path = usePathname() ?? `/${locale}/welcome`;
  const router = useRouter();
  const other = locale === "ar" ? "en" : "ar";
  const onboarding = /\/(welcome|invite\/|study)/.test(path);
  const inner = /\/(card\/|help\/invite)/.test(path);
  const [scrolled, setScrolled] = useStateSafe(false);
  useEffect(() => {
    const f = () => setScrolled(scrollY > 8); f();
    addEventListener("scroll", f, { passive: true }); return () => removeEventListener("scroll", f);
  }, [setScrolled]);
  return (<header className="topbar" data-scrolled={scrolled}>
    {inner
      ? <button className="round" onClick={() => (history.length > 1 ? router.back() : router.push(`/${locale}/result`))} aria-label={t(locale, "back")}><span className="flip"><Icon name="back" /></span></button>
      : <Link className="brand" href={`/${locale}/result`}>Amana</Link>}
    <div className="row">
      {onboarding && <Link className="lang" href={path.replace(`/${locale}`, `/${other}`)} lang={other} hrefLang={other}>{other === "ar" ? "العربية" : "English"}</Link>}
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
