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
