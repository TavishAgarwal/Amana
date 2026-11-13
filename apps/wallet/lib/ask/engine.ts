// On-device question answering. Same rules as services/explainer (exported in public/ask/index.json):
// answers are only ever whole sentences from reviewed cards, decision questions get a fixed neutral
// reply, and nothing the person types leaves the phone. An optional embedder (static-embed.ts) picks
// sentences by meaning; without it, word overlap does (works on every phone).
import { cosine, type Embedder } from "./static-embed.ts";

type Rule = { pattern: string; flags: string };
export type CardIx = { code: string; gene: string; status: string; sources: string[]; keys: string[];
  sentences: { en: string[]; ar: string[] }; what: { en: string[]; ar: string[] }; section: { en: string[]; ar: string[] } };
export type Index = { version: string; cards: CardIx[]; basics: CardIx; refusal: { en: string; ar: string };
  rules: Record<"DECISION" | "_BASICS" | "_GENERAL" | "_KEEP" | "_TOK", Rule>; stop: string[]; directive: string[];
  anchors: Record<"en" | "ar", Record<string, string>> };
export type Lang = "en" | "ar";
export type Answer = { text: string; sentences: string[]; card: string | null; selected_by: "rules" | "on-device";
  review_status: string; sources: string[] };

// Weights and thresholds, tuned per model on redteam/prompts/relevance.jsonl and the off-topic
// red-team prompts (tests/ask-eval.mjs). route: lowest score that counts as a match for a card;
// select: lowest score for a sentence; second: how close a second sentence must be; anchor: weight of
// the section's matching hint; lex: weight per shared word (at most 2).
export type Tune = { route: number; select: number; second: number; anchor: number; lex: number };
// Default: the values tuned for static-mrl-multilingual-64, the model the wallet ships.
export const TUNE: Tune = { route: 0.3, select: 0.1, second: 0.06, anchor: 0.5, lex: 0.12 };

const rx = (r: Rule, g = false) => new RegExp(r.pattern, r.flags + (g ? "g" : ""));
const norm = (t: string) => t.toLowerCase().replaceAll("thalassemia", "thalassaemia").replaceAll("β", "beta").replace(/[ًٌٍَُِّْ]/g, "");
const words = (t: string) => new Set((t.toLowerCase().match(/[\p{L}\p{N}_؀-ۿ]{4,}/gu) ?? []));
const isSource = (s: string) => s.startsWith("Sources") || s.startsWith("المصادر");
// Words that appear on every card or carry no meaning; ignored when counting shared words.
const STOP = new Set(("the and what does that this with have will are our can for about which there mean means from your you they "
  + "condition gene genes change changes carry carrier carriers passed down families family body when "
  + "ما هل ماذا هذه هذا التي الذي على عن في من إذا اذا كان كنا أن ان يعني حاله الحاله جين الجين تغيير التغيير حامل حاملا تنتقل العائلات").split(" "));
/** Light Arabic normalisation (alef forms, taa marbuta, alif maqsura) and prefix stripping (و ف ب ل ك ال). */
const stem = (w: string) => {
  let x = w.toLowerCase().replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
  if (/[؀-ۿ]/.test(x)) { const y = x.replace(/^(و|ف)?(ب|ل|ك)?(ال)?/, ""); if (y.length >= 3) x = y; }
  else x = x.replace(/(ies|es|s)$/, (m) => (x.length > 5 ? (m === "ies" ? "y" : "") : m));
  return x;
};
const terms = (t: string) => new Set((t.match(/[\p{L}\p{N}]+/gu) ?? []).map(stem).filter((w) => w.length >= 3 && !STOP.has(w)));
const shared = (a: Set<string>, b: Set<string>) => { let n = 0; for (const w of a) if (b.has(w)) n++; return Math.min(n, 2); };

