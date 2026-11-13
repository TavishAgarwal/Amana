"use client";
import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    // Text size from Settings, and hide content while the app is in the app switcher (design §11).
    try { const v = localStorage.getItem("text_size"); if (v && v !== "100") document.documentElement.style.fontSize = `${v}%`; } catch { /* private mode */ }
    const blur = () => document.body.classList.toggle("blurred", document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", blur);
    return () => document.removeEventListener("visibilitychange", blur);
  }, []);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    } else {
      // In dev, drop any worker left over from a production run so it cannot serve stale files.
      // The question model's cache stays (it is checked against its SHA-256 sums on every load).
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()));
      void caches?.keys().then((ks) => ks.forEach((k) => { if (k !== "amana-ask") void caches.delete(k); }));
    }
  }, []);
  return null;
}
