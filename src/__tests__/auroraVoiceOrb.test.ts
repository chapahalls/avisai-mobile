import { describe, expect, it, vi } from 'vitest';

import { getAuroraVoicePresentation } from '../features/voice/components/AuroraVoiceOrb';
import { colors, voiceOrb } from '../lib/theme';

vi.mock('react-native', () => ({
  View: () => null,
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: () => null },
  cancelAnimation: vi.fn(),
  Easing: {
    inOut: (value: unknown) => value,
    linear: 'linear',
    sin: 'sin',
  },
  useAnimatedStyle: () => ({}),
  useReducedMotion: () => false,
  useSharedValue: (value: number) => ({ value }),
  withRepeat: (animation: unknown) => animation,
  withSequence: (...animations: unknown[]) => animations[0],
  withSpring: (value: number) => value,
  withTiming: (value: number) => value,
}));
vi.mock('react-native-svg', () => ({
  default: () => null,
  Circle: () => null,
  Defs: () => null,
  LinearGradient: () => null,
  Path: () => null,
  RadialGradient: () => null,
  Stop: () => null,
}));

describe('AuroraVoiceOrb presentation', () => {
  it('mantém o affordance de interromper quando o agente está falando', () => {
    const presentation = getAuroraVoicePresentation('speaking', false, 'agent');

    expect(presentation.active).toBe(true);
    expect(presentation.speaking).toBe(true);
    expect(presentation.pausedGlyph).toBe(true);
    expect(presentation.hue.glow).toBe(colors.brand[400]);
  });

  it('não aparenta ouvir quando o microfone local está em mudo', () => {
    const presentation = getAuroraVoicePresentation('listening', true, 'driver');

    expect(presentation.active).toBe(false);
    expect(presentation.listening).toBe(false);
    expect(presentation.pausedGlyph).toBe(false);
    expect(presentation.hue.rim).toBe(colors.ink[300]);
  });

  it('distingue conexão e fala do motorista sem alterar a ação do botão', () => {
    const connecting = getAuroraVoicePresentation('thinking', false, 'none');
    const driver = getAuroraVoicePresentation('listening', false, 'driver');

    expect(connecting.active).toBe(true);
    expect(connecting.connecting).toBe(true);
    expect(connecting.hue.glow).toBe(colors.rodar[400]);
    expect(driver.active).toBe(true);
    expect(driver.listening).toBe(true);
    expect(driver.pausedGlyph).toBe(false);
    expect(driver.hue.glow).toBe(voiceOrb.mint);
  });
});
