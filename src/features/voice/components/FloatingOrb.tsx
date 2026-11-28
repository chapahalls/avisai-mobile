import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AVISAI_ORB } from '../../../lib/config';
import { getSetting, setSetting } from '../../../lib/db';
import { hapticTap } from '../../../utils/haptics';
import type { AudioSpeaker } from '../api/voiceSession';
import {
  clampOrb,
  orbFromRatio,
  orbToRatio,
  snapToEdge,
  type OrbBounds,
  type OrbRatio,
} from '../rules/orbPosition';
import type { VoiceState } from '../types';
import { AuroraVoiceOrb } from './AuroraVoiceOrb';

const SIZE = AVISAI_ORB.sizeDp;
/** Largura máxima do balão com a fala do agente. */
const BUBBLE_MAX_W = 300;

function loadSaved(): OrbRatio | null {
  try {
    const raw = getSetting(AVISAI_ORB.settingKey);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<OrbRatio>;
    return typeof v.x === 'number' && typeof v.y === 'number' ? { x: v.x, y: v.y } : null;
  } catch {
    return null;
  }
}

export interface FloatingOrbProps {
  /** Distância até a base da tela quando o motorista ainda não moveu a esfera. */
  defaultBottomOffset: number;
  /** Áreas do sistema (barra de status e de navegação) que a esfera não cobre. */
  safeTop: number;
  safeBottom: number;
  state: VoiceState;
  stateLabel: string;
  muted: boolean;
  audioLevel: number;
  audioSpeaker: AudioSpeaker;
  bubbleText: string | null;
  onDismissBubble: () => void;
  onOpen: () => void;
}

/**
 * Esfera do AvisAI solta na tela: o motorista arrasta para qualquer canto, por cima de
 * qualquer elemento, e a posição fica salva (em proporção da tela, então sobrevive à rotação).
 * Toque abre o painel; leitor de tela abre pelo "ativar" normal.
 */
export function FloatingOrb({
  defaultBottomOffset,
  safeTop,
  safeBottom,
  state,
  stateLabel,
  muted,
  audioLevel,
  audioSpeaker,
  bubbleText,
  onDismissBubble,
  onOpen,
}: FloatingOrbProps) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const bounds: OrbBounds = useMemo(
    () => ({
      minX: AVISAI_ORB.edgeMarginDp,
      maxX: width - SIZE - AVISAI_ORB.edgeMarginDp,
      minY: safeTop + AVISAI_ORB.edgeMarginDp,
      maxY: height - SIZE - Math.max(safeBottom, AVISAI_ORB.edgeMarginDp),
    }),
    [width, height, safeTop, safeBottom],
  );

  const [saved, setSaved] = useState<OrbRatio | null>(loadSaved);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const target = saved
    ? orbFromRatio(saved, bounds)
    : clampOrb({ x: bounds.maxX, y: height - defaultBottomOffset - SIZE }, bounds);

  const pos = useRef(new Animated.ValueXY(target)).current;
  const current = useRef(target);
  const start = useRef(target);
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  // Tela girou, barra de abas mudou ou a posição salva (encostada na lateral) mudou: deslisa
  // suavemente até lá, em vez de pular.
  useEffect(() => {
    if (dragging) return;
    current.current = target;
    Animated.spring(pos, { toValue: target, useNativeDriver: false, bounciness: 0 }).start();
  }, [target.x, target.y, dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.current = current.current;
        },
        onPanResponderMove: (_e, g) => {
          if (Math.abs(g.dx) < AVISAI_ORB.dragSlopDp && Math.abs(g.dy) < AVISAI_ORB.dragSlopDp) return;
          if (!draggingRef.current) {
            draggingRef.current = true;
            hapticTap();
            setDragging(true);
          }
          const next = clampOrb(
            { x: start.current.x + g.dx, y: start.current.y + g.dy },
            boundsRef.current,
          );
          current.current = next;
          pos.setValue(next);
        },
        onPanResponderRelease: (_e, g) => {
          const moved = draggingRef.current;
          draggingRef.current = false;
          setDragging(false);
          if (!moved) {
            hapticTap();
            onOpenRef.current();
            return;
          }
          // Solta no meio da tela: encosta na lateral mais próxima, como um balão de conversa.
          const snapped = snapToEdge(current.current, boundsRef.current);
          const ratio = orbToRatio(snapped, boundsRef.current);
          setSaved(ratio);
          setSetting(AVISAI_ORB.settingKey, JSON.stringify(ratio));
        },
        onPanResponderTerminate: () => {
          draggingRef.current = false;
          setDragging(false);
        },
      }),
    [pos],
  );

  // Balão do lado com mais espaço: em cima se a esfera está na metade de baixo, embaixo se não.
  const bubbleW = Math.min(BUBBLE_MAX_W, width - 2 * AVISAI_ORB.edgeMarginDp);
  const orbCenterX = target.x + SIZE / 2;
  const bubbleLeft = Math.min(
    Math.max(orbCenterX - bubbleW / 2, AVISAI_ORB.edgeMarginDp),
    width - bubbleW - AVISAI_ORB.edgeMarginDp,
  );
  const bubbleAbove = target.y + SIZE / 2 > height / 2;

  return (
    <>
      {bubbleText && !dragging ? (
        <Pressable
          onPress={onDismissBubble}
          accessibilityRole="button"
          accessibilityLabel={`${t('voice.agentTag')}: ${bubbleText}`}
          accessibilityHint={t('voice.dock.bubbleDismissHint')}
          style={{
            position: 'absolute',
            left: bubbleLeft,
            width: bubbleW,
            ...(bubbleAbove
              ? { bottom: height - target.y + 8 }
              : { top: target.y + SIZE + 8 }),
          }}
          className="bg-ink-900 border border-brand-500 rounded-3xl px-4 py-3"
        >
          <Text className="text-brand-300 text-sm font-bold">
            {t('voice.agentTag')} · {stateLabel}
          </Text>
          <Text numberOfLines={3} className="text-ink-50 text-base mt-0.5">
            {bubbleText}
          </Text>
        </Pressable>
      ) : null}
      <Animated.View
        {...responder.panHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('voice.dock.open', { state: stateLabel })}
        accessibilityHint={t('voice.dock.dragHint')}
        onAccessibilityTap={onOpen}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'activate') onOpen();
        }}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: SIZE,
          height: SIZE,
          transform: [...pos.getTranslateTransform(), { scale: dragging ? 1.08 : 1 }],
          opacity: dragging ? 0.9 : 1,
        }}
      >
        <View pointerEvents="none">
          <AuroraVoiceOrb
            state={state}
            muted={muted}
            audioLevel={audioLevel}
            audioSpeaker={audioSpeaker}
            size={SIZE}
            showGlyph={false}
          />
        </View>
      </Animated.View>
    </>
  );
}
