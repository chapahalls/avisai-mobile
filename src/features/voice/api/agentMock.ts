import i18n, { getCurrentLanguage, type AppLanguage } from '../../../lib/i18n';
import { normalize } from '../../../utils/text';
import { extractFields, missingFields, type FieldKey, type ReportContext } from '../../report';
import {
  DOCUMENTS,
  answerDocumentQuestionWithMeta,
  isDocumentReadRequest,
  readDocumentAloud,
  useDocuments,
} from '../../documents';

/**
 * Agente mock bilíngue (pt-BR e en): decide a resposta a partir do contexto e do que já foi coletado.
 * Na versão real, este papel é do LLM dos LiveKit Agents no backend, com o mesmo prompt.
 */

export interface AgentTurn {
  reply: string;
  collected: Partial<Record<FieldKey, string>>;
  completed: boolean;
  startOccurrence?: boolean;
  missingFields?: FieldKey[];
  occurrence?: {
    text: string;
    descricao: string;
    km: number | null;
    rodovia: string | null;
  };
  documentAnswer?: {
    question: string;
    answer: string;
    documentId?: string;
    field?: string;
    found: boolean;
  };
}

const OCCURRENCE_RE =
  /(acidente|bloqueio|pneu|fiscalizacao|roubo|interdicao|accident|roadblock|flat tire|inspection|theft|crash|hazard)/;
const REPORT_OCCURRENCE_RE =
  /(?:report(ar|e|a)|registr(ar|e|a)|abr(ir|e|a)|quero|preciso|tenho).*(ocorr[eê]ncia|incident|problem)/;

const DOCUMENT_RE =
  /(nota|nf|nfe|nf-e|ct-?e|peso|valor|destinatario|documento|invoice|weight|value|amount|recipient|document)/;

function askQuestion(field: FieldKey): string {
  return i18n.t(`voice.agent.ask.${field}`);
}

function doneMessage(context: ReportContext): string {
  return i18n.t(`voice.agent.done.${context}`);
}

function nextQuestion(context: ReportContext, collected: Partial<Record<FieldKey, string>>): string | undefined {
  const m = missingFields(context, collected);
  return m.length ? askQuestion(m[0]) : undefined;
}

function extractOccurrenceFields(
  utterance: string,
  collected: Partial<Record<FieldKey, string>>,
): Partial<Record<FieldKey, string>> {
  const normalized = normalize(utterance);
  const next = { ...collected };
  if (!next.problema && !REPORT_OCCURRENCE_RE.test(normalized)) next.problema = utterance;
  const km = normalized.match(/\bkm\s*(\d+(?:[.,]\d+)?)\b/);
  if (km) next.km = km[1].replace(',', '.');
  const br = normalized.match(/\b(br[-\s]?\d{1,3}|rodovia\s+[a-z0-9-]+)/i);
  if (br) next.br = br[1].replace(/\s+/g, '-').toUpperCase();
  return next;
}

export interface AgentOptions {
  /** Caminhão andando (modo direção): o agente lê, mas o PDF só abre parado. */
  driving?: boolean;
}

