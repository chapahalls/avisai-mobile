import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import type { AudioSpeaker } from '../api/voiceSession';
import type { VoiceState } from '../types';
import { colors, voiceOrb, withAlpha } from '../../../lib/theme';

interface AuroraVoiceOrbProps {
  state: VoiceState;
  muted: boolean;
  audioLevel: number;
  audioSpeaker: AudioSpeaker;
  size?: number;
  showGlyph?: boolean;
}

export interface AuroraVoicePresentation {
  active: boolean;
  connecting: boolean;
  listening: boolean;
  speaking: boolean;
  pausedGlyph: boolean;
  hue: { rim: string; core: string; glow: string };
}

function clampLevel(level: number) {
  return Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
}

/** Estado visual puro para manter o toque do microfone independente do ornamento da aurora. */
export function getAuroraVoicePresentation(
  state: VoiceState,
  muted: boolean,
  audioSpeaker: AudioSpeaker,
): AuroraVoicePresentation {
  const connecting = state === 'thinking';
  const speaking = state === 'speaking' || audioSpeaker === 'agent';
  const listening = !muted && (state === 'listening' || audioSpeaker === 'driver');
  const active = connecting || speaking || listening;

  if (speaking) {
    return {
      active,
      connecting,
      listening,
      speaking,
      pausedGlyph: state === 'speaking',
      hue: { rim: voiceOrb.mint, core: voiceOrb.forest, glow: colors.brand[400] },
    };
  }
  if (muted) {
    return {
      active: false,
      connecting,
      listening: false,
      speaking: false,
      pausedGlyph: false,
      hue: { rim: colors.ink[300], core: colors.ink[800], glow: colors.ink[700] },
    };
  }
  if (connecting) {
    return {
      active,
      connecting,
      listening,
      speaking,
      pausedGlyph: false,
      hue: { rim: voiceOrb.lime, core: voiceOrb.deep, glow: colors.rodar[400] },
    };
  }
  if (listening) {
    return {
      active,
      connecting,
      listening,
      speaking,
      pausedGlyph: false,
      hue: { rim: colors.brand[300], core: voiceOrb.deep, glow: voiceOrb.mint },
    };
  }
  return {
    active: false,
    connecting,
    listening,
    speaking,
    pausedGlyph: false,
    hue: { rim: voiceOrb.leaf, core: voiceOrb.deep, glow: colors.brand[600] },
  };
}

function MicrophoneGlyph({ paused, color }: { paused: boolean; color: string }) {
  if (paused) {
    return (
      <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
        <Path d="M7.5 6.5v11M16.5 6.5v11" stroke={color} strokeWidth={2.8} strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.25a3.5 3.5 0 0 0-3.5 3.5v5.5a3.5 3.5 0 1 0 7 0v-5.5a3.5 3.5 0 0 0-3.5-3.5Z"
        stroke={color}
        strokeWidth={1.9}
      />
      <Path
        d="M18.5 11.5v.85a6.5 6.5 0 0 1-13 0v-.85M12 18.85v2.1M8.75 21h6.5"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Esfera do AvisAI (mockups `05-modo-viagem`, `06-chat-ao-vivo` e `13-componente-avisai`):
 * degradê verde com uma faixa clara que gira devagar e pulsa com o volume do áudio.
 * Sem bitmap. O botão pai cuida do toque e da acessibilidade; este componente só desenha.
 * `showGlyph` mostra o microfone (ou a pausa, quando tocar interrompe o agente).
 */
export function AuroraVoiceOrb({
  state,
  muted,
  audioLevel,
  audioSpeaker,
  size = 124,
  showGlyph = true,
}: AuroraVoiceOrbProps) {
  const breath = useSharedValue(0);
  const drift = useSharedValue(0);
  const energy = useSharedValue(0);
  // Com "reduzir movimento" a esfera não gira nem respira; só o volume a faz pulsar.
  const reduceMotion = useReducedMotion();

  const presentation = getAuroraVoicePresentation(state, muted, audioSpeaker);
  const { active: isActive, speaking: isSpeaking, hue } = presentation;
  const level = clampLevel(audioLevel);

  useEffect(() => {
    cancelAnimation(breath);
    cancelAnimation(drift);

    if (!isActive || reduceMotion) {
      breath.value = 0;
      drift.value = 0;
      return;
    }

    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: isSpeaking ? 1900 : 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: isSpeaking ? 1900 : 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    drift.value = withRepeat(
      withTiming(1, { duration: isSpeaking ? 9000 : 14000, easing: Easing.linear }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(breath);
      cancelAnimation(drift);
    };
  }, [breath, drift, isActive, isSpeaking, reduceMotion]);

  useEffect(() => {
    const target = isActive ? Math.max(0.18, level) : 0;
    energy.value = withSpring(target, { stiffness: 180, damping: 18, mass: 0.55 });
  }, [energy, isActive, level]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: (isActive ? 0.22 : 0.14) + breath.value * 0.1 + energy.value * 0.2,
    transform: [{ scale: 1 + breath.value * 0.06 + energy.value * 0.14 }],
  }));
  // A esfera inteira gira: a faixa clara "passeia" como no mockup.
  const sphereStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + breath.value * 0.03 + energy.value * 0.08 },
      { rotate: `${-14 + drift.value * 360}deg` },
    ],
  }));
  // O ícone só escala; nunca gira.
  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + energy.value * 0.08 }],
  }));

  const sphereSize = Math.round(size * 0.86);
  const glyphColor = withAlpha(colors.ink[950], 0.85);

  return (
    <View
      pointerEvents="none"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: hue.glow,
          },
          haloStyle,
        ]}
      />

      <Animated.View
        style={[
          {
            position: 'absolute',
            width: sphereSize,
            height: sphereSize,
            borderRadius: sphereSize / 2,
            overflow: 'hidden',
            borderWidth: 2,
            borderColor: withAlpha(hue.rim, isActive ? 0.55 : 0.3),
            shadowColor: hue.glow,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: isActive ? 0.7 : 0.35,
            shadowRadius: 16,
            elevation: 8,
          },
          sphereStyle,
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="orb-band" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={hue.core} />
              <Stop offset="28%" stopColor={hue.glow} />
              <Stop offset="50%" stopColor={voiceOrb.highlight} stopOpacity={isActive ? 1 : 0.75} />
              <Stop offset="68%" stopColor={hue.rim} />
              <Stop offset="100%" stopColor={hue.core} />
            </LinearGradient>
            <RadialGradient id="orb-shade" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="70%" stopColor={colors.ink[950]} stopOpacity="0" />
              <Stop offset="100%" stopColor={colors.ink[950]} stopOpacity="0.35" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#orb-band)" />
          <Circle cx="50" cy="50" r="50" fill="url(#orb-shade)" />
        </Svg>
      </Animated.View>

      {showGlyph ? (
        <Animated.View style={glyphStyle}>
          <MicrophoneGlyph paused={presentation.pausedGlyph} color={glyphColor} />
        </Animated.View>
      ) : null}
    </View>
  );
}
