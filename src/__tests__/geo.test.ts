import { describe, expect, it } from 'vitest';
import { distanceKm, pathLengthKm, pointAt } from '../utils/geo';
import { ROUTE } from '../features/trip/api/route.mock';

describe('geo utils', () => {
  it('calcula distancia haversine corretamente', () => {
    expect(distanceKm(ROUTE.origin.position, ROUTE.origin.position)).toBeCloseTo(0, 5);
    const d = distanceKm(ROUTE.origin.position, ROUTE.destination.position);
    expect(d).toBeGreaterThan(20);
    expect(d).toBeLessThan(40);
  });

  it('interpola pontos ao longo da polilinha (pointAt)', () => {
    expect(pointAt(ROUTE.path, 0)).toEqual(ROUTE.origin.position);
    expect(pointAt(ROUTE.path, -0.5)).toEqual(ROUTE.origin.position);
    expect(pointAt(ROUTE.path, 1)).toEqual(ROUTE.destination.position);
    expect(pointAt(ROUTE.path, 1.5)).toEqual(ROUTE.destination.position);

    const mid = pointAt(ROUTE.path, 0.5);
    expect(mid.lat).toBeGreaterThan(ROUTE.origin.position.lat);
    expect(mid.lat).toBeLessThan(ROUTE.destination.position.lat);
  });

  it('calcula o comprimento total da rota em km (pathLengthKm)', () => {
    expect(pathLengthKm([ROUTE.origin.position])).toBe(0);
    const total = pathLengthKm(ROUTE.path);
    const direct = distanceKm(ROUTE.origin.position, ROUTE.destination.position);
    expect(total).toBeGreaterThanOrEqual(direct);
  });
});
