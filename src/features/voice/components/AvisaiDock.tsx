import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../components/Icon';
import { getCurrentLanguage } from '../../../lib/i18n';
import { hapticTap } from '../../../utils/haptics';
import { getQuickUtterances } from '../api/agentMock';
import { useAvisaiDock } from '../hooks/useAvisaiDock';
import { useMicStatus } from '../hooks/useMicStatus';
import { useVoice } from '../hooks/useVoice';
import { AuroraVoiceOrb } from './AuroraVoiceOrb';
import { CabinModeModal } from './CabinModeModal';

/** Quanto tempo o balão com a última fala do agente fica visível. */
const BUBBLE_MS = 6000;
const ORB_SIZE = 76;

export interface AvisaiDockProps {
  /** Mostra a esfera flutuante (só nas abas; telas empilhadas têm os próprios botões). */
  showOrb: boolean;
  /** Distância da esfera até a base da tela (acima da barra de abas). */
  bottomOffset: number;
  /** Resumo da espera repassado à conversa em tela cheia. */
  stayTimer?: string | null;
  stayValue?: string | null;
  stayOver?: boolean;
  /** Pílula de contexto no topo da conversa (ex.: "Modo viagem · 82 km/h"). */
  contextPill?: string | null;
}

/**
 * Componente AvisAI (mockup `13-componente-avisai`): esfera flutuante que abre o painel
 * de comandos; o painel abre a conversa em tela cheia. Quando o agente fala, um balão
 * mostra a fala ao lado da esfera por alguns segundos.
 */
export function AvisaiDock({
  showOrb,
  bottomOffset,
  stayTimer,
  stayValue,
  stayOver,
  contextPill,
}: AvisaiDockProps) {
  const { t } = useTranslation();
  const state = useVoice((s) => s.state);
  const muted = useVoice((s) => s.muted);
  const audioLevel = useVoice((s) => s.audioLevel);
  const audioSpeaker = useVoice((s) => s.audioSpeaker);
  const transcript = useVoice((s) => s.transcript);
  const liveTranscript = useVoice((s) => s.liveTranscript);
  const { panelOpen, chatOpen, openPanel, closePanel, closeChat } = useAvisaiDock();

  const lastAgent = [...transcript].reverse().find((l) => l.who === 'agent');
  const bubbleText = liveTranscript?.who === 'agent' ? liveTranscript.text : lastAgent?.text;
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!bubbleText) return;
    setBubbleVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBubbleVisible(false), BUBBLE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [bubbleText, lastAgent?.id]);

  const stateLabel = t(`voice.state.${state}`);

  return (
    <>
      {showOrb && !panelOpen && !chatOpen ? (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', right: 12, left: 12, bottom: bottomOffset }}
          className="flex-row items-end justify-end"
        >
          {bubbleVisible && bubbleText ? (
            <Pressable
              onPress={() => setBubbleVisible(false)}
              accessibilityRole="button"
              accessibilityLabel={`${t('voice.agentTag')}: ${bubbleText}`}
              accessibilityHint={t('voice.dock.bubbleDismissHint')}
              className="flex-1 bg-ink-900 border border-brand-500 rounded-3xl px-4 py-3 -mr-3 mb-2"
            >
              <Text className="text-brand-300 text-sm font-bold">
                {t('voice.agentTag')} · {stateLabel}
              </Text>
              <Text numberOfLines={3} className="text-ink-50 text-base mt-0.5">
                {bubbleText}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              hapticTap();
              openPanel();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('voice.dock.open', { state: stateLabel })}
            style={{ width: ORB_SIZE, height: ORB_SIZE }}
            className="items-center justify-center rounded-full active:opacity-85"
          >
            <AuroraVoiceOrb
              state={state}
              muted={muted}
              audioLevel={audioLevel}
              audioSpeaker={audioSpeaker}
              size={ORB_SIZE}
              showGlyph={false}
            />
          </Pressable>
        </View>
      ) : null}

      <AvisaiPanel visible={panelOpen} onClose={closePanel} />

      <CabinModeModal
        visible={chatOpen}
        onClose={closeChat}
        stayTimer={stayTimer}
        stayValue={stayValue}
        stayOver={stayOver}
        contextPill={contextPill}
      />
    </>
  );
}