export function agentRespond(
  context: ReportContext,
  utterance: string,
  collected: Partial<Record<FieldKey, string>>,
  options: AgentOptions = {},
): AgentTurn {
  const text = normalize(utterance);

  if (REPORT_OCCURRENCE_RE.test(text) && context !== 'occurrence') {
    return {
      reply: i18n.t('voice.agent.occurrenceStart'),
      collected,
      completed: false,
      startOccurrence: true,
    };
  }

  if (context === 'occurrence') {
    const merged = extractOccurrenceFields(utterance, collected);
    const missing = missingFields(context, merged);
    if (missing.length > 0) {
      return {
        reply: i18n.t(`voice.agent.occurrenceAsk.${missing[0]}`),
        collected: merged,
        completed: false,
        missingFields: missing,
      };
    }
    return {
      reply: i18n.t('voice.agent.occurrenceRecorded'),
      collected: {},
      completed: false,
      occurrence: {
        text: utterance,
        descricao: merged.problema ?? utterance,
        km: merged.km ? Number(merged.km) : null,
        rodovia: merged.br ?? null,
      },
    };
  }

  // Ocorrência a qualquer momento: registra e volta ao assunto.
  if (OCCURRENCE_RE.test(text)) {
    const nextQ = context !== 'free' ? nextQuestion(context, collected) : undefined;
    const suffix = nextQ ? i18n.t('voice.agent.returningToTopic', { question: nextQ }) : '';
    return {
      reply: i18n.t('voice.agent.occurrenceRecorded') + suffix,
      collected,
      completed: false,
      occurrence: { text: utterance, descricao: utterance, km: null, rodovia: null },
    };
  }

  // "Lê a nota pra mim": lê os campos do documento em voz alta (R7). O PDF fica para quando parar.
  if (isDocumentReadRequest(utterance)) {
    const docs = useDocuments.getState().documents;
    const reading = readDocumentAloud(utterance, docs.length ? docs : DOCUMENTS);
    const suffix = reading.found
      ? ' ' +
        i18n.t(options.driving ? 'documents.reading.pdfWhenStopped' : 'documents.reading.pdfOffer', {
          title: reading.title,
        })
      : '';
    return {
      reply: reading.text + suffix,
      collected,
      completed: false,
      documentAnswer: {
        question: utterance,
        answer: reading.text,
        documentId: reading.documentId,
        field: 'leitura',
        found: reading.found,
      },
    };
  }

  // Pergunta sobre documento: responde só com o que está no documento (R7).
  if (DOCUMENT_RE.test(text)) {
    const docRes = answerDocumentQuestionWithMeta(utterance);
    return {
      reply: docRes.answer,
      collected,
      completed: false,
      documentAnswer: {
        question: utterance,
        answer: docRes.answer,
        documentId: docRes.documentId,
        field: docRes.field,
        found: docRes.found,
      },
    };
  }

  if (context === 'free') {
    return {
      reply: i18n.t('voice.agent.freePrompt'),
      collected,
      completed: false,
    };
  }

  const merged = { ...collected, ...extractFields(context, utterance) };
  const missing = missingFields(context, merged);
  if (missing.length === 0) {
    return {
      reply: doneMessage(context),
      collected: merged,
      completed: true,
      missingFields: [],
    };
  }

  const gotSomething = Object.keys(merged).length > Object.keys(collected).length;
  const prefix = gotSomething
    ? i18n.t('voice.agent.gotItPrefix')
    : i18n.t('voice.agent.didNotCatchPrefix');

  return {
    reply: prefix + askQuestion(missing[0]),
    collected: merged,
    completed: false,
    missingFields: missing,
  };
}

export const QUICK_UTTERANCES_BY_LANG: Record<AppLanguage, Record<ReportContext, string[]>> = {
  'pt-BR': {
    pickup: ['Peguei a carga, caminhão ok', 'Peguei a carga', 'Tudo certo'],
    checkin: ['Cheguei, carga ok', 'Sem avaria, viagem tranquila', 'Carga inteira, sem avaria, sem ocorrência'],
    unload: ['Descarreguei', 'Terminou a descarga'],
    occurrence: ['Pneu furado, km 230, BR-381', 'Estou em uma fila no km 120 da BR-116'],
    free: [
      'Abrir mapa',
      'Abrir nota fiscal',
      'Lê a nota fiscal pra mim',
      'Tem um acidente no km 230',
      'Qual o peso da nota?',
      'Qual o número do CT-e?',
    ],
  },
  en: {
    pickup: ['Picked up the cargo, truck ok', 'Picked up the cargo', 'All good'],
    checkin: ['Arrived, cargo ok', 'No damage, smooth trip', 'Cargo intact, no damage, no incident'],
    unload: ['Unloaded', 'Finished unloading'],
    occurrence: ['Flat tire, km 230, BR-381', 'I am in a queue at km 120 on BR-116'],
    free: [
      'Open map',
      'Open invoice',
      'Read me the invoice',
      'There is an accident at km 230',
      'What is the invoice weight?',
      'What is the CT-e number?',
    ],
  },
};

export function getQuickUtterances(context: ReportContext, lang: AppLanguage = getCurrentLanguage()): string[] {
  return QUICK_UTTERANCES_BY_LANG[lang][context];
}

/** Falas prontas dinâmicas conforme o idioma atual (mantém compatibilidade com import `QUICK_UTTERANCES`). */
export const QUICK_UTTERANCES: Record<ReportContext, string[]> = new Proxy(
  QUICK_UTTERANCES_BY_LANG['pt-BR'],
  {
    get(_target, prop: string) {
      const lang = getCurrentLanguage();
      return QUICK_UTTERANCES_BY_LANG[lang][prop as ReportContext] ?? [];
    },
  },
);
