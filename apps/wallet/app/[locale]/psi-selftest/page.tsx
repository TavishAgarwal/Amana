"use client";
import { useEffect, useState } from "react";
import { clientStart, serverRespond } from "@/lib/psi";

// Runs both sides of the private check inside this browser to prove psi.js works on this device.
export default function PsiSelfTest() {
  const [out, setOut] = useState("running");
  useEffect(() => {
    (async () => {
      const t0 = performance.now();
      const common = ["token-shared-1", "token-shared-2"];
      const a = [...common, "a-only-1"], b = [...common, "b-only-1", "b-only-2"];
      const counted = await clientStart(a, false);
      const r1 = await serverRespond(b, counted.request, false);
      const n = (counted.finish(r1.setup, r1.response) as { count: number }).count;
      const revealed = await clientStart(a, true);
      const r2 = await serverRespond(b, revealed.request, true);
      const shared = (revealed.finish(r2.setup, r2.response) as { shared: string[] }).shared.sort();
      const ok = n === 2 && JSON.stringify(shared) === JSON.stringify(common);
      setOut(`${ok ? "PASS" : "FAIL"} count=${n} shared=${shared.join(",")} ms=${Math.round(performance.now() - t0)}`);
    })().catch((e) => setOut("ERROR " + String(e)));
  }, []);
  return <p id="psi-result" dir="ltr">{out}</p>;
}
