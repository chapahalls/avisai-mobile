import { normalize } from '../../../utils/text';
import type { FieldKey, ReportContext } from '../types';

/**
 * Campos obrigatórios por momento. Na versão real vêm do cadastro da transportadora (RegraReporte).
 * Regra: o agente pergunta SÓ o que faltou, nunca repete o formulário inteiro.
 */
export const REQUIRED_FIELDS: Record<ReportContext, FieldKey[]> = {
  pickup: ['carga', 'caminhao'],
  checkin: ['status_carga', 'avarias', 'ocorrencias'],
  unload: ['descarga'],
  free: [],
};

/**
 * Extração bilíngue (pt-BR e en) por palavra-chave (mock do LLM).
 * Critério de aceite por campo (R1 / problema 16): "tudo certo" / "all good" sozinho NÃO preenche campo nenhum.
 */
const PATTERNS: Record<FieldKey, RegExp[]> = {
  carga: [
    /peguei a carga/,
    /carga (esta )?(coletada|carregada|ok|pronta)/,
    /carreguei/,
    /picked up (the )?(cargo|load)/,
    /cargo (is )?(picked up|collected|loaded|ready|ok)/,
    /load(ed)? (the )?(cargo|truck)/,
    /got the (cargo|load)/,
  ],
  caminhao: [
    /caminhao (esta )?(ok|bem|certo|tranquilo|pronto|revisado)/,
    /veiculo (esta )?(ok|bem|certo|pronto)/,
    /truck (is )?(ok|good|fine|ready|checked)/,
    /vehicle (is )?(ok|good|fine|ready)/,
  ],
  status_carga: [
    /carga (esta )?(ok|inteira|certa|em ordem|intacta)/,
    /cargo (is )?(ok|intact|good|fine|in order|complete)/,
    /load (is )?(ok|intact|good|fine|in order)/,
  ],
  avarias: [
    /sem avaria/,
    /nenhuma avaria/,
    /zero avaria/,
    /avaria (na|no|em)/,
    /teve avaria/,
    /no damage/,
    /without damage/,
    /zero damage/,
    /damage (on|in|to)/,
  ],
  ocorrencias: [
    /sem ocorrencia/,
    /nenhuma ocorrencia/,
    /teve (atraso|transito|ocorrencia)/,
    /viagem (foi )?tranquila/,
    /no incident/,
    /no issues/,
    /smooth trip/,
    /uneventful trip/,
    /had (delay|traffic|an incident)/,
  ],
  descarga: [
    /descarreguei/,
    /descarga (foi )?(feita|concluida|terminou|finalizada)/,
    /terminou a descarga/,
    /unloaded/,
    /unload(ing)? (is )?(done|completed|finished)/,
    /finished unloading/,
  ],
};

export function extractFields(context: ReportContext, utterance: string): Partial<Record<FieldKey, string>> {
  const text = normalize(utterance);
  const found: Partial<Record<FieldKey, string>> = {};
  for (const key of REQUIRED_FIELDS[context]) {
    if (PATTERNS[key].some((re) => re.test(text))) found[key] = utterance;
  }
  return found;
}

export function missingFields(context: ReportContext, collected: Partial<Record<FieldKey, string>>): FieldKey[] {
  return REQUIRED_FIELDS[context].filter((k) => !collected[k]);
}
