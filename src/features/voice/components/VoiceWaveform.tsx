import { View } from 'react-native';
import { useVoice } from '../hooks/useVoice';

const BAR_WEIGHTS = [0.42, 0.7, 0.9, 1.0, 0.86, 0.66, 0.4];

export function VoiceWaveform({
  size = 'md',
}: {
  size?: 'sm' | 'md' | 'lg';
}) {
  const state = useVoice((s) => s.state);
  const muted = useVoice((s) => s.muted);
  const audioLevel = useVoice((s) => s.audioLevel);
  const audioSpeaker = useVoice((s) => s.audioSpeaker);

  const isAgent = audioSpeaker === 'agent' || state === 'speaking';
  const isDriver =
    !isAgent && !muted && (audioSpeaker === 'driver' || state === 'listening');
  const isActive = isAgent || isDriver;

  const barColor = isAgent ? '#17B26A' : isDriver ? '#099DFD' : '#344054';
  const effectiveLevel = isActive
    ? Math.max(0.22, audioLevel > 0 ? audioLevel : isAgent ? 0.65 : 0.45)
    : 0.12;

  const maxH = size === 'lg' ? 48 : size === 'sm' ? 16 : 26;
  const minH = size === 'lg' ? 8 : size === 'sm' ? 4 : 6;
  const barW = size === 'lg' ? 6 : size === 'sm' ? 3 : 4;
  const gapClass = size === 'lg' ? 'gap-2' : size === 'sm' ? 'gap-1' : 'gap-1.5';

  return (
    <View
      style={{ height: maxH }}
      className={`flex-row items-center justify-center ${gapClass}`}
      accessibilityLabel="voice-waveform"
    >
      {BAR_WEIGHTS.map((w, idx) => {
        const mod = idx % 2 === 0 ? 1 : 0.88;
        const h = Math.round(minH + (maxH - minH) * Math.min(1, effectiveLevel * w * mod));
        return (
          <View
            key={idx}
            style={{
              width: barW,
              height: h,
              borderRadius: 999,
              backgroundColor: barColor,
              opacity: isActive ? 0.95 : 0.45,
            }}
          />
        );
      })}
    </View>
  );
}
