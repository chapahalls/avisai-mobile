import { useApiConfig } from '../../../services/api';
import { brl, hhmm } from '../../../utils/format';
import { computeStay } from '../rules/stay';
import { useTrip } from './useTrip';

export interface StaySummary {
  /** Há contagem de espera (chegou ao destino ou o backend mandou a estadia). */
  active: boolean;
  /** Tempo parado formatado (`0h47`), ou `null` sem contagem. */
  timer: string | null;
  /** Passou da franquia: a estadia está correndo. */
  over: boolean;
  /** Valor da estadia (`R$ 55,00`) quando passou da franquia. */
  value: string | null;
}

/**
 * Resumo da espera para telas e modais que não precisam do contador completo.
 * Em modo `http` usa a `Estadia` do backend; em `mock`, calcula localmente.
 */
export function useStaySummary(): StaySummary {
  const apiMode = useApiConfig((s) => s.mode);
  const phase = useTrip((s) => s.phase);
  const simMinutes = useTrip((s) => s.simMinutes);
  const arrivedAtMin = useTrip((s) => s.arrivedAtMin);
  const unloadedAtMin = useTrip((s) => s.unloadedAtMin);
  const backendStay = useTrip((s) => s.backendStay);

  const useBackend = apiMode === 'http' && backendStay !== null;
  const active = useBackend || (arrivedAtMin !== null && (phase === 'waiting' || phase === 'unloaded'));
  if (!active) return { active: false, timer: null, over: false, value: null };

  if (useBackend) {
    const over = backendStay.horas_excedentes > 0 || backendStay.valor > 0;
    return { active, timer: backendStay.tempo_parado, over, value: over ? backendStay.valor_fmt : null };
  }

  const endMin = phase === 'unloaded' ? (unloadedAtMin ?? simMinutes) : simMinutes;
  const stay = computeStay(Math.max(0, endMin - (arrivedAtMin ?? simMinutes)));
  const over = stay.excessHours > 0;
  return { active, timer: hhmm(stay.waitedMinutes), over, value: over ? brl(stay.value) : null };
}
