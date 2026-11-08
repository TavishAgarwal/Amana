"use client";
import { useEffect, useState } from "react";
export const get = (u: string) => fetch(u).then((r) => r.json());
export const post = (u: string, b?: unknown) =>
  fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b ?? {}) }).then(async (r) => ({ ok: r.ok, data: await r.json() }));
// Only the demo persona id is kept in the browser; no health data ever is.
export function usePersona(): [string, (p: string) => void] {
  const [p, setP] = useState("mariam");
  useEffect(() => { try { setP(localStorage.getItem("persona") ?? "mariam"); } catch {} }, []);
  return [p, (v) => { setP(v); try { localStorage.setItem("persona", v); } catch {} }];
}
