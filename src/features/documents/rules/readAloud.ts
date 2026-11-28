import i18n from '../../../lib/i18n';
import { normalize } from '../../../utils/text';
import type { TripDocument } from '../types';
import { findDocumentByName } from './find';

/**
 * Leitura em voz alta de um documento da viagem (NF-e, CT-e, anexo complementar).
 * Como na R7, o agente lê SÓ os campos extraídos, na ordem em que o motorista precisa deles.
 * A chave de acesso (44 dígitos) e o tipo de arquivo não são lidos: ninguém guarda isso de ouvido.
 */
const READ_ORDER = [
  'numero',
  'emitente',
  'destinatario',
  'itens',
  'produto',
  'peso_kg',
  'peso',
  'valor',
  'transportadora',
  'placa',
  'frete',
  'nfe_referenciada',
  'origem',
  'destino',
  'janela',
  'arquivo',
  'descricao',
] as const;

/** Pedido de leitura: "lê a nota", "o que diz o CT-e", "resume o documento", "read the invoice". */
const READ_VERB_RE =
  /\b(le|ler|leia|leitura|resum\w*|read|summar\w*)\b|\bo que (diz|tem|fala|esta escrito)\b|\bwhat does\b|\bwhat'?s (in|on)\b/;
const DOC_WORD_RE =
  /\b(nota|nf|nf-?e|danfe|ct-?e|dacte|mdf-?e|conhecimento|manifesto|documento\w*|anexo\w*|arquivo\w*|comprovante\w*|complementar\w*|invoice|document\w*|file|attachment\w*|pdf)\b/;

const COMPLEMENT_RE = /\b(anexo\w*|complementar\w*|arquivo\w*|comprovante\w*|attachment\w*|file)\b/;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function isDocumentReadRequest(question: string): boolean {
  const q = normalize(question);
  return READ_VERB_RE.test(q) && DOC_WORD_RE.test(q);
}

/** Texto da leitura de um documento, no idioma do app. */
export function buildDocumentReading(doc: TripDocument): string {
  const items = READ_ORDER.filter((k) => doc.fields[k]?.trim())
    // "itens" e "produto", "peso_kg" e "peso": lê só um de cada par.
    .filter((k) => !(k === 'produto' && doc.fields.itens) && !(k === 'peso' && doc.fields.peso_kg))
    // O título já diz o número ("NF-e 000.482.913") e o nome do anexo: não repete.
    .filter((k) => !((k === 'numero' || k === 'arquivo') && doc.title.includes(doc.fields[k])))
    .map((k) =>
      i18n.t('documents.reading.item', {
        label: capitalize(i18n.t(`documents.fieldLabels.${k}`, { defaultValue: k })),
        value: doc.fields[k],
      }),
    );
  const intro = i18n.t('documents.reading.intro', { title: doc.title });
  if (items.length === 0) return `${intro} ${i18n.t('documents.reading.noFields')}`;
  const body = `${intro} ${items.join('; ')}.`;
  return doc.kind === 'Arquivo' ? `${body} ${i18n.t('documents.reading.fileOnlyInPdf')}` : body;
}

export interface DocumentReadingResult {
  found: boolean;
  text: string;
  documentId?: string;
  title?: string;
}

/**
 * Acha o documento pedido e monta a leitura. Sem documento citado ("lê o documento"), lê a
 * NF-e, que é o que o recebedor e a fiscalização pedem; sem NF-e, o primeiro da viagem.
 */
export function readDocumentAloud(question: string, docs: TripDocument[]): DocumentReadingResult {
  if (docs.length === 0) return { found: false, text: i18n.t('documents.notFound') };
  const q = normalize(question);
  const named =
    findDocumentByName(docs, q) ??
    // Nome do anexo citado em parte ("o comprovante de pesagem").
    docs.find((d) =>
      normalize(d.title)
        .split(/[\s._-]+/)
        .some((w) => w.length > 3 && q.includes(w)),
    ) ??
    // "documento complementar", "o anexo": o primeiro anexo da rota.
    (COMPLEMENT_RE.test(q) ? docs.find((d) => d.kind === 'Arquivo') : undefined);
  const doc = named ?? docs.find((d) => d.kind === 'NF-e') ?? docs[0];
  return { found: true, text: buildDocumentReading(doc), documentId: doc.id, title: doc.title };
}
