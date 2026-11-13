// Grid search for engine weights per model. Must keep: 0 directive, 0 unsupported, every benign
// question answered, every off-topic question refused. Maximises relevance on relevance.jsonl.
// Usage: node --experimental-strip-types tests/ask-tune.mjs <model dir (static) | --e5 <root>>
import { readFileSync } from "node:fs";
import { createAsk } from "../lib/ask/engine.ts";
import { loadRel, loadStatic, score } from "./ask-eval.mjs";

const ix = JSON.parse(readFileSync(new URL("../public/ask/index.json", import.meta.url), "utf8"));
let emb;
if (process.argv[2] === "--e5") {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowRemoteModels = false; env.localModelPath = process.argv[3];
  const fx = await pipeline("feature-extraction", "e5", { dtype: "q8" });
  const cache = new Map();
  const texts = new Set();
  const root = new URL("../../../", import.meta.url).pathname;
  for (const f of ["relevance.jsonl", "relevance-heldout.jsonl", "prompts.jsonl"]) for (const l of readFileSync(root + "redteam/prompts/" + f, "utf8").trim().split("\n")) { const r = JSON.parse(l); texts.add(r.q ?? r.prompt); }
  for (const c of [...ix.cards, ix.basics]) for (const l of ["en", "ar"]) [...c.sentences[l], ...c.what[l]].forEach((s) => texts.add(s));
  for (const l of ["en", "ar"]) Object.values(ix.anchors[l]).forEach((a) => texts.add(a));
  const helper = createAsk(ix);
  for (const q of [...texts]) for (const c of ix.cards) texts.add(helper.stripNames(q, c));
  for (const t of texts) cache.set(t, (await fx("query: " + t, { pooling: "mean", normalize: true })).data);
  const live = async (t) => (await fx("query: " + t, { pooling: "mean", normalize: true })).data;
  emb = { name: "e5", dims: 384, embed: (t) => { const x = cache.get(t); if (!x) throw new Error("e5 cache miss: " + t); return x; }, live };
} else emb = loadStatic(process.argv[2]);

let best = null;
for (const route of [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9])
  for (const select of [0.1, 0.2, 0.3, 0.6, 0.9])
    for (const anchor of [0, 0.5, 1, 1.5, 2])
      for (const lex of [0, 0.06, 0.12, 0.2, 0.3])
        for (const second of [0.03, 0.06]) {
          const t = { route, select, second, anchor, lex };
          const s = score(createAsk(ix, emb, t));
          if (s.directive || s.unsupported || s.benign !== "22/22" || s.offtopic_refused !== "3/3") continue;
          const hit = Number(s.relevance.split("/")[0]);
          if (!best || hit > best.hit) best = { hit, t, s };
        }
const held = best && score(createAsk(ix, emb, best.t), loadRel("relevance-heldout.jsonl"));
console.log(JSON.stringify({ model: emb.name, tuned: best && best.s.relevance, card: best?.s.card, heldout: held?.relevance, heldout_card: held?.card, tune: best?.t }));
if (process.argv.includes("-v")) held?.misses.forEach((m) => console.log("   held-out miss:", m));
if (process.argv.includes("-v")) best?.s.misses.forEach((m) => console.log("   ", m));
