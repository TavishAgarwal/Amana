// k6 scenario: pair two virtual wallets through the relay (session create + join + forward).
// Run: k6 run -e RELAY=ws://localhost:8080 -e COUPLES=10000 loadtest/scenarios/couple-checks.js
// Payloads are opaque filler: the relay never sees gene names or tokens.
import ws from "k6/ws";
import { check } from "k6";

const COUPLES = Number(__ENV.COUPLES || 10000);
export const options = { scenarios: { couples: { executor: "shared-iterations", vus: 200, iterations: COUPLES } } };

export default function () {
  const url = __ENV.RELAY || "ws://localhost:8080";
  let sid;
  const res = ws.connect(url, {}, (a) => {
    a.on("open", () => a.send(JSON.stringify({ type: "create" })));
    a.on("message", (m) => {
      const d = JSON.parse(m);
      if (d.type === "created") {
        sid = d.sid;
        ws.connect(url, {}, (b) => {
          b.on("open", () => b.send(JSON.stringify({ type: "join", sid })));
          b.on("message", (mm) => {
            if (JSON.parse(mm).type === "relay") { b.close(); a.close(); }
          });
          a.send(JSON.stringify({ type: "relay", payload: "x".repeat(2048) }));
        });
      }
    });
  });
  check(res, { "connected": (r) => r && r.status === 101 });
}
