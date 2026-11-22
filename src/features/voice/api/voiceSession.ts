/**
 * Porta para a voz real. Hoje: mock (falas prontas + expo-speech para o TTS).
 * Dev build: implementar com react-native-agora, entrando no canal criado pelo agent-server
 * (POST /agent/start → Agora Conversational AI Engine). Os estados visuais continuam os mesmos.
 */
export interface VoiceSession {
  start(channel: string): Promise<void>;
  stop(): Promise<void>;
  /** Barge-in: o motorista fala por cima e o agente para. */
  interrupt(): void;
}

export const mockVoiceSession: VoiceSession = {
  async start() {},
  async stop() {},
  interrupt() {},
};
