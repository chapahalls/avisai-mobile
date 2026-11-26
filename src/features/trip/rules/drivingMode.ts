/**
 * Modo direção (como o Waze): decide pela velocidade se o caminhão está andando.
 * Dois limiares (entrar acima de `enterKmh`, sair abaixo de `exitKmh`) e uma espera em cada
 * sentido: no anda-e-para do trânsito a tela não fica travando e destravando.
 * Parâmetros em `DRIVING_MODE` (`lib/config.ts`).
 */

export interface DrivingThresholds {
  enterKmh: number;
  enterHoldMs: number;
  exitKmh: number;
  exitHoldMs: number;
}

export interface DrivingDetector {
  driving: boolean;
  /** Desde quando a velocidade pede a troca de estado (ainda esperando confirmar). */
  pendingSince: number | null;
}

export const INITIAL_DRIVING: DrivingDetector = { driving: false, pendingSince: null };

/** Próximo estado. Velocidade desconhecida conta como parado (sem GPS, a tela não trava). */
export function nextDriving(
  prev: DrivingDetector,
  speedKmh: number | null,
  now: number,
  cfg: DrivingThresholds,
): DrivingDetector {
  const speed = speedKmh ?? 0;
  const wantsChange = prev.driving ? speed <= cfg.exitKmh : speed >= cfg.enterKmh;
  if (!wantsChange) {
    return prev.pendingSince === null ? prev : { driving: prev.driving, pendingSince: null };
  }
  const since = prev.pendingSince ?? now;
  const hold = prev.driving ? cfg.exitHoldMs : cfg.enterHoldMs;
  if (now - since >= hold) return { driving: !prev.driving, pendingSince: null };
  return prev.pendingSince === since ? prev : { driving: prev.driving, pendingSince: since };
}

export type SpeedSource = 'gps' | 'simulator';

export interface SpeedInput {
  /** GPS do aparelho ligado pelo motorista. */
  gpsEnabled: boolean;
  gpsSpeedKmh: number | null;
  /** Hora da última posição do GPS (ms); `null` = ainda não chegou nenhuma. */
  gpsFixAt: number | null;
  /** Velocidade do simulador da rota (modo Mock). */
  simulatedKmh: number | null;
  now: number;
  staleFixMs: number;
}

/**
 * Velocidade que vale agora. Com o GPS ligado e já com posição, só ele conta: posição velha
 * significa parado (o GPS só manda ponto novo depois de andar). Sem GPS, vale o simulador.
 */
export function currentSpeed(input: SpeedInput): { kmh: number | null; source: SpeedSource } {
  if (input.gpsEnabled && input.gpsFixAt !== null) {
    const stale = input.now - input.gpsFixAt > input.staleFixMs;
    return { kmh: stale ? 0 : input.gpsSpeedKmh, source: 'gps' };
  }
  return { kmh: input.simulatedKmh, source: 'simulator' };
}
