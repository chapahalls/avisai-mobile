export interface Session {
  token: string;
  name: string;
  company: string;
  email?: string;
  driverId?: number;
  tripId?: string;
  role?: string;
}

export interface LoginProfileOption {
  id: string;
  email: string;
  name: string;
  role: 'driver' | 'cco';
  driverId: number | null;
  tripId: string | null;
  plate?: string;
  routeSummary?: string;
}
