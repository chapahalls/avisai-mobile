/** Regras de negócio configuráveis. Na versão real vêm do cadastro da transportadora. */
export const BUSINESS = {
  /** Franquia legal antes da estadia (Lei 11.442/2007, art. 11). Configurável por contrato. */
  franchiseHours: 5,
  /** Valor ANTT por tonelada/hora desde abr/2026. Nunca fixar no código real: vem da configuração. */
  stayRatePerTonHour: 2.5,
  /** Capacidade total do veículo usada no cálculo da estadia. */
  truckCapacityTons: 30,
  /** Tentativas de notificação ao CCO antes de o agente ligar para o recebedor. */
  maxCcoAttempts: 3,
  /** Intervalo entre tentativas ao CCO, em minutos simulados. */
  ccoAttemptIntervalMin: 20,
  /** Distância (km) que dispara o aviso de aproximação ao CCO e ao recebedor. */
  approachKm: 8,
  /** Raio (m) da geocerca de origem e destino. */
  geofenceMeters: 400,
} as const;

/** Relógio simulado: 1 s real = TIME_SCALE s simulados (60 = 1 s vira 1 min). */
export const TIME_SCALE = 60;
