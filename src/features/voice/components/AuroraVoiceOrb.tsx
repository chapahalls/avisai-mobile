import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import type { AudioSpeaker } from '../api/voiceSession';
import type { VoiceState } from '../types';

interface AuroraVoiceOrbProps {
  state: VoiceState;
  muted: boolean;
  audioLevel: number;
  audioSpeaker: AudioSpeaker;
  size?: number;
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
      hue: { rim: '#5EEAD4', core: '#075E63', glow: '#2DD4BF' },
    };
  }
  if (muted) {
    return {
      active: false,
      connecting,
      listening: false,
      speaking: false,
      pausedGlyph: false,
      hue: { rim: '#667085', core: '#18243A', glow: '#344054' },
    };
  }
  if (connecting) {
    return {
      active,
      connecting,
      listening,
      speaking,
      pausedGlyph: false,
      hue: { rim: '#A78BFA', core: '#302566', glow: '#8B5CF6' },
    };
  }
  if (listening) {
    return {
      active,
      connecting,
      listening,
      speaking,
      pausedGlyph: false,
      hue: { rim: '#38BDF8', core: '#075985', glow: '#22D3EE' },
    };
  }
  return {
    active: false,
    connecting,
    listening,
    speaking,
    pausedGlyph: false,
    hue: { rim: '#0EA5E9', core: '#13233D', glow: '#1D4ED8' },
  };
}

function MicrophoneGlyph({ paused }: { paused: boolean }) {
  if (paused) {
    return (
      <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
        <Path d="M7.5 6.5v11M16.5 6.5v11" stroke="#F4F6FA" strokeWidth={2.8} strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.25a3.5 3.5 0 0 0-3.5 3.5v5.5a3.5 3.5 0 1 0 7 0v-5.5a3.5 3.5 0 0 0-3.5-3.5Z"
        stroke="#F4F6FA"
        strokeWidth={1.9}
      />
      <Path
        d="M18.5 11.5v.85a6.5 6.5 0 0 1-13 0v-.85M12 18.85v2.1M8.75 21h6.5"
        stroke="#F4F6FA"
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Superfície de voz sem bitmap: camadas translúcidas e animação lenta formam
 * uma aurora que responde ao volume de áudio. O botão pai mantém a semântica
 * de toque e acessibilidade; este componente é exclusivamente visual.
 */
export function AuroraVoiceOrb({
  state,
  muted,
  audioLevel,
  audioSpeaker,
  size = 124,
}: AuroraVoiceOrbProps) {
  const breath = useSharedValue(0);
  const drift = useSharedValue(0);
  const energy = useSharedValue(0);

  const presentation = getAuroraVoicePresentation(state, muted, audioSpeaker);
  const { active: isActive, speaking: isSpeaking, hue } = presentation;
  const level = clampLevel(audioLevel);

  useEffect(() => {
    cancelAnimation(breath);
    cancelAnimation(drift);

    if (!isActive) {
      breath.value = 0;
      drift.value = 0;
      return;
    }

    breath.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: isSpeaking ? 1900 : 2400,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: isSpeaking ? 1900 : 2400,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );
    drift.value = withRepeat(
      withTiming(1, {
        duration: isSpeaking ? 7800 : 11200,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(breath);
      cancelAnimation(drift);
    };
  }, [breath, drift, isActive, isSpeaking]);

  useEffect(() => {
    const target = isActive ? Math.max(0.18, level) : 0;
    energy.value = withSpring(target, {
      stiffness: 180,
      damping: 18,
      mass: 0.55,
    });
  }, [energy, isActive, level]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: (isActive ? 0.24 : 0.34) + breath.value * 0.1 + energy.value * 0.18,
    transform: [{ scale: 1.02 + breath.value * 0.085 + energy.value * 0.16 }],
  }));
  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + breath.value * 0.045 + energy.value * 0.11 },
      { rotate: `${drift.value * 360}deg` },
    ],
  }));
  // O núcleo só escala: o ícone fica sempre vertical e não recebe contra-rotação.
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.045 + energy.value * 0.11 }],
  }));
  const rimSize = Math.round(size * 0.78);
  const coreSize = Math.round(size * 0.56);

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
            width: rimSize,
            height: rimSize,
            borderRadius: rimSize / 2,
            overflow: 'hidden',
            borderWidth: 2,
            borderColor: isActive ? `${hue.rim}BB` : '#0EA5E9B3',
            backgroundColor: isActive ? '#0A1324' : '#0B2A49',
          },
          surfaceStyle,
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="aurora-core" cx="50%" cy="48%" rx="54%" ry="54%">
              <Stop offset="0%" stopColor="#E0F2FE" stopOpacity={isActive ? 0.82 : 0.38} />
              <Stop offset="32%" stopColor="#38BDF8" stopOpacity={isActive ? 0.65 : 0.28} />
              <Stop offset="72%" stopColor={hue.core} stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#081323" stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id="aurora-ribbon-a" x1="5%" y1="14%" x2="96%" y2="84%">
              <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0.08" />
              <Stop offset="45%" stopColor="#2DD4BF" stopOpacity={isActive ? 0.68 : 0.26} />
              <Stop offset="100%" stopColor="#A78BFA" stopOpacity="0.16" />
            </LinearGradient>
            <LinearGradient id="aurora-ribbon-b" x1="10%" y1="80%" x2="92%" y2="18%">
              <Stop offset="0%" stopColor="#818CF8" stopOpacity="0.12" />
              <Stop offset="54%" stopColor="#22D3EE" stopOpacity={isActive ? 0.66 : 0.22} />
              <Stop offset="100%" stopColor="#67E8F9" stopOpacity="0.06" />
            </LinearGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#aurora-core)" />
          <Path
            d="M-10 54C8 25 22 31 38 46c17 16 28 8 39-8 13-19 24-17 35 3v36H-10V54Z"
            fill="url(#aurora-ribbon-a)"
          />
          <Path
            d="M-5 33C13 51 25 67 41 65c16-2 23-25 43-28 15-2 22 5 27 13v28H-5V33Z"
            fill="url(#aurora-ribbon-b)"
          />
          <Circle cx="50" cy="50" r="43" fill="none" stroke="#E0F2FE" strokeOpacity="0.18" />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            width: coreSize,
            height: coreSize,
            borderRadius: coreSize / 2,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: isActive ? '#E0F2FE99' : '#7DD3FCB3',
            backgroundColor: isActive ? '#0B172A99' : '#0C4A6E',
            shadowColor: hue.glow,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: isActive ? 0.75 : 0.5,
            shadowRadius: 14,
            elevation: 7,
          },
          coreStyle,
        ]}
      >
        <MicrophoneGlyph paused={presentation.pausedGlyph} />
      </Animated.View>
    </View>
  );
}
