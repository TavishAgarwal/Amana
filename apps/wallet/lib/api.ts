"use client";
// Calls to the demo API. No health data is ever sent: only signed permissions and signed requests.
export const get = (u: string) => fetch(u).then((r) => r.json());
export const post = (u: string, b?: unknown) =>
  fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b ?? {}) }).then(async (r) => ({ ok: r.ok, data: await r.json() }));
