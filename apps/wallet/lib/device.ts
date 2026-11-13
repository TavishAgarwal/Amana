"use client";
// The phone's own keys and storage. Nothing here leaves the device.
// - Device key: Ed25519, private part non-extractable. Signs consents, revokes and the pairing proof.
// - Wallet: the lab-signed result and national tokens, encrypted with a non-extractable AES-GCM key.
// Both keys and the encrypted wallet live in IndexedDB. No imports, so Node tests can load this file.

export type Gene = { gene: string; token: string; card: string | null };
export type WalletPkg = {
  persona: string; name: string; period: number; lab_pk: string; national_pk: string;
  credential: { credential: Record<string, unknown> & { couple_result: string | null; carrier_genes: string[] }; signature: string };
  token_set: { token_set: { period: number; holder_pk: string; tokens: string[] }; signature: string; attestation_signature: string };
  genes: Gene[];
  last_shared?: boolean;
  last_revealed?: { gene: string; card: string | null }[];  // only after both partners agreed
};
type KV = { get(k: string): Promise<unknown>; set(k: string, v: unknown): Promise<void>; clear(): Promise<void> };

/** Same bytes as Python json.dumps(sort_keys=True, separators=(",", ":"), ensure_ascii=False). */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).filter((k) => o[k] !== undefined).sort()
    .map((k) => JSON.stringify(k) + ":" + canonical(o[k])).join(",") + "}";
}
export const toHex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b as ArrayBuffer), (x) => x.toString(16).padStart(2, "0")).join("");
export const fromHex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
export const randomHex = (n: number) => toHex(crypto.getRandomValues(new Uint8Array(n)));
const enc = new TextEncoder(), dec = new TextDecoder();

export async function signWith(priv: CryptoKey, obj: unknown) {
  return toHex(await crypto.subtle.sign("Ed25519", priv, enc.encode(canonical(obj))));
}
export async function verifyWith(pkHex: string, obj: unknown, sigHex: string) {
  try {
    const pk = await crypto.subtle.importKey("raw", fromHex(pkHex) as BufferSource, "Ed25519", false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", pk, fromHex(sigHex) as BufferSource, enc.encode(canonical(obj)));
  } catch { return false; }
}

function idb(): KV {
  const db = new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open("amana-device", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) => {
    const s = (await db).transaction("kv", mode).objectStore("kv");
    return new Promise<T>((res, rej) => { const q = f(s); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  };
  return {
    get: (k) => tx("readonly", (s) => s.get(k)),
    set: async (k, v) => { await tx("readwrite", (s) => s.put(v, k)); },
    clear: async () => { await tx("readwrite", (s) => s.clear()); },
  };
}
let kv: KV | null = null;
export const useStore = (k: KV) => { kv = k; };
const store = () => (kv ??= idb());

type Keys = { priv: CryptoKey; pub: CryptoKey; pk: string };
export async function deviceKeys(): Promise<Keys> {
  const have = (await store().get("keys")) as Keys | undefined;
  if (have) return have;
  const kp = (await crypto.subtle.generateKey("Ed25519", false, ["sign", "verify"])) as CryptoKeyPair;
  const keys = { priv: kp.privateKey, pub: kp.publicKey, pk: toHex(await crypto.subtle.exportKey("raw", kp.publicKey)) };
  await store().set("keys", keys);
  return keys;
}
export const sign = async (obj: unknown) => signWith((await deviceKeys()).priv, obj);

async function aesKey(): Promise<CryptoKey> {
  const have = (await store().get("aes")) as CryptoKey | undefined;
  if (have) return have;
  const k = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await store().set("aes", k);
  return k;
}
export async function saveWallet(pkg: WalletPkg) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), enc.encode(JSON.stringify(pkg)));
  await store().set("wallet", { iv, ct });
}
export async function loadWallet(): Promise<WalletPkg | null> {
  const blob = (await store().get("wallet")) as { iv: Uint8Array; ct: ArrayBuffer } | undefined;
  if (!blob) return null;
  try {
    return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: blob.iv as BufferSource }, await aesKey(), blob.ct)));
  } catch { return null; }
}
export const wipeDevice = () => store().clear();

// National tokens change every period (token_service PERIOD_SECONDS, 7 days). A wallet from an
// earlier period cannot do a check until it fetches a new token set by signing in again.
export const PERIOD_SECONDS = 7 * 24 * 3600;
export const currentPeriod = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / PERIOD_SECONDS);
export const tokensStale = (w: WalletPkg, nowMs = Date.now()) => w.token_set.token_set.period < currentPeriod(nowMs);

/** Checks the lab's signature on the result and the national signature on the token set. */
export async function verifyWallet(w: WalletPkg) {
  return (await verifyWith(w.lab_pk, w.credential.credential, w.credential.signature))
    && (await verifyWith(w.national_pk, w.token_set.token_set, w.token_set.signature));
}

/** A permission signed by this device, in the shape the consent ledger verifies. */
export async function signedPermission(type: string, grantee: string, hours = 24 * 7) {
  const permission = { id: randomHex(16), holder_pk: (await deviceKeys()).pk, type, grantee,
    expires_at: Math.floor(Date.now() / 1000) + hours * 3600, nonce: randomHex(6) };
  return { permission, signature: await sign(permission) };
}
/** Proves this device holds its key for one server request. */
export async function signedRequest(op: string) {
  const ts = Math.floor(Date.now() / 1000);
  return { holder_pk: (await deviceKeys()).pk, ts, sig: await sign({ op, ts }) };
}
