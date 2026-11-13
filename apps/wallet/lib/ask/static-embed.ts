// Static sentence embeddings: the vector of a text is the mean of its tokens' vectors (no neural network
// runs on the phone). Model: sentence-transformers/static-similarity-mrl-multilingual-v1 (Apache-2.0),
// cut to the first D dimensions (Matryoshka) and stored as int8 with one scale per token.
import { WordPiece } from "./wordpiece.ts";

export type Embedder = { name: string; dims: number; embed(text: string): Float32Array };

export function staticEmbedder(vocab: string[], vectors: Int8Array, scales: Float32Array, dims: number, name: string): Embedder {
  if (vectors.length !== vocab.length * dims || scales.length !== vocab.length) throw new Error("model_shape");
  const tok = new WordPiece(vocab);
  return {
    name, dims,
    embed(text: string) {
      const v = new Float32Array(dims);
      const ids = tok.encode(text);
      for (const id of ids) {
        const s = scales[id] / 127, o = id * dims;
        for (let d = 0; d < dims; d++) v[d] += vectors[o + d] * s;
      }
      let n = 0;
      for (let d = 0; d < dims; d++) n += v[d] * v[d];
      n = Math.sqrt(n) || 1;
      for (let d = 0; d < dims; d++) v[d] /= n;
      return v;
    },
  };
}

export const cosine = (a: Float32Array, b: Float32Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
