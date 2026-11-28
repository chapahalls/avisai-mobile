import { normalize } from '../../../utils/text';

/**
 * "Embedding" local determinístico (hash de palavras em 64 dimensões).
 * É um mock do modelo de embeddings: permite a busca vetorial no SQLite sem rede.
 * Na versão real: vetores pré-calculados pelo rodar-backend com o mesmo modelo da pergunta.
 */
const DIM = 64;

export function embed(text: string): number[] {
  const v = new Array<number>(DIM).fill(0);
  for (const word of normalize(text).split(/[^a-z0-9]+/).filter((w) => w.length > 2)) {
    let h = 0;
    for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) >>> 0;
    v[h % DIM] += 1;
  }
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

export const cosine = (a: number[], b: number[]) =>
  a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);
