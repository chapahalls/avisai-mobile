/** Estados visuais da voz (critério C1: clareza, interrupção, recuperação). */
export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted';

export interface TranscriptLine {
  id: string;
  who: 'driver' | 'agent';
  text: string;
}