export function createAsk(ix: Index, embedder?: Embedder, tune: Tune = TUNE) {
  const R = { decision: rx(ix.rules.DECISION), basics: rx(ix.rules._BASICS), general: rx(ix.rules._GENERAL),
    keep: rx(ix.rules._KEEP), tok: rx(ix.rules._TOK, true) };
  const all = [...ix.cards, ix.basics];
  const byCode = new Map(all.map((c) => [c.code, c]));
  // Sentence vectors are computed once on the phone (a few ms with the static model).
  const vec = new Map<string, Float32Array>();
  const v = (s: string) => { let x = vec.get(s); if (!x) { x = embedder!.embed(s); vec.set(s, x); } return x; };

  const stripNames = (q: string, c: CardIx) => {
    let n = norm(q);
    for (const k of [...c.keys].sort((a, b) => b.length - a.length)) n = n.split(k).join(" ");
    return n.replace(/\s+/g, " ").trim() || q;
  };

  const find = (q: string) => {
    const n = norm(q), qw = new Set(n.match(R.tok) ?? []);
    let best: CardIx | null = null, score = 0;
    for (const c of ix.cards) {
      const s = c.keys.filter((k) => (k.length <= 5 ? qw.has(k) : n.includes(k))).length;
      if (s > score) { best = c; score = s; }
    }
    return best;
  };

  const tcache = new Map<string, Set<string>>();
  const T = (s: string) => { let x = tcache.get(s); if (!x) { x = terms(s); tcache.set(s, x); } return x; };

  const route = (q: string, qv: Float32Array, lang: Lang) => {
    let best: CardIx | null = null, score = -1;
    const qt = T(q);
    for (const c of all) {
      const cand = c === ix.basics ? c.sentences[lang].filter((s) => !isSource(s)) : [c.sentences[lang][0], ...c.what[lang]];
      const lex = c === ix.basics ? 0 : shared(qt, T(cand.join(" ")));
      for (const s of cand) { const x = cosine(qv, v(s)) + tune.lex * lex; if (x > score) { score = x; best = c; } }
    }
    return score >= tune.route ? best : null;
  };

  const select = (c: CardIx, q: string, qv: Float32Array, lang: Lang) => {
    const ss = c.sentences[lang], qt = T(q);
    const anchor = (i: number) => { const a = ix.anchors[lang][c.section[lang][i]]; return a ? cosine(qv, v(a)) : 0; };
    const scored = ss.map((s, i) => [isSource(s) ? -9 : cosine(qv, v(s)) + tune.anchor * anchor(i) + tune.lex * shared(qt, T(s)), i] as [number, number])
      .sort((a, b) => b[0] - a[0]);
    if (scored[0][0] < tune.select) return [];
    const pick = [scored[0][1]];
    if (scored[1] && scored[1][0] >= Math.max(tune.select, scored[0][0] - tune.second)) pick.push(scored[1][1]);
    // Keep sections whole: a definition comes with its other half, and options always come with
    // "the decision is yours" (they are short, and splitting them could change their meaning).
    const sec = c.section[lang];
    for (const group of ["what", "options"]) {
      if (c === ix.basics && group === "what") continue;
      if (pick.some((i) => sec[i] === group)) sec.forEach((g, i) => { if (g === group && !pick.includes(i)) pick.push(i); });
    }
    return pick.sort((a, b) => a - b);
  };

  const overlap = (c: CardIx, q: string, lang: Lang) => {
    const ss = c.sentences[lang], qw = words(q);
    const scored = ss.map((s, i) => [isSource(s) ? -1 : [...words(s)].filter((w) => qw.has(w)).length, i] as [number, number])
      .filter(([, i]) => i !== 0).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    return [0, ...scored.slice(0, 1).filter(([sc]) => sc > 0).map(([, i]) => i)];  // definition first
  };

  const result = (c: CardIx, lang: Lang, idx: number[], by: Answer["selected_by"], prefix = ""): Answer => {
    const picked = [...new Set(idx)].sort((a, b) => a - b).map((i) => c.sentences[lang][i]);
    return { text: ((prefix ? prefix + " " : "") + picked.join(" ")).trim(), sentences: picked, card: c.code,
      selected_by: by, review_status: c.status, sources: c.sources };
  };
  const refuse = (lang: Lang, by: Answer["selected_by"] = "rules"): Answer =>
    ({ text: ix.refusal[lang], sentences: [], card: null, selected_by: by, review_status: "", sources: [] });

  function answer(question: string, lang: Lang, hint?: string | null): Answer {
    const q = question.slice(0, 500);
    const named = find(q);
    let card = (hint ? byCode.get(hint) : undefined) ?? named;
    if (card && card !== ix.basics && !named && R.general.test(q)) card = ix.basics;
    let by: Answer["selected_by"] = "rules";
    const qv = embedder ? embedder.embed(q) : null;
    if (!card && qv) { card = route(q, qv, lang); if (card) by = "on-device"; }
    if (!card && R.basics.test(q)) card = ix.basics;
    if (R.decision.test(q)) {
      if (!card) return refuse(lang);
      const keep = card.sentences[lang].flatMap((s, i) => (!isSource(s) && R.keep.test(s) ? [i] : []));
      return result(card, lang, keep, "rules", ix.refusal[lang]);
    }
    if (!card) return refuse(lang, by);
    // Once the card is known, its name says nothing about which sentence is wanted: drop it.
    const qs = card === ix.basics ? q : stripNames(q, card);
    let idx = qv ? select(card, qs, embedder!.embed(qs), lang) : [];
    if (idx.length) by = "on-device"; else idx = overlap(card, q, lang);
    return result(card, lang, idx, by);
  }

  /** Low reading comfort: sentences with numbers, the decision or the options are always kept,
   *  plus the definition and (with the embedder) the sentence closest to "what does being a carrier mean". */
  function keyPoints(code: string, lang: Lang): Answer {
    const c = byCode.get(code);
    if (!c) return refuse(lang);
    const ss = c.sentences[lang];
    const must = ss.flatMap((s, i) => (!isSource(s) && R.keep.test(s) ? [i] : []));
    const carrier = ss.findIndex((s) => /carrier|حمل تغيير|حامل/i.test(s) && !R.keep.test(s));
    return result(c, lang, [0, ...(carrier >= 0 ? [carrier] : []), ...must], embedder ? "on-device" : "rules");
  }

  return { answer, keyPoints, stripNames, version: ix.version, model: embedder?.name ?? null };
}
