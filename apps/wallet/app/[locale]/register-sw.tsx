"use client";
import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    } else {
      // In dev, drop any worker left over from a production run so it cannot serve stale files.
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()));
      void caches?.keys().then((ks) => ks.forEach((k) => void caches.delete(k)));
    }
  }, []);
  return null;
}
