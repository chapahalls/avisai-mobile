/** Normaliza texto para comparação: minúsculas e sem acentos. */
export const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
