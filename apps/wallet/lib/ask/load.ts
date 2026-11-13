"use client";
// Loads question answering on the phone, in two levels, so that every phone gets answers:
//   rules     index.json only (~40 KB). Works on any phone and offline once loaded.
//   on-device the static multilingual model (~4.9 MB, int8). Picks sentences by meaning.
// The model is never downloaded without the person saying yes, and the prompt says when the phone
// looks to be on mobile data. Files come from this app's own server, are checked against the SHA-256
// sums in model.json, and are kept in the Cache API so they download once. Questions never leave
// the phone: nothing here sends them anywhere.
import { useEffect, useState } from "react";
import { createAsk, TUNE, type Index, type Tune } from "./engine.ts";
import { staticEmbedder } from "./static-embed.ts";

export const MODEL_DIR = "/ask/static-64";
const CACHE = "amana-ask";
const PREF = "ask_model";  // "yes" | "no"; unset means not asked yet
type ModelMeta = { name: string; dims: number; tokens: number; bytes: number; sha256: Record<string, string>; tune: Tune | null };
export type Engine = ReturnType<typeof createAsk>;
export type ModelState = "unknown" | "unsupported" | "offer" | "declined" | "downloading" | "ready" | "failed";
export type Device = { memoryGB: number | null; saveData: boolean; cellular: boolean; slow: boolean; freeMB: number | null };

type Conn = { saveData?: boolean; type?: string; effectiveType?: string };
/** What the phone tells us about itself. Every field may be missing on older browsers. */
export async function device(): Promise<Device> {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: Conn };
  let freeMB: number | null = null;
  try { const e = await navigator.storage?.estimate?.(); if (e?.quota != null) freeMB = Math.round((e.quota - (e.usage ?? 0)) / 1e6); } catch { /* not offered */ }
  const c = n.connection;
  return { memoryGB: n.deviceMemory ?? null, saveData: !!c?.saveData, cellular: c?.type === "cellular",
    slow: /^(slow-2g|2g|3g)$/.test(c?.effectiveType ?? ""), freeMB };
}

/** The model needs about 15 MB of memory while in use. Phones that report under 1 GB, or no room
 *  to keep it, stay on rules (still full answers, chosen by word matching). */
export const canRunModel = (d: Device) => (d.memoryGB == null || d.memoryGB >= 1) && (d.freeMB == null || d.freeMB >= 25)
  && typeof Int8Array !== "undefined" && typeof TextDecoder !== "undefined";

const pref = () => { try { return localStorage.getItem(PREF); } catch { return null; } };
const setPref = (v: string | null) => { try { if (v) localStorage.setItem(PREF, v); else localStorage.removeItem(PREF); } catch { /* private mode */ } };
const openCache = async () => { try { return "caches" in self ? await caches.open(CACHE) : null; } catch { return null; } };

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function verified(buf: ArrayBuffer, want: string) {
  if (!crypto?.subtle) return true;  // only missing outside a secure context; same-origin file
  return hex(await crypto.subtle.digest("SHA-256", buf)) === want;
}

/** index.json: network first (so card edits arrive), cache when offline. */
async function loadIndex(): Promise<Index> {
  const c = await openCache(), url = "/ask/index.json";
  try {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(String(r.status));
    if (c) await c.put(url, r.clone());
    return await r.json();
  } catch (e) {
    const hit = await c?.match(url);
    if (hit) return hit.json();
    throw e;
  }
}

async function meta(fromNetwork: boolean): Promise<ModelMeta | null> {
  const c = await openCache(), url = `${MODEL_DIR}/model.json`;
  if (!fromNetwork) { const hit = await c?.match(url); return hit ? hit.json() : null; }
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(String(r.status));
  if (c) await c.put(url, r.clone());
  return r.json();
}

