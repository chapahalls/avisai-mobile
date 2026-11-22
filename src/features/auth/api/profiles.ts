import type { DemoProfile } from '../../../types/backend';
import type { LoginProfileOption } from '../types';

export const DEFAULT_LOGIN_PROFILES: LoginProfileOption[] = [
  {
    id: 'u-driver-1',
    email: 'carlos@rotasul.test',
    name: 'Carlos Andrade',
    role: 'driver',
    driverId: 1,
    tripId: '1',
    plate: 'RST-4B21',
    routeSummary: 'CD Jundiaí → Mercadão Campinas, CD Norte',
  },
  {
    id: 'u-driver-2',
    email: 'marina@rotasul.test',
    name: 'Marina Souza',
    role: 'driver',
    driverId: 2,
    tripId: '2',
    plate: 'DMO-2A02',
    routeSummary: 'CD Jundiaí → Recebedor fictício DEMO · Sorocaba',
  },
  {
    id: 'u-driver-3',
    email: 'joao@rotasul.test',
    name: 'João Pereira',
    role: 'driver',
    driverId: 3,
    tripId: '3',
    plate: 'DMO-3A03',
    routeSummary: 'CD Jundiaí → Recebedor fictício DEMO · Sumaré',
  },
];

/**
 * Mescla a lista remota (`GET /api/users?role=driver`) com os 3 perfis canônicos da demo,
 * garantindo sempre exatamente 3 opções de motorista na tela de login.
 */
export function mergeWithBackendProfiles(remote: DemoProfile[]): LoginProfileOption[] {
  if (!Array.isArray(remote) || remote.length === 0) {
    return DEFAULT_LOGIN_PROFILES.map((p) => ({ ...p }));
  }

  const remoteDrivers = remote.filter(
    (u) => u && u.role === 'driver' && typeof u.email === 'string' && u.email.trim().length > 0,
  );

  if (remoteDrivers.length === 0) {
    return DEFAULT_LOGIN_PROFILES.map((p) => ({ ...p }));
  }

  const byEmail = new Map<string, DemoProfile>();
  for (const r of remoteDrivers) {
    byEmail.set(r.email.trim().toLowerCase(), r);
  }

  const hasCanonicalMatch = DEFAULT_LOGIN_PROFILES.some((c) =>
    byEmail.has(c.email.toLowerCase()),
  );

  if (hasCanonicalMatch) {
    return DEFAULT_LOGIN_PROFILES.map((canonical) => {
      const match = byEmail.get(canonical.email.toLowerCase());
      if (!match) return { ...canonical };
      return {
        ...canonical,
        id: match.id || canonical.id,
        email: match.email.trim() || canonical.email,
        name: match.name || canonical.name,
        role: 'driver',
        driverId: match.driverId !== undefined ? match.driverId : canonical.driverId,
        tripId: match.tripId !== undefined ? match.tripId : canonical.tripId,
      };
    });
  }

  const sortedRemote = [...remoteDrivers].sort((a, b) => {
    const aHasTrip = a.tripId !== null && a.tripId !== undefined ? 1 : 0;
    const bHasTrip = b.tripId !== null && b.tripId !== undefined ? 1 : 0;
    return bHasTrip - aHasTrip;
  });

  const merged: LoginProfileOption[] = sortedRemote.slice(0, 3).map((r, idx) => {
    const fallback = DEFAULT_LOGIN_PROFILES[idx];
    return {
      id: r.id || fallback?.id || `u-driver-${idx + 1}`,
      email: r.email.trim(),
      name: r.name || fallback?.name || r.email.trim(),
      role: 'driver',
      driverId: r.driverId ?? fallback?.driverId ?? idx + 1,
      tripId: r.tripId ?? null,
      plate: fallback?.plate,
      routeSummary: fallback?.routeSummary,
    };
  });

  for (const canonical of DEFAULT_LOGIN_PROFILES) {
    if (merged.length >= 3) break;
    if (!merged.some((m) => m.email.toLowerCase() === canonical.email.toLowerCase())) {
      merged.push({ ...canonical });
    }
  }

  return merged.slice(0, 3);
}
