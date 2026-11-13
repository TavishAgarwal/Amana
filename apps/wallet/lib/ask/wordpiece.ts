// BERT WordPiece tokenizer (lower-cased, accents stripped), matching Hugging Face `tokenizers`
// BertNormalizer + BertPreTokenizer + WordPiece. No dependencies, so it runs on any phone.

const isControl = (c: string) => c !== "\t" && c !== "\n" && c !== "\r" && /[\p{Cc}\p{Cf}\p{Co}\p{Cn}]/u.test(c);
const isSpace = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r" || /\p{Zs}/u.test(c);
const isPunct = (c: string) => {
  const cp = c.codePointAt(0)!;
  return (cp >= 33 && cp <= 47) || (cp >= 58 && cp <= 64) || (cp >= 91 && cp <= 96) || (cp >= 123 && cp <= 126) || /\p{P}/u.test(c);
};
const isCJK = (cp: number) => (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x20000 && cp <= 0x2a6df)
  || (cp >= 0x2a700 && cp <= 0x2b73f) || (cp >= 0x2b740 && cp <= 0x2b81f) || (cp >= 0x2b820 && cp <= 0x2ceaf)
  || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0x2f800 && cp <= 0x2fa1f);

export function normalize(text: string): string {
  let out = "";
  for (const c of text) {
    const cp = c.codePointAt(0)!;
    if (cp === 0 || cp === 0xfffd || isControl(c)) continue;
    if (isSpace(c)) out += " ";
    else if (isCJK(cp)) out += ` ${c} `;
    else out += c;
  }
  return out.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase();
}

export function preTokenize(text: string): string[] {
  const words: string[] = [];
  let cur = "";
  for (const c of text) {
    if (isSpace(c)) { if (cur) words.push(cur); cur = ""; }
    else if (isPunct(c)) { if (cur) words.push(cur); words.push(c); cur = ""; }
    else cur += c;
  }
  if (cur) words.push(cur);
  return words;
}

export class WordPiece {
  private ids = new Map<string, number>();
  readonly unk: number;
  constructor(vocab: string[], unkToken = "[UNK]") {
    vocab.forEach((t, i) => this.ids.set(t, i));
    this.unk = this.ids.get(unkToken) ?? 0;
  }
  encode(text: string): number[] {
    const out: number[] = [];
    for (const word of preTokenize(normalize(text))) {
      const chars = Array.from(word);
      if (chars.length > 100) { out.push(this.unk); continue; }
      const pieces: number[] = [];
      let start = 0, bad = false;
      while (start < chars.length) {
        let end = chars.length, id: number | undefined;
        while (start < end) {
          const sub = (start > 0 ? "##" : "") + chars.slice(start, end).join("");
          id = this.ids.get(sub);
          if (id !== undefined) break;
          end--;
        }
        if (id === undefined) { bad = true; break; }
        pieces.push(id); start = end;
      }
      if (bad) out.push(this.unk); else out.push(...pieces);
    }
    return out;
  }
}
