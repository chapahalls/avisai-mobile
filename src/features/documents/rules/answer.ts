import { normalize } from '../../../utils/text';
import { DOCUMENTS } from '../api/documents.mock';
import { searchChunks } from '../api/vectorStore';

/**
 * Regra de negócio (problema 3 do repo de ideias): números (NF, peso, valor) vêm SÓ dos campos extraídos,
 * citando o documento. Sem campo correspondente → "não encontrei". Nunca aproximar.
 */
const FIELD_WORDS: Record<string, string[]> = {
  peso: ['peso'],
  valor: ['valor'],
  numero: ['numero', 'nf', 'cte', 'ct-e'],
  destinatario: ['destinatario', 'cliente'],
  produto: ['produto', 'carga'],
};

export function answerDocumentQuestion(question: string): string {
  const q = normalize(question);
  const wantsCte = /ct-?e/.test(q);
  const docs = wantsCte ? DOCUMENTS.filter((d) => d.kind === 'CT-e') : DOCUMENTS;
  for (const [field, words] of Object.entries(FIELD_WORDS)) {
    if (!words.some((w) => q.includes(w))) continue;
    const doc = docs.find((d) => d.fields[field]);
    if (doc) return `Pela ${doc.title}: ${field} ${doc.fields[field]}.`;
  }
  const [best] = searchChunks(question, 1);
  if (best && best.score > 0.35) {
    const doc = DOCUMENTS.find((d) => d.id === best.documentId);
    return `Achei na ${doc?.title}: ${best.text.split('\n')[0]}`;
  }
  return 'Não encontrei isso nos documentos da viagem.';
}
