import type { LatLng } from './geo';

export interface Stop {
  id: string;
  name: string;
  position: LatLng;
  receiverName?: string;
  /** Telefone do responsável pelo recebimento. Mock: nunca colocar número real no repositório (E7). */
  receiverPhone?: string;
}

export interface RouteMock {
  tripId: string;
  rotaId: number;
  plate: string;
  invoice?: string;
  cargo?: string;
  weightT?: number;
  unloadWindow?: string | null;
  company?: string;
  driverName?: string | null;
  origin: Stop;
  destination: Stop;
  receiver: {
    name: string;
    phone: string;
    company?: string;
  };
  path: LatLng[];
}
