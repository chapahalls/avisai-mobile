import { describe, expect, it } from 'vitest';
import { bendRoute, distanceKm, pathLengthKm, pointAt, threadWaypoints } from '../utils/geo';
import { ROUTE } from '../features/trip/api/route.mock';

/** Maior distância (km) de um ponto do caminho até a linha reta origem→destino. */
function maxDeviationFromStraightLineKm(path: typeof ROUTE.path, from: typeof ROUTE.origin.position, to: typeof ROUTE.destination.position): number {
  const direct = distanceKm(from, to);
  if (direct === 0) return 0;
  return Math.max(
    ...path.map((p) => {
      // Aproximação planar (distâncias curtas): área do triângulo / base = altura (desvio lateral).
      const toOrigin = distanceKm(from, p);
      const toDest = distanceKm(p, to);
      // Fórmula de Heron para a área do triângulo origem-ponto-destino.
      const s = (direct + toOrigin + toDest) / 2;
      const areaSq = Math.max(0, s * (s - direct) * (s - toOrigin) * (s - toDest));
      return (2 * Math.sqrt(areaSq)) / direct;
    }),
  );
}

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

  it('a rota demo segue cidades reais no meio do caminho, não uma linha reta origem→destino', () => {
    // Sem isso, a linha desenhada sobre o mapa real atravessa campo, sem seguir estrada nenhuma.
    const deviationKm = maxDeviationFromStraightLineKm(
      ROUTE.path,
      ROUTE.origin.position,
      ROUTE.destination.position,
    );
    expect(deviationKm).toBeGreaterThan(1);
  });

  it('threadWaypoints liga os pontos em sequência, passando por cada waypoint', () => {
    const waypoints = [{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 1, lng: 1 }];
    const path = threadWaypoints(waypoints, 4);
    expect(path[0]).toEqual(waypoints[0]);
    expect(path[path.length - 1]).toEqual(waypoints[2]);
    expect(path).toContainEqual(waypoints[1]);
    expect(path.length).toBe(1 + 4 * 2);
  });

  it('bendRoute cria pontos fora da linha reta entre origem e destino', () => {
    const from = { lat: 0, lng: 0 };
    const to = { lat: 1, lng: 0 };
    const bent = bendRoute(from, to);
    expect(bent[0]).toEqual(from);
    expect(bent[bent.length - 1]).toEqual(to);
    // Os pontos do meio saem do eixo reto (lng=0): é a curva que evita a linha reta.
    expect(Math.abs(bent[1].lng)).toBeGreaterThan(0);
    expect(Math.abs(bent[2].lng)).toBeGreaterThan(0);
  });
});