/** Reads one model file from the cache, or downloads it (with progress) and caches it. */
async function file(name: string, m: ModelMeta, download: boolean, onBytes: (n: number) => void): Promise<ArrayBuffer | null> {
  const c = await openCache(), url = `${MODEL_DIR}/${name}`;
  const hit = await c?.match(url);
  if (hit) {
    const b = await hit.arrayBuffer();
    if (await verified(b, m.sha256[name])) { onBytes(b.byteLength); return b; }
    await c!.delete(url);  // changed or damaged: fetch again
  }
  if (!download) return null;
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(String(r.status));
  const reader = r.body.getReader(), parts: Uint8Array[] = [];
  let n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); n += value.length; onBytes(value.length); }
  const b = new Uint8Array(n); let o = 0; for (const p of parts) { b.set(p, o); o += p.length; }
  if (!(await verified(b.buffer, m.sha256[name]))) throw new Error("checksum");
  if (c) await c.put(url, new Response(b.slice(0)));
  return b.buffer;
}

async function buildModel(m: ModelMeta, download: boolean, onBytes: (n: number) => void) {
  const [vocab, vectors, scales] = await Promise.all(["vocab.txt", "vectors.bin", "scales.bin"].map((f) => file(f, m, download, onBytes)));
  if (!vocab || !vectors || !scales) return null;
  return staticEmbedder(new TextDecoder().decode(vocab).split("\n"), new Int8Array(vectors), new Float32Array(scales), m.dims, m.name);
}

// One shared state for the whole app, so every Ask box and card sees the same engine.
type Shared = { index: Index | null; engine: Engine | null; state: ModelState; progress: number; bytes: number; device: Device | null; error: string };
let S: Shared = { index: null, engine: null, state: "unknown", progress: 0, bytes: 0, device: null, error: "" };
const subs = new Set<(s: Shared) => void>();
const set = (p: Partial<Shared>) => { S = { ...S, ...p }; subs.forEach((f) => f(S)); };
let started: Promise<void> | null = null;

async function start() {
  try {
    const index = await loadIndex();
    set({ index, engine: createAsk(index) });
  } catch { set({ error: "index" }); return; }
  const d = await device();
  set({ device: d });
  if (!canRunModel(d)) { set({ state: "unsupported" }); return; }
  // Already downloaded: use it straight from the cache, without the network.
  const m = await meta(false).catch(() => null);
  const emb = m ? await buildModel(m, false, () => {}).catch(() => null) : null;
  if (m && emb) { set({ engine: createAsk(S.index!, emb, m.tune ?? TUNE), state: "ready", bytes: m.bytes }); return; }
  const p = pref();
  if (p === "no") { set({ state: "declined" }); return; }
  // Not downloaded yet (or the cache was cleared): ask, with the size. Never download unasked.
  const mm = await meta(true).catch(() => null);
  set({ bytes: mm?.bytes ?? 0, state: "offer" });
}

/** Downloads the model after the person agreed. */
export async function downloadModel() {
  if (S.state === "downloading" || !S.index) return;
  setPref("yes");
  set({ state: "downloading", progress: 0, error: "" });
  try {
    const m = (await meta(true))!;
    let got = 0;
    const emb = await buildModel(m, true, (n) => { got += n; set({ progress: Math.min(1, got / m.bytes) }); });
    if (!emb) throw new Error("model");
    set({ engine: createAsk(S.index, emb, m.tune ?? TUNE), state: "ready", progress: 1, bytes: m.bytes });
  } catch (e) { set({ state: "failed", error: String((e as Error).message ?? e) }); }
}

export function declineModel() { setPref("no"); set({ state: "declined" }); }
/** From Settings: show the download offer again. */
export function offerModel() { setPref(null); if (S.state === "declined" || S.state === "failed") set({ state: "offer" }); }

/** Removes the model from this phone; answers go back to rules. */
export async function removeModel() {
  const c = await openCache();
  if (c) for (const k of await c.keys()) if (new URL(k.url).pathname.startsWith(MODEL_DIR)) await c.delete(k);
  setPref("no");
  set({ engine: S.index ? createAsk(S.index) : null, state: S.device && !canRunModel(S.device) ? "unsupported" : "declined" });
}

/** React hook: the engine to answer with (rules until the model is ready) and the model's state. */
export function useAsk() {
  const [s, setS] = useState(S);
  useEffect(() => {
    subs.add(setS); setS(S);
    if (!started) started = start();
    return () => { subs.delete(setS); };
  }, []);
  return s;
}
