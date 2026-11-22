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

/** Extração por palavra-chave (mock do LLM). Cada campo tem padrões que contam como "respondido". */
const PATTERNS: Record<FieldKey, RegExp[]> = {
  carga: [/peguei a carga/, /carga (coletada|carregada|ok)/, /carreguei/],
  caminhao: [/caminhao (ok|bem|certo|tranquilo)/, /veiculo ok/],
  status_carga: [/carga (ok|inteira|certa|em ordem)/],
  avarias: [/sem avaria/, /nenhuma avaria/, /avaria (na|no|em)/],
  ocorrencias: [/sem ocorrencia/, /nenhuma ocorrencia/, /teve (atraso|transito)/, /viagem tranquila/],
  descarga: [/descarreguei/, /descarga (feita|concluida|terminou)/, /terminou a descarga/],
};

/**
 * Critério de aceite por campo (problema 16 do repo de ideias): "tudo certo" sozinho NÃO preenche campo nenhum.
 */
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
