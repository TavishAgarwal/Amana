"use client";
// On-device encryption for the cached result. A PIN is stretched with PBKDF2 into an AES-GCM key held only in memory.
// Nothing here leaves the device; the PIN is never stored, only a salt and a small encrypted check value.
const ITER = 310_000, enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let key: CryptoKey | null = null;
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k: string) => { try { localStorage.removeItem(k); } catch {} },
};

async function derive(pin: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt as BufferSource, iterations: ITER, hash: "SHA-256" }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function seal(k: CryptoKey, text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(text)));
  return b64(iv) + "." + b64(ct);
}
async function open(k: CryptoKey, blob: string) {
  const [iv, ct] = blob.split(".");
  return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) as BufferSource }, k, unb64(ct) as BufferSource));
}

export const hasPin = () => ls.get("vault.salt") !== null;
export const isUnlocked = () => key !== null;
export const lock = () => { key = null; };

export async function setPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  key = await derive(pin, salt);
  ls.set("vault.salt", b64(salt));
  ls.set("vault.check", await seal(key, "amana"));
}
export async function unlock(pin: string) {
  const salt = ls.get("vault.salt"), check = ls.get("vault.check");
  if (!salt || !check) return true;
  try {
    const k = await derive(pin, unb64(salt));
    if ((await open(k, check)) !== "amana") return false;
    key = k; return true;
  } catch { return false; }
}
export async function put(name: string, value: unknown) {
  if (!key) return;
  ls.set("vault." + name, await seal(key, JSON.stringify(value)));
}
export async function get<T>(name: string): Promise<T | null> {
  const blob = ls.get("vault." + name);
  if (!key || !blob) return null;
  try { return JSON.parse(await open(key, blob)) as T; } catch { return null; }
}
export function wipe() {
  key = null;
  try { Object.keys(localStorage).filter((k) => k.startsWith("vault.")).forEach((k) => localStorage.removeItem(k)); } catch {}
}
