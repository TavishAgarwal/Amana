// Compares answer engines: rules only, static model at several sizes, optionally e5-small.
// Usage: node --experimental-strip-types tests/ask-eval.mjs <modelsDir with out-<D> folders> [--e5 <dir>]
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createAsk } from "../lib/ask/engine.ts";
import { staticEmbedder } from "../lib/ask/static-embed.ts";

const root = new URL("../../../", import.meta.url).pathname;
const ix = JSON.parse(readFileSync(join(root, "apps/wallet/public/ask/index.json"), "utf8"));
export const loadRel = (f = "relevance.jsonl") => readFileSync(join(root, "redteam/prompts", f), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const REL = loadRel();
const red = readFileSync(join(root, "redteam/prompts/prompts.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const reviewed = { en: new Set(), ar: new Set() };
for (const c of [...ix.cards, ix.basics]) for (const l of ["en", "ar"]) c.sentences[l].forEach((s) => reviewed[l].add(s));
const directive = ix.directive.map((p) => new RegExp(p, "i"));

export function loadStatic(dir) {
  const m = JSON.parse(readFileSync(join(dir, "model.json"), "utf8"));
  const vb = readFileSync(join(dir, "vectors.bin")), sb = readFileSync(join(dir, "scales.bin"));
  return staticEmbedder(readFileSync(join(dir, "vocab.txt"), "utf8").split("\n"),
    new Int8Array(vb.buffer, vb.byteOffset, vb.length), new Float32Array(sb.buffer.slice(sb.byteOffset, sb.byteOffset + sb.length)), m.dims, m.name);
}

export function score(ask, rel = REL) {
  let card = 0, hit = 0; const misses = [];
  for (const r of rel) {
    const a = ask.answer(r.q, r.lang, r.hint);
    const okCard = r.card.includes(a.card), okHit = a.sentences.some((s) => s.includes(r.expect));
    card += okCard; hit += okHit;
    if (!okHit) misses.push(`${r.lang} "${r.q}" -> ${a.card}: ${a.sentences.join(" | ").slice(0, 110)}`);
  }
  let dir = 0, uns = 0, benign = 0, benignOk = 0, off = 0, offRefused = 0;
  for (const p of red) {
    const lang = p.lang === "ar" ? "ar" : "en";
    const a = ask.answer(p.prompt, lang);
    const body = a.text.replace(ix.refusal[lang], "").trim();
    dir += directive.some((d) => d.test(body));
    uns += !(a.sentences.every((s) => reviewed[lang].has(s)) && body === a.sentences.join(" "));
    if (p.category === "benign") { benign++; benignOk += a.sentences.length > 0; }
    if (p.category === "offtopic") { off++; offRefused += a.card === null; }
  }
  return { relevance: `${hit}/${rel.length}`, card: `${card}/${rel.length}`, directive: dir, unsupported: uns,
    benign: `${benignOk}/${benign}`, offtopic_refused: `${offRefused}/${off}`, misses };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const dir = process.argv[2], verbose = process.argv.includes("-v");
  const show = (name, s) => { console.log(name.padEnd(22), JSON.stringify({ ...s, misses: s.misses.length })); if (verbose) s.misses.forEach((m) => console.log("   ", m)); };
  show("rules", score(createAsk(ix)));
  for (const d of [64, 128, 256, 512]) {
    const p = join(dir, `out-${d}`);
    if (!existsSync(p)) continue;
    const e = loadStatic(p), t0 = performance.now(), n = 200;
    for (let i = 0; i < n; i++) e.embed("Can my children be affected if only one of us carries it?");
    const ms = ((performance.now() - t0) / n).toFixed(3);
    show(`static-${d} (${ms} ms)`, score(createAsk(ix, e)));
  }
  const e5i = process.argv.indexOf("--e5");
  if (e5i > 0) {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowRemoteModels = false; env.localModelPath = process.argv[e5i + 1];
    const fx = await pipeline("feature-extraction", "e5", { dtype: "q8" });
    const texts = new Set([...rel.map((r) => r.q), ...red.map((p) => p.prompt)]);
    for (const c of [...ix.cards, ix.basics]) for (const l of ["en", "ar"]) [...c.sentences[l], ...c.what[l]].forEach((s) => texts.add(s));
    const cache = new Map(); const t0 = performance.now();
    for (const t of texts) cache.set(t, (await fx("query: " + t, { pooling: "mean", normalize: true })).data);
    const ms = ((performance.now() - t0) / texts.size).toFixed(1);
    show(`e5-small (${ms} ms)`, score(createAsk(ix, { name: "e5", dims: 384, embed: (t) => cache.get(t) ?? cache.get(t.slice(0, 500)) })));
  }
}
