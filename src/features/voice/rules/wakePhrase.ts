import { normalize } from '../../../utils/text';

/**
 * Como o reconhecedor costuma escrever "AvisAI": "avisai", "avisa ai", "avis ai", "avisa i".
 * "Avisa aí" também é uma expressão comum ("me avisa aí quando chegar"), então só acorda
 * quando vem depois de um chamado ("ei", "hey", "oi"...) ou abre a frase.
 */
const NAME = String.raw`avis\s?a?\s?a?\s?i`;
const CALL = String.raw`(?:ei|hey|hei|oi|ok|ola|fala|e ai)`;
const AT_START = new RegExp(String.raw`^(?:${CALL}\s)?${NAME}\b`);
const CALLED = new RegExp(String.raw`\b${CALL}\s${NAME}\b`);

/** A fala chama o AvisAI ("Ei AvisAI", "AvisAI, ...")? */
export function matchWakePhrase(text: string): boolean {
  const t = normalize(text || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return false;
  return AT_START.test(t) || CALLED.test(t);
}
