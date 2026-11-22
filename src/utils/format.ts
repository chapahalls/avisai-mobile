import i18n from '../lib/i18n';

const currentLocale = () => (i18n.language?.toLowerCase().startsWith('en') ? 'en-US' : 'pt-BR');

export const brl = (v: number) =>
  v.toLocaleString(currentLocale(), { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

/** Minutos simulados → "4h12". */
export const hhmm = (minutes: number) => {
  const safe = Math.max(0, minutes);
  const h = Math.floor(safe / 60);
  const m = Math.floor(safe % 60);
  return `${h}h${m.toString().padStart(2, '0')}`;
};

export const formatTime = (timestampMs: number) =>
  new Date(timestampMs).toLocaleTimeString(currentLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
