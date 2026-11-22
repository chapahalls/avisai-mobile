import { BUSINESS } from '../../../lib/config';

export interface StayConfig {
  franchiseHours?: number;
  stayRatePerTonHour?: number;
  truckCapacityTons?: number;
}

/**
 * Estadia (Lei 11.442/2007, art. 11): conta da CHEGADA ao endereço; depois da franquia,
 * valor por tonelada/hora sobre a capacidade total do veículo. Franquia e valor são configuráveis.
 */
export function computeStay(waitedMinutes: number, customConfig?: StayConfig) {
  const franchiseHours = customConfig?.franchiseHours ?? BUSINESS.franchiseHours;
  const stayRatePerTonHour = customConfig?.stayRatePerTonHour ?? BUSINESS.stayRatePerTonHour;
  const truckCapacityTons = customConfig?.truckCapacityTons ?? BUSINESS.truckCapacityTons;

  const safeWaited = Math.max(0, waitedMinutes);
  const franchiseMin = franchiseHours * 60;
  const excessHours = Math.max(0, (safeWaited - franchiseMin) / 60);
  const billedHours = Math.ceil(excessHours); // "horas excedentes ou fração"
  const value = billedHours * truckCapacityTons * stayRatePerTonHour;

  return {
    waitedMinutes: safeWaited,
    franchiseLeftMinutes: Math.max(0, franchiseMin - safeWaited),
    excessHours,
    billedHours,
    value,
  };
}
