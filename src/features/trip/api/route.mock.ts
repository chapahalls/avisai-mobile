import type { LatLng } from '../../../types/geo';
import type { RouteMock } from '../types';

const ORIGIN_POS: LatLng = { lat: -23.1857, lng: -46.8978 };
const DEST_POS: LatLng = { lat: -22.9056, lng: -47.0608 };

function interpolatePath(from: LatLng, to: LatLng, count = 10): LatLng[] {
  const steps = Math.max(2, count) - 1;
  return Array.from({ length: steps + 1 }, (_, i) => ({
    lat: Number((from.lat + ((to.lat - from.lat) * i) / steps).toFixed(6)),
    lng: Number((from.lng + ((to.lng - from.lng) * i) / steps).toFixed(6)),
  }));
}

/** Rota FICTÍCIA para a demo alinhada ao backend/app/seed.py (declarada no README). */
export const ROUTE: RouteMock = {
  tripId: 'rota-1',
  rotaId: 1,
  plate: 'RST-4B21',
  origin: { id: 'o1', name: 'CD Jundiaí', position: ORIGIN_POS },
  destination: {
    id: 'd1',
    name: 'Mercadão Campinas, CD Norte',
    position: DEST_POS,
    receiverName: 'Mercadão Campinas · Marcos',
    receiverPhone: '+55 00 0000-0000',
  },
  receiver: {
    name: 'Mercadão Campinas · Marcos',
    phone: '+55 00 0000-0000',
  },
  path: interpolatePath(ORIGIN_POS, DEST_POS, 10),
};
