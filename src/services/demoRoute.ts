import type { LatLng } from '../types/geo';
import type { RouteMock } from '../types/route';
import { threadWaypoints } from '../utils/geo';

const ORIGIN_POS: LatLng = { lat: -23.1857, lng: -46.8978 };
const DEST_POS: LatLng = { lat: -22.9056, lng: -47.0608 };

/**
 * Trajeto FICTÍCIO (rota é mock), mas os pontos do meio seguem a posição real das cidades no
 * corredor Jundiaí → Campinas (Rodovia dos Bandeirantes, via Louveira, Vinhedo e Valinhos): sem
 * isso, a linha no mapa real fica reta de ponta a ponta, cruzando campo e sem seguir estrada.
 */
const ROUTE_WAYPOINTS: LatLng[] = [
  ORIGIN_POS,
  { lat: -23.0919, lng: -46.9445 }, // Louveira
  { lat: -23.0303, lng: -46.9733 }, // Vinhedo
  { lat: -22.9707, lng: -46.9966 }, // Valinhos
  DEST_POS,
];

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
  path: threadWaypoints(ROUTE_WAYPOINTS, 8),
};
