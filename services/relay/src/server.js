// Stateless relay: one-time sessions, 5-minute expiry, rate limits, no message storage.
// Logs hold event names only; hex runs and anything token-like are scrubbed (rules.md §4).
import { WebSocketServer } from "ws";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer as createHttps } from "node:https";
import { createServer as createHttp } from "node:http";

export const SESSION_TTL_MS = 300_000;
const HEX = /\b[0-9a-f]{32,}\b/gi;
export const scrub = (s) => String(s).replace(HEX, "[token]");

// The address a rate limit counts. Behind a load balancer every socket comes from the proxy, so with
// trustProxy the last X-Forwarded-For entry (the one the trusted proxy added) is used instead.
export function clientIp(req, trustProxy = false) {
  const fwd = trustProxy && req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",").map((s) => s.trim()).filter(Boolean).at(-1) ?? "?";
  return req.socket.remoteAddress ?? "?";
}

// tls = { cert, key } (PEM) serves wss:// so phones on a LAN can reach it from an https:// wallet.
// GET /healthz answers 200 for container health probes; nothing else is served over plain HTTP.
export function createRelay({ port = 0, ttlMs = SESSION_TTL_MS, maxPerMinute = 60, log = () => {}, tls = null, trustProxy = false } = {}) {
  const onHttp = (req, res) => {
    res.writeHead(req.url === "/healthz" ? 200 : 404, { "content-type": "text/plain" });
    res.end(req.url === "/healthz" ? "ok" : "");
  };
  const server = tls ? createHttps({ cert: tls.cert, key: tls.key }, onHttp) : createHttp(onHttp);
  const wss = new WebSocketServer({ server, maxPayload: 256 * 1024 });
  const ready = new Promise((res) => server.listen(port, res));
  const sessions = new Map(); // id -> {created, peers:[ws], used}
  const hits = new Map();
  const emit = (m) => log(scrub(m));
  // Forget idle rate-limit entries and abandoned sessions once a minute, so memory stays flat.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (!h.some((t) => now - t < 60_000)) hits.delete(ip);
    for (const [id, s] of sessions) if (s.peers.length < 2 && now - s.created > ttlMs) { s.peers.forEach((p) => p.close(1008, "expired")); sessions.delete(id); }
  }, 60_000);
  sweep.unref();

  wss.on("connection", (ws, req) => {
    const ip = clientIp(req, trustProxy);
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
  const address = () => server.address();
  return { wss, sessions, ready, address, close: () => { clearInterval(sweep); wss.close(); server.close(); } };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { TLS_CERT, TLS_KEY, RELAY_MAX_PER_MINUTE, TRUST_PROXY, RELAY_QUIET } = process.env;
  const tls = TLS_CERT && TLS_KEY ? { cert: readFileSync(TLS_CERT), key: readFileSync(TLS_KEY) } : null;
  const r = createRelay({
    port: Number(process.env.PORT ?? 8080), tls, trustProxy: TRUST_PROXY === "1",
    maxPerMinute: Number(RELAY_MAX_PER_MINUTE ?? 60), log: RELAY_QUIET === "1" ? () => {} : console.log,
  });
  await r.ready;
  console.log(`relay listening ${tls ? "wss" : "ws"}://0.0.0.0:${r.address().port}`);
}
