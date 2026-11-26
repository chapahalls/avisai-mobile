import type { FieldKey, ReportContext } from '../features/report';

/**
 * Barramento simples entre features (evita import circular trip ↔ voice).
 * - 'agent:say'              → o agente fala algo por iniciativa própria (aviso só de ida).
 * - 'agent:context'          → muda o que o agente espera ouvir (retirada, check-in, descarga).
 * - 'voice:completed'        → o agente terminou de coletar os campos de um contexto.
 * - 'voice:field_missing'    → o motorista falou mas faltou campo obrigatório no contexto atual.
 * - 'voice:occurrence'       → o motorista relatou uma ocorrência em rota.
 * - 'voice:document_answered'→ o agente respondeu uma dúvida sobre documentos da viagem.
 * - 'voice:reset'            → reinicia o estado de voz ao resetar a viagem.
 * - 'voice:offline_note'     → sem rede, uma fala virou áudio para enviar depois.
 * - 'trip:driving_mode'      → o caminhão começou a andar (tela trava, só voz) ou parou.
 */
type Events = {
  'agent:say': { text: string };
  'agent:context': { context: ReportContext };
  'voice:completed': { context: ReportContext; fields: Record<string, string> };
  'voice:field_missing': {
    context: ReportContext;
    missing: FieldKey[];
    collected: Partial<Record<FieldKey, string>>;
    utterance: string;
  };
  'voice:occurrence': {
    text: string;
    descricao: string;
    km: number | null;
    rodovia: string | null;
  };
  'voice:document_answered': {
    question: string;
    answer: string;
    documentId?: string;
    field?: string;
    found: boolean;
  };
  'voice:reset': Record<string, never>;
  'voice:offline_note': { id: string; filePath: string; durationMs: number; spokenAt: string };
  'trip:driving_mode': { driving: boolean };
};

type Handler<T> = (p: T) => void;
const handlers: { [K in keyof Events]?: Handler<Events[K]>[] } = {};

export const agentBus = {
  on<K extends keyof Events>(type: K, h: Handler<Events[K]>) {
    (handlers[type] ??= []).push(h as never);
    return () => {
      handlers[type] = (handlers[type] as Handler<Events[K]>[]).filter((x) => x !== h) as never;
    };
  },
  emit<K extends keyof Events>(type: K, payload: Events[K]) {
    (handlers[type] as Handler<Events[K]>[] | undefined)?.forEach((h) => h(payload));
  },
};
