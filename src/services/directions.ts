import { Linking } from 'react-native';

/** URL de rota de carro até o destino (abre no Google Maps ou no app de mapas escolhido). */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

/** Abre a navegação até o destino. Devolve `false` se o aparelho não conseguiu abrir. */
export async function openDirectionsTo(lat: number, lng: number): Promise<boolean> {
  try {
    await Linking.openURL(directionsUrl(lat, lng));
    return true;
  } catch {
    return false;
  }
}
