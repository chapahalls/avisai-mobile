/**
 * Barramento simples entre features (evita import circular trip ↔ voice).
 * - 'agent:say'      → o agente fala algo por iniciativa própria (aviso só de ida).
 * - 'agent:context'  → muda o que o agente espera ouvir (retirada, check-in, descarga).
 * - 'voice:completed'→ o agente terminou de coletar os campos de um contexto.
 */
type Events = {
  'agent:say': { text: string };
  'agent:context': { context: import('../features/report/types').ReportContext };
  'voice:completed': { context: import('../features/report/types').ReportContext; fields: Record<string, string> };
  'voice:occurrence': { text: string };
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
