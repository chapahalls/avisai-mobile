import { normalize } from '../../../utils/text';
import type { TripDocument } from '../types';

const KIND_ALIASES: Array<[TripDocument['kind'], RegExp]> = [
  ['NF-e', /\bnf-?e\b|\bnota( fiscal)?\b|\bnf\b|\bdanfe\b|\binvoice\b/],
  ['CT-e', /\bct-?e\b|\bconhecimento\b|\bdacte\b/],
  ['MDF-e', /\bmdf-?e\b|\bmanifesto\b/],
];

/**
 * Acha o documento que o motorista pediu por voz: pelo tipo ("NF-e", "a nota fiscal", "CT-e")
 * ou pelo nome do anexo ("comprovante de pesagem"). Sem correspondência clara, devolve `null`.
 */
export function findDocumentByName(docs: TripDocument[], query: string): TripDocument | null {
  const q = normalize(query || '').trim();
  if (!q) return null;

  for (const [kind, re] of KIND_ALIASES) {
    if (re.test(q)) return docs.find((d) => d.kind === kind) ?? null;
  }

  const byTitle = docs.find((d) => {
    const title = normalize(d.title);
    return title.includes(q) || q.includes(title);
  });
  if (byTitle) return byTitle;

  // Nome parcial: todas as palavras significativas do pedido aparecem no título.
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return null;
  return docs.find((d) => words.every((w) => normalize(d.title).includes(w))) ?? null;
}
