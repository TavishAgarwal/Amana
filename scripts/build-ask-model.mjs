// Cuts the static multilingual embedding model down to what a phone downloads:
//   vocab.txt (one token per line), vectors.bin (int8, tokens x D), scales.bin (float32, one per token).
// Only tokens written in Latin, Arabic or Greek script (Greek for names like β-thalassaemia), plus
// digits, punctuation, symbols and the special tokens, are kept: AMANA speaks English and Arabic, and
// this cuts the download by about 40%. Text in those scripts tokenizes exactly as with the full
// vocabulary (apps/wallet/tests/ask.test.mjs checks this).
// Usage: node scripts/build-ask-model.mjs <dir with model.safetensors + tokenizer.json> <D> [outDir]
// Source model: sentence-transformers/static-similarity-mrl-multilingual-v1 (Apache-2.0).
import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [src, dArg, outArg] = process.argv.slice(2);
const D = Number(dArg);
if (!src || !D) { console.error("usage: build-ask-model.mjs <srcDir> <dims> [outDir]"); process.exit(1); }
const out = outArg ?? `apps/wallet/public/ask/static-${D}`;

const tok = JSON.parse(readFileSync(join(src, "tokenizer.json"), "utf8"));
const full = Object.entries(tok.model.vocab).sort((a, b) => a[1] - b[1]).map(([t]) => t);
full.forEach((t, i) => { if (tok.model.vocab[t] !== i || t.includes("\n")) throw new Error("vocab not contiguous"); });
const keep = (t) => t.startsWith("[") || /^[\p{Script=Latin}\p{Script=Arabic}\p{Script=Greek}\p{N}\p{P}\p{S}]+$/u.test(t.replace(/^##/, ""));
const rows = full.flatMap((t, i) => (keep(t) ? [i] : []));
const vocab = rows.map((i) => full[i]);

const fd = openSync(join(src, "model.safetensors"), "r");
const hb = Buffer.alloc(8); readSync(fd, hb, 0, 8, 0);
const hlen = Number(hb.readBigUInt64LE(0));
const hdr = Buffer.alloc(hlen); readSync(fd, hdr, 0, hlen, 8);
const meta = JSON.parse(hdr.toString())["embedding.weight"];
const [VF, FULL] = meta.shape, V = vocab.length;
if (meta.dtype !== "F32" || VF !== full.length || D > FULL) throw new Error("unexpected model shape");

const vectors = new Int8Array(V * D), scales = new Float32Array(V), row = Buffer.alloc(D * 4);
for (let i = 0; i < V; i++) {
  readSync(fd, row, 0, D * 4, 8 + hlen + meta.data_offsets[0] + rows[i] * FULL * 4);  // first D dims (Matryoshka)
  const f = new Float32Array(row.buffer, row.byteOffset, D);
  let m = 0; for (let d = 0; d < D; d++) m = Math.max(m, Math.abs(f[d]));
  scales[i] = m || 1;
  for (let d = 0; d < D; d++) vectors[i * D + d] = Math.round((f[d] / scales[i]) * 127);
}
closeSync(fd);
mkdirSync(out, { recursive: true });
const files = { "vocab.txt": Buffer.from(vocab.join("\n")), "vectors.bin": Buffer.from(vectors.buffer), "scales.bin": Buffer.from(scales.buffer) };
for (const [f, b] of Object.entries(files)) writeFileSync(join(out, f), b);
// The phone checks each file against these before using or caching it.
const sha256 = Object.fromEntries(Object.entries(files).map(([f, b]) => [f, createHash("sha256").update(b).digest("hex")]));
// Weights tuned per size by apps/wallet/tests/ask-tune.mjs (the engine reads them from here).
const TUNED = { 64: { route: 0.3, select: 0.1, second: 0.06, anchor: 0.5, lex: 0.12 },
  128: { route: 0.2, select: 0.1, second: 0.03, anchor: 0.5, lex: 0.12 } };
const bytes = Object.values(files).reduce((n, b) => n + b.length, 0);
writeFileSync(join(out, "model.json"), JSON.stringify({ name: `static-mrl-multilingual-${D}`, dims: D, tokens: V, bytes, sha256,
  scripts: ["Latin", "Arabic", "Greek"], tune: TUNED[D] ?? null, source: "sentence-transformers/static-similarity-mrl-multilingual-v1", licence: "Apache-2.0" }));
const mb = (V * D + V * 4) / 1e6;
console.log(`${out}: ${V} tokens x ${D} dims, ${mb.toFixed(1)} MB + vocab`);
