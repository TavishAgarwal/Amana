"use client";
import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";

const PAIR = /^amana:\/\/pair\/[0-9a-f]{12}$/;

// Reads a pairing QR with the camera. Frames are decoded on the device and never uploaded or stored.
export default function Scanner({ locale, onCode }: { locale: string; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | undefined, raf = 0, dead = false;
    const canvas = document.createElement("canvas");
    const tick = () => {
      const v = video.current;
      if (dead || !v) return;
      if (v.readyState === v.HAVE_ENOUGH_DATA) {
        canvas.width = v.videoWidth; canvas.height = v.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(v, 0, 0);
        const hit = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (hit) {
          if (PAIR.test(hit.data)) { setMsg(t(locale, "scan_ok")); setOn(false); onCode(hit.data); return; }
          setMsg(t(locale, "scan_bad"));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" }, audio: false }).then((s) => {
      stream = s; const v = video.current!; v.srcObject = s; v.setAttribute("playsinline", "true"); void v.play(); raf = requestAnimationFrame(tick);
    }).catch(() => { setMsg(t(locale, "scan_denied")); setOn(false); });
    return () => { dead = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((x) => x.stop()); };
  }, [on, locale, onCode]);
  return (<div className="card">
    <button className="secondary" onClick={() => { setMsg(""); setOn(!on); }}>{on ? t(locale, "scan_stop") : t(locale, "scan")}</button>
    {on && <video ref={video} muted style={{ inlineSize: "100%", borderRadius: 12 }} aria-label={t(locale, "scan")} />}
    {msg && <p role="status" className="soft">{msg}</p>}
  </div>);
}
