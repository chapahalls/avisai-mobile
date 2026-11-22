import i18n, { getCurrentLanguage, type AppLanguage } from '../../../lib/i18n';
import { normalize } from '../../../utils/text';
import { extractFields, missingFields, type FieldKey, type ReportContext } from '../../report';
import { answerDocumentQuestionWithMeta } from '../../documents';

/**
 * Agente mock bilíngue (pt-BR e en): decide a resposta a partir do contexto e do que já foi coletado.
 * Na versão real, este papel é do LLM no Conversational AI Engine da Agora, com o mesmo prompt.
 */

export interface AgentTurn {
  reply: string;
  collected: Partial<Record<FieldKey, string>>;
  completed: boolean;
  missingFields?: FieldKey[];
  occurrence?: string;
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

export function agentRespond(
  context: ReportContext,
  utterance: string,
  collected: Partial<Record<FieldKey, string>>,
): AgentTurn {
  const text = normalize(utterance);

  // Ocorrência a qualquer momento: registra e volta ao assunto.
  if (OCCURRENCE_RE.test(text)) {
    const nextQ = context !== 'free' ? nextQuestion(context, collected) : undefined;
    const suffix = nextQ ? i18n.t('voice.agent.returningToTopic', { question: nextQ }) : '';
    return {
      reply: i18n.t('voice.agent.occurrenceRecorded') + suffix,
      collected,
      completed: false,
      occurrence: utterance,
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
    free: [
      'Abrir mapa',
      'Abrir nota fiscal',
      'Tem um acidente no km 230',
      'Qual o peso da nota?',
      'Qual o número do CT-e?',
    ],
  },
  en: {
    pickup: ['Picked up the cargo, truck ok', 'Picked up the cargo', 'All good'],
    checkin: ['Arrived, cargo ok', 'No damage, smooth trip', 'Cargo intact, no damage, no incident'],
    unload: ['Unloaded', 'Finished unloading'],
    free: [
      'Open map',
      'Open invoice',
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
