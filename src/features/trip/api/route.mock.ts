import type { RouteMock } from '../types';

/** Rota FICTÍCIA para a demo (declarada no README). */
export const ROUTE: RouteMock = {
  tripId: 'trip-demo-001',
  plate: 'ABC1D23',
  origin: { id: 'o1', name: 'CD Origem (fictício)', position: { lat: -23.0905, lng: -47.2181 } },
  destination: {
    id: 'd1',
    name: 'Supermercado Destino (fictício)',
    position: { lat: -22.9056, lng: -47.0608 },
    receiverName: 'Recebimento — Doca',
    receiverPhone: '+55 00 0000-0000',
  },
  path: [
    { lat: -23.0905, lng: -47.2181 },
    { lat: -23.0601, lng: -47.1905 },
    { lat: -23.0218, lng: -47.1512 },
    { lat: -22.9812, lng: -47.1203 },
    { lat: -22.9454, lng: -47.0911 },
    { lat: -22.9056, lng: -47.0608 },
  ],
};
