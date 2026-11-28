import { useAvisaiDock } from './useAvisaiDock';
import { useMicStatus } from './useMicStatus';
import { useVoice } from './useVoice';

/**
 * Ação de "falar com o AvisAI" usada em qualquer tela (cabeçalho, documentos, mensagens, fila...).
 * Em voz real (LiveKit, mãos-livres) só liga o microfone: nada de Painel por cima da tela, a
 * resposta aparece no balão da esfera (mockup `13-componente-avisai`, estado "pronto"). No modo
 * mock (sem microfone real ouvindo) abre o Painel de frases prontas, como antes.
 */
export function useTalkToAvisai() {
  const { directVoice } = useMicStatus();
  const listen = useVoice((s) => s.listen);
  const openPanel = useAvisaiDock((s) => s.openPanel);

  return () => {
    if (directVoice) {
      listen();
      return;
    }
    openPanel();
  };
}
