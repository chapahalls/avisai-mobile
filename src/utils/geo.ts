import type { LatLng } from '../types/geo';

/** Distância em km (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Velocidade (km/h) entre duas posições do GPS. Alguns aparelhos mandam a velocidade vazia (-1):
 * aí ela sai da distância percorrida no intervalo. Intervalo zero ou negativo → `null`.
 */
export function speedBetweenKmh(a: LatLng, aAtMs: number, b: LatLng, bAtMs: number): number | null {
  const hours = (bAtMs - aAtMs) / 3_600_000;
  if (!(hours > 0)) return null;
  return Math.round(distanceKm(a, b) / hours);
}

/** Ponto ao longo da polilinha para um progresso 0..1. */
export function pointAt(path: LatLng[], progress: number): LatLng {
  if (path.length === 1 || progress <= 0) return path[0];
  if (progress >= 1) return path[path.length - 1];
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = distanceKm(path[i - 1], path[i]);
    seg.push(d);
    total += d;
  }
  let target = total * progress;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i]) {
      const t = seg[i] === 0 ? 0 : target / seg[i];
      return {
        lat: path[i].lat + (path[i + 1].lat - path[i].lat) * t,
        lng: path[i].lng + (path[i + 1].lng - path[i].lng) * t,
      };
    }
    target -= seg[i];
  }
  return path[path.length - 1];
}

export function pathLengthKm(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceKm(path[i - 1], path[i]);
  return total;
}

/**
 * Liga os pontos em sequência, com `pointsPerSegment` passos entre cada par: usado para contornar
 * waypoints (reais ou de curva) em vez de desenhar uma única linha reta de origem a destino.
 */
export function threadWaypoints(waypoints: LatLng[], pointsPerSegment = 8): LatLng[] {
  if (waypoints.length < 2) return waypoints;
  const steps = Math.max(1, Math.round(pointsPerSegment));
  const path: LatLng[] = [waypoints[0]];
  for (let i = 1; i < waypoints.length; i++) {
    const from = waypoints[i - 1];
    const to = waypoints[i];
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      path.push({
        lat: Number((from.lat + (to.lat - from.lat) * t).toFixed(6)),
        lng: Number((from.lng + (to.lng - from.lng) * t).toFixed(6)),
      });
    }
  }
  return path;
}

/**
 * Sem waypoints reais conhecidos: curva o meio do trajeto para o lado (duas dobras, tipo "S"),
 * só para não desenhar uma linha matematicamente reta de origem a destino num mapa de verdade.
 */
export function bendRoute(from: LatLng, to: LatLng, offsetRatio = 0.09): LatLng[] {
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  const at = (t: number, side: number): LatLng => ({
    lat: from.lat + dLat * t - dLng * offsetRatio * side,
    lng: from.lng + dLng * t + dLat * offsetRatio * side,
  });
  return [from, at(1 / 3, 1), at(2 / 3, 0.55), to];
}
