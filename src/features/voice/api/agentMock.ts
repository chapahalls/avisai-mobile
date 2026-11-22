import { normalize } from '../../../utils/text';
import { extractFields, missingFields, type FieldKey, type ReportContext } from '../../report';
import { answerDocumentQuestion } from '../../documents';

/**
 * Agente mock: decide a resposta a partir do contexto e do que já foi coletado.
 * Na versão real, este papel é do LLM no Conversational AI Engine da Agora, com o mesmo prompt.
 */
const ASK: Record<FieldKey, string> = {
  carga: 'Você já pegou a carga?',
  caminhao: 'E o caminhão, tudo certo?',
  status_carga: 'Como está a carga?',
  avarias: 'Teve alguma avaria?',
  ocorrencias: 'E na viagem, alguma ocorrência?',
  descarga: 'A descarga terminou?',
};

const DONE: Record<ReportContext, string> = {
  pickup: 'Retirada confirmada e relatório enviado ao CCO. Boa viagem.',
  checkin: 'Check-in feito. Avisei o CCO e o contador de espera começou.',
  unload: 'Descarga registrada. Estadia encerrada e enviada ao CCO.',
  free: '',
};

export interface AgentTurn {
  reply: string;
  collected: Partial<Record<FieldKey, string>>;
  completed: boolean;
  occurrence?: string;
}

export function agentRespond(
  context: ReportContext,
  utterance: string,
  collected: Partial<Record<FieldKey, string>>,
): AgentTurn {
  const text = normalize(utterance);

  // Ocorrência a qualquer momento: registra e volta ao assunto.
  if (/(acidente|bloqueio|pneu|fiscalizacao|roubo)/.test(text)) {
    return {
      reply: 'Entendi, registrei a ocorrência e avisei o CCO.' + (context !== 'free' ? ' Voltando: ' + (nextQuestion(context, collected) ?? '') : ''),
      collected,
      completed: false,
      occurrence: utterance,
    };
  }

  // Pergunta sobre documento: responde só com o que está no documento.
  if (/(nota|nf|ct-?e|peso|valor|destinatario|documento)/.test(text)) {
    return { reply: answerDocumentQuestion(utterance), collected, completed: false };
  }

  if (context === 'free') {
    return { reply: 'Estou aqui. Pode falar de uma ocorrência ou perguntar sobre a nota.', collected, completed: false };
  }

  const merged = { ...collected, ...extractFields(context, utterance) };
  const missing = missingFields(context, merged);
  if (missing.length === 0) return { reply: DONE[context], collected: merged, completed: true };

  const gotSomething = Object.keys(merged).length > Object.keys(collected).length;
  const prefix = gotSomething ? 'Anotado. ' : 'Não peguei essa. ';
  return { reply: prefix + ASK[missing[0]], collected: merged, completed: false };
}

function nextQuestion(context: ReportContext, collected: Partial<Record<FieldKey, string>>) {
  const m = missingFields(context, collected);
  return m.length ? ASK[m[0]] : undefined;
}

/** Falas prontas para a demo (substituem o reconhecimento de voz no Expo Go). */
export const QUICK_UTTERANCES: Record<ReportContext, string[]> = {
  pickup: ['Peguei a carga, caminhão ok', 'Peguei a carga', 'Tudo certo'],
  checkin: ['Cheguei, carga ok', 'Sem avaria, viagem tranquila', 'Carga inteira, sem avaria, sem ocorrência'],
  unload: ['Descarreguei', 'Terminou a descarga'],
  free: ['Tem um acidente no km 230', 'Qual o peso da nota?', 'Qual o número do CT-e?'],
};
