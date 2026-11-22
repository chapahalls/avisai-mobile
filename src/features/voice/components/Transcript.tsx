import { useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { useVoice } from '../hooks/useVoice';

export function Transcript() {
  const { t } = useTranslation();
  const lines = useVoice((s) => s.transcript);
  const liveTranscript = useVoice((s) => s.liveTranscript);
  const scrollRef = useRef<ScrollView>(null);

  if (lines.length === 0 && !liveTranscript) {
    return (
      <View className="bg-ink-950/60 border border-ink-800 rounded-xl px-4 py-5 my-1 items-center">
        <View className="w-9 h-9 rounded-full bg-brand-500/15 border border-brand-500/40 items-center justify-center mb-2">
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"
              stroke="#099DFD"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </View>
        <Text className="text-ink-50 text-xs font-semibold text-center">
          {t('voice.emptyTitle')}
        </Text>
        <Text className="text-ink-300 text-xs text-center mt-0.5 leading-4">
          {t('voice.emptyHint')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      className="max-h-52"
      contentContainerStyle={{ paddingVertical: 6 }}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
    >
      {lines.slice(-8).map((l) => {
        const isAgent = l.who === 'agent';
        return (
          <View
            key={l.id}
            className={`mb-2.5 max-w-[86%] ${isAgent ? 'self-start' : 'self-end'}`}
          >
            <Text
              className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                isAgent ? 'text-brand-500 ml-1' : 'text-ink-300 mr-1 text-right'
              }`}
            >
              {isAgent ? t('voice.agentTag') : t('voice.driverTag')}
            </Text>
            <View
              className={`px-3.5 py-2.5 ${
                isAgent
                  ? 'bg-ink-800 border border-ink-700/80 rounded-2xl rounded-tl-sm'
                  : 'bg-brand-600 rounded-2xl rounded-tr-sm'
              }`}
            >
              <Text className="text-ink-50 text-sm leading-5">{l.text}</Text>
            </View>
          </View>
        );
      })}
      {liveTranscript ? (
        <View
          key="live-transcript"
          className={`mb-2.5 max-w-[86%] ${
            liveTranscript.who === 'agent' ? 'self-start' : 'self-end'
          }`}
        >
          <Text
            className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
              liveTranscript.who === 'agent'
                ? 'text-brand-500 ml-1'
                : 'text-ink-300 mr-1 text-right'
            }`}
          >
            {liveTranscript.who === 'agent' ? t('voice.agentTag') : t('voice.driverTag')} ·{' '}
            {t('voice.liveStreamingTag')}
          </Text>
          <View
            className={`px-3.5 py-2.5 border border-dashed ${
              liveTranscript.who === 'agent'
                ? 'bg-ink-900/90 border-brand-500/70 rounded-2xl rounded-tl-sm'
                : 'bg-brand-600/80 border-brand-50/70 rounded-2xl rounded-tr-sm'
            }`}
          >
            <Text className="text-ink-50 text-sm leading-5">{liveTranscript.text}…</Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
