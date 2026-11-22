import i18n from '../../../lib/i18n';
import { normalize } from '../../../utils/text';
import { DOCUMENTS } from '../api/documents.mock';
import { searchChunks } from '../api/vectorStore';
import { useDocuments } from '../hooks/useDocuments';
import type { TripDocument } from '../types';

/**
 * Regra de negócio R7 (problema 3 do repo de ideias):
 * Números (NF, peso, valor) vêm SÓ dos campos extraídos, citando o documento.
 * Sem campo correspondente → "não encontrei". Nunca aproximar.
 */
const FIELD_WORDS: Record<string, string[]> = {
  peso: ['peso', 'weight', 'quilos', 'kg', 'toneladas'],
  valor: ['valor', 'value', 'amount', 'price', 'custo'],
  frete: ['frete', 'freight'],
  chave: ['chave', 'access key'],
  emitente: ['emitente', 'issuer', 'remetente'],
  numero: ['numero', 'number', 'nf', 'nfe', 'nf-e', 'cte', 'ct-e', 'invoice'],
  destinatario: ['destinatario', 'cliente', 'recipient', 'receiver', 'customer'],
  produto: ['produto', 'itens', 'carga', 'mercadoria', 'product', 'items', 'cargo', 'goods', 'bebida', 'caixas', 'boxes', 'paletes'],
  transportadora: ['transportadora', 'carrier', 'transporter'],
  nfe_referenciada: ['referenciada', 'vinculada'],
  origem: ['origem', 'origin'],
  destino: ['destino', 'destination'],
  placa: ['placa', 'veiculo', 'plate', 'vehicle'],
  janela: ['janela', 'horario', 'window', 'schedule'],
};

const UNEXTRACTED_TOPIC_WORDS = [
  'cnpj',
  'cpf',
  'imposto',
  'icms',
  'tax',
  'vencimento',
  'due date',
  'motorista',
  'driver',
  'telefone',
  'phone',
  'cep',
  'zip',
];

function resolveFieldValue(doc: TripDocument, field: string): string | undefined {
  if (doc.fields[field]) return doc.fields[field];
  if (field === 'peso') return doc.fields.peso_kg;
  if (field === 'produto') return doc.fields.itens;
  return undefined;
}

export interface DocumentAnswerResult {
  answer: string;
  documentId?: string;
  field?: string;
  found: boolean;
}

export function answerDocumentQuestionWithMeta(
  question: string,
  tripId = 'rota-1',
): DocumentAnswerResult {
  const q = normalize(question);
  const notFoundText = i18n.t('documents.notFound');

  if (UNEXTRACTED_TOPIC_WORDS.some((w) => q.includes(w))) {
    return { answer: notFoundText, found: false };
  }

  const currentDocs = useDocuments.getState().documents;
  const sourceDocs = currentDocs.length > 0 ? currentDocs : DOCUMENTS;
  if (
    /(quais|lista|nome|names|which|list).*(document|nota|nf|ct-?e|arquivo|file)/
      .test(q)
    || /(document|arquivo|file).*(disponive|tem|available)/
      .test(q)
  ) {
    const titles = sourceDocs.map((doc) => doc.title).join(', ');
    return {
      answer: i18n.t('documents.listAnswer', { documents: titles }),
      found: sourceDocs.length > 0,
    };
  }
  const wantsCte = /ct-?e/.test(q);
  const docs = wantsCte ? sourceDocs.filter((d) => d.kind === 'CT-e') : sourceDocs;

  // Prioriza campos específicos antes de `numero` (pois "peso da nota" ou "valor do ct-e" cita "nota"/"ct-e")
  const orderedFields = [
    'peso',
    'valor',
    'frete',
    'chave',
    'emitente',
    'destinatario',
    'produto',
    'transportadora',
    'nfe_referenciada',
    'origem',
    'destino',
    'placa',
    'janela',
    'numero',
  ];

  for (const field of orderedFields) {
    const words = FIELD_WORDS[field] ?? [];
    if (!words.some((w) => q.includes(w))) continue;
    const doc = docs.find((d) => Boolean(resolveFieldValue(d, field)));
    if (doc) {
      const value = resolveFieldValue(doc, field)!;
      const fieldLabel = i18n.t(`documents.fieldLabels.${field}`, { defaultValue: field });
      return {
        answer: i18n.t('documents.answerByField', {
          title: doc.title,
          field: fieldLabel,
          value,
        }),
        documentId: doc.id,
        field,
        found: true,
      };
    }
    // Se pediu um campo específico (ex.: valor do CT-e) que não existe no documento alvo, não aproxima
    if (field !== 'numero') {
      return { answer: notFoundText, found: false };
    }
  }

  const [best] = searchChunks(question, 1, tripId);
  if (best && best.score > 0.45) {
    const doc = docs.find((d) => d.id === best.documentId);
    if (doc) {
      return {
        answer: i18n.t('documents.answerByChunk', {
          title: doc.title,
          excerpt: best.text.split('\n')[0],
        }),
        documentId: doc.id,
        found: true,
      };
    }
  }

  return { answer: notFoundText, found: false };
}

export function answerDocumentQuestion(question: string): string {
  return answerDocumentQuestionWithMeta(question).answer;
}
