"use client";
export const get = (u: string) => fetch(u).then((r) => r.json());
export const post = (u: string, b?: unknown) =>
  fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b ?? {}) }).then(async (r) => ({ ok: r.ok, data: await r.json() }));
