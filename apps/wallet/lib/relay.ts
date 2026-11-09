"use client";
// Connection to services/relay: one-time session, opaque payloads, nothing stored.
export const relayUrl = () => process.env.NEXT_PUBLIC_RELAY_URL
  ?? `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:8080`;
export const PAIR_PREFIX = "amana://pair/";

export function connect(url: string, on: { message(m: Record<string, unknown>): void; created?(sid: string): void; joined(): void; closed(reason: string): void }) {
  const ws = new WebSocket(url);
  const ready = new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = () => rej(new Error("relay_unreachable")); });
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    if (m.type === "created") on.created?.(m.sid);
    else if (m.type === "joined") on.joined();
    else if (m.type === "relay") on.message(JSON.parse(m.payload));
  };
  ws.onclose = (e) => on.closed(e.reason || "closed");
  return {
    ready,
    create: () => ws.send(JSON.stringify({ type: "create" })),
    join: (sid: string) => ws.send(JSON.stringify({ type: "join", sid })),
    send: (payload: Record<string, unknown>) => ws.send(JSON.stringify({ type: "relay", payload: JSON.stringify(payload) })),
    close: () => ws.close(),
  };
}
