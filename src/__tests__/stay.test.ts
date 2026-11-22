import { describe, expect, it } from 'vitest';
import { computeStay } from '../features/trip/rules/stay';

describe('stay rules (R5 - Lei 11.442/2007)', () => {
  it('nao cobra estadia dentro da franquia padrao de 5h (300 min)', () => {
    expect(computeStay(0)).toEqual({
      waitedMinutes: 0,
      franchiseLeftMinutes: 300,
      excessHours: 0,
      billedHours: 0,
      value: 0,
    });

    const atLimit = computeStay(300);
    expect(atLimit.franchiseLeftMinutes).toBe(0);
    expect(atLimit.excessHours).toBe(0);
    expect(atLimit.value).toBe(0);
  });

  it('arredonda fracao de hora excedente para cima e calcula R$ 2,50 x 28t = R$ 70/h', () => {
    // 5h01 (301 min) -> 1 min excedente -> 1 hora cobrada -> R$ 70,00
    const oneMinuteOver = computeStay(301);
    expect(oneMinuteOver.billedHours).toBe(1);
    expect(oneMinuteOver.value).toBe(70);

    // 6h00 (360 min) -> 1h exata excedente -> R$ 70,00
    const oneHourOver = computeStay(360);
    expect(oneHourOver.billedHours).toBe(1);
    expect(oneHourOver.value).toBe(70);

    // 6h15 (375 min) -> 1,25h excedente -> 2 horas cobradas -> R$ 140,00
    const fractionSecondHour = computeStay(375);
    expect(fractionSecondHour.billedHours).toBe(2);
    expect(fractionSecondHour.value).toBe(140);
  });

  it('permite configurar franquia, capacidade e tarifa por contrato', () => {
    // Franquia 4h (240 min), caminhao 40t, tarifa R$ 3,00/t/h -> R$ 120/h
    const custom = computeStay(310, {
      franchiseHours: 4,
      truckCapacityTons: 40,
      stayRatePerTonHour: 3.0,
    });
    expect(custom.franchiseLeftMinutes).toBe(0);
    expect(custom.billedHours).toBe(2); // 70 min excedentes = 2h
    expect(custom.value).toBe(240);
  });
});
