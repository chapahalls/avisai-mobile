import { BUSINESS } from '../../../lib/config';

/**
 * Estadia (Lei 11.442/2007, art. 11): conta da CHEGADA ao endereço; depois da franquia,
 * valor por tonelada/hora sobre a capacidade total do veículo. Franquia e valor são configuráveis.
 */
export function computeStay(waitedMinutes: number) {
  const franchiseMin = BUSINESS.franchiseHours * 60;
  const excessHours = Math.max(0, (waitedMinutes - franchiseMin) / 60);
  const value = Math.ceil(excessHours) * BUSINESS.truckCapacityTons * BUSINESS.stayRatePerTonHour; // "ou fração"
  return {
    waitedMinutes,
    franchiseLeftMinutes: Math.max(0, franchiseMin - waitedMinutes),
    excessHours,
    value,
  };
}
