// Stateless relay: one-time sessions, 5-minute expiry, rate limits, no message storage.
// Logs hold event names only; hex runs and anything token-like are scrubbed (rules.md §4).
import { WebSocketServer } from "ws";
import { randomBytes } from "node:crypto";

export const SESSION_TTL_MS = 300_000;
const HEX = /\b[0-9a-f]{32,}\b/gi;
export const scrub = (s) => String(s).replace(HEX, "[token]");

export function createRelay({ port = 0, ttlMs = SESSION_TTL_MS, maxPerMinute = 60, log = () => {} } = {}) {
  const wss = new WebSocketServer({ port });
  const sessions = new Map(); // id -> {created, peers:[ws], used}
  const hits = new Map();
  const emit = (m) => log(scrub(m));

  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress ?? "?";
    const now = Date.now();
    const h = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
    h.push(now);
    hits.set(ip, h);
    if (h.length > maxPerMinute) { emit("rate_limited"); ws.close(1008, "rate_limited"); return; }

    let sid = null;
    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return ws.close(1003, "bad_json"); }
      if (msg.type === "create") {
        sid = randomBytes(16).toString("base64url");
        sessions.set(sid, { created: Date.now(), peers: [ws] });
        emit("session_created");
        ws.send(JSON.stringify({ type: "created", sid }));
      } else if (msg.type === "join") {
        const s = sessions.get(msg.sid);
        if (!s || s.peers.length !== 1 || Date.now() - s.created > ttlMs) {
          emit("join_refused"); return ws.close(1008, "session_invalid_or_expired");
        }
        s.peers.push(ws); sid = msg.sid;
        s.peers[0].send(JSON.stringify({ type: "joined" }));
        ws.send(JSON.stringify({ type: "joined" }));
        emit("session_joined");
      } else if (msg.type === "relay" && sid) {
        const s = sessions.get(sid);
        const other = s?.peers.find((p) => p !== ws);
        other?.send(JSON.stringify({ type: "relay", payload: msg.payload }));
        emit("relay_message"); // payload deliberately never logged
      }
    });
    ws.on("close", () => {
      const s = sid && sessions.get(sid);
      if (s) { s.peers.forEach((p) => p !== ws && p.close()); sessions.delete(sid); emit("session_closed"); }
    });
  });
  return { wss, sessions, close: () => wss.close() };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const r = createRelay({ port: Number(process.env.PORT ?? 8080), log: console.log });
  console.log("relay listening", r.wss.address().port);
}
