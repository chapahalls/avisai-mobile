/**
 * Feedback háptico nativo para uso em cabine ruidosa sem adicionar dependências nativas.
 * Usa `Vibration` do `react-native` com no-op seguro em ambiente de teste (Vitest).
 */

function vibrate(pattern: number | number[]): void {
  if (process.env.VITEST) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Vibration } = require('react-native') as typeof import('react-native');
    Vibration?.vibrate?.(pattern);
  } catch {
    // Ignora caso permissão ou módulo de vibração não esteja disponível
  }
}

/** Toque curto (15 ms): microfone e ações rápidas de 1 toque. */
export function hapticTap(): void {
  vibrate(15);
}

/** Pulso duplo rápido: confirmação tátil de barge-in (interrupção do agente). */
export function hapticBargeIn(): void {
  vibrate([0, 25, 40, 25]);
}

/** Alerta prioritário: doca liberada pelo recebedor, pergunta da central, nova rota ou divergência de GPS. */
export function hapticAlert(): void {
  vibrate([0, 40, 60, 40]);
}
