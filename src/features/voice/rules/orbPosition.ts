/** Posição da esfera flutuante do AvisAI (canto superior esquerdo, em dp). */
export interface OrbPoint {
  x: number;
  y: number;
}

/** Área onde a esfera pode ficar inteira na tela (fora das bordas e da área do sistema). */
export interface OrbBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Posição salva em proporção (0..1) da área livre: vale em qualquer tamanho ou rotação de tela. */
export type OrbRatio = OrbPoint;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

export function clampOrb(p: OrbPoint, b: OrbBounds): OrbPoint {
  return { x: clamp(p.x, b.minX, b.maxX), y: clamp(p.y, b.minY, b.maxY) };
}

export function orbToRatio(p: OrbPoint, b: OrbBounds): OrbRatio {
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  return {
    x: w > 0 ? clamp((p.x - b.minX) / w, 0, 1) : 0,
    y: h > 0 ? clamp((p.y - b.minY) / h, 0, 1) : 0,
  };
}

export function orbFromRatio(r: OrbRatio, b: OrbBounds): OrbPoint {
  return clampOrb(
    { x: b.minX + clamp(r.x, 0, 1) * (b.maxX - b.minX), y: b.minY + clamp(r.y, 0, 1) * (b.maxY - b.minY) },
    b,
  );
}
