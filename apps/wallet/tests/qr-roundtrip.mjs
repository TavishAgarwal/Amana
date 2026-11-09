// Generates a pairing QR with `qrcode` and decodes it with `jsqr`, the same libraries the wallet uses.
import QRCode from "qrcode";
import jsQR from "jsqr";
const text = "amana://pair/sYobUMm_s9fCbLbn6LaWiw";  // a relay session id, as the wallet shows it
const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
const n = qr.modules.size, scale = 8, quiet = 4, size = (n + quiet * 2) * scale;
const data = new Uint8ClampedArray(size * size * 4).fill(255);
for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(x, y))
  for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
    const i = (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 4; data[i] = data[i + 1] = data[i + 2] = 0;
  }
const hit = jsQR(data, size, size);
if (hit?.data !== text) { console.error("FAIL", hit?.data); process.exit(1); }
console.log("PASS decoded", hit.data);