/** Painel de comandos (mockup `13-componente-avisai/painel-aberto`). */
function AvisaiPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const state = useVoice((s) => s.state);
  const muted = useVoice((s) => s.muted);
  const audioLevel = useVoice((s) => s.audioLevel);
  const audioSpeaker = useVoice((s) => s.audioSpeaker);
  const context = useVoice((s) => s.context);
  const lastError = useVoice((s) => s.lastError);
  const clearError = useVoice((s) => s.clearError);
  const listen = useVoice((s) => s.listen);
  const utter = useVoice((s) => s.utter);
  const openChat = useAvisaiDock((s) => s.openChat);
  const { label, hint, isActive, directVoice } = useMicStatus();

  const lang = getCurrentLanguage();
  const utterances = Array.from(
    new Set([...getQuickUtterances(context, lang), ...getQuickUtterances('free', lang)]),
  ).slice(0, 5);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-ink-950/80">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('demo.close')} />
        <View className="bg-ink-900 border border-brand-600 rounded-[32px] mx-3 mb-6 p-5">
          <View className="flex-row items-center gap-3">
            <AuroraVoiceOrb
              state={state}
              muted={muted}
              audioLevel={audioLevel}
              audioSpeaker={audioSpeaker}
              size={56}
              showGlyph={false}
            />
            <View className="flex-1">
              <Text accessibilityRole="header" className="text-ink-50 text-xl font-display">
                {t('voice.dock.panelTitle', { state: t(`voice.state.${state}`) })}
              </Text>
              <Text className="text-ink-300 text-sm mt-0.5">{t('voice.dock.panelSubtitle')}</Text>
            </View>
            <Pressable
              onPress={() => {
                hapticTap();
                listen();
              }}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityHint={hint}
              accessibilityState={{ selected: isActive }}
              className={`w-12 h-12 rounded-full items-center justify-center active:opacity-80 ${
                isActive ? 'bg-brand-500' : 'bg-ink-800'
              }`}
            >
              <Icon name="mic" size={22} />
            </Pressable>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('demo.close')}
              className="w-12 h-12 rounded-full bg-ink-800 items-center justify-center active:opacity-80"
            >
              <Icon name="x" size={22} />
            </Pressable>
          </View>

          <Text className="text-ink-300 text-xs mt-2">{label} · {hint}</Text>

          {lastError ? (
            <Pressable
              onPress={clearError}
              accessibilityRole="button"
              accessibilityHint={t('voice.dock.dismissErrorHint')}
              className="mt-3 bg-alert-500/15 rounded-2xl px-4 py-3"
            >
              <Text className="text-alert-500 text-sm font-semibold">{lastError}</Text>
            </Pressable>
          ) : null}

          {directVoice ? (
            <>
              <Text className="text-ink-50 text-base mt-4 leading-6">{t('voice.directVoiceHint')}</Text>
              <Text className="text-ink-300 text-sm mt-2 leading-5">{t('voice.dock.commandsHint')}</Text>
            </>
          ) : (
            <>
              <Text className="text-ink-300 text-sm mt-4 mb-2">{t('voice.dock.simulateLabel')}</Text>
              <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
                {utterances.map((u) => (
                  <Pressable
                    key={u}
                    onPress={() => {
                      hapticTap();
                      utter(u);
                    }}
                    accessibilityRole="button"
                    className="bg-ink-800 border border-ink-700 rounded-2xl px-4 py-3 active:opacity-80"
                  >
                    <Text className="text-ink-50 text-base font-bold">“{u}”</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          <Pressable
            onPress={() => {
              hapticTap();
              openChat();
            }}
            accessibilityRole="button"
            className="mt-4 py-2 items-center active:opacity-80"
          >
            <Text className="text-brand-300 text-base font-bold">{t('voice.dock.openChat')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

