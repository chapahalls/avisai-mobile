import { create } from 'zustand';

/**
 * Onde o AvisAI está aberto na tela: só a esfera flutuante, o painel de comandos
 * (mockup `13-componente-avisai`) ou a conversa em tela cheia (`06-chat-ao-vivo`).
 * Qualquer tela abre o painel com `openPanel()` sem conhecer o componente.
 */
interface AvisaiDockState {
  panelOpen: boolean;
  chatOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  openChat: () => void;
  closeChat: () => void;
}

export const useAvisaiDock = create<AvisaiDockState>((set) => ({
  panelOpen: false,
  chatOpen: false,
  openPanel: () => set({ panelOpen: true, chatOpen: false }),
  closePanel: () => set({ panelOpen: false }),
  openChat: () => set({ chatOpen: true, panelOpen: false }),
  closeChat: () => set({ chatOpen: false }),
}));
