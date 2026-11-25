import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Badge, type BadgeTone } from '../components/Badge';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { DOCK_CLEARANCE, Screen } from '../components/Screen';
import { ScreenTitle } from '../components/ScreenTitle';
import { retryFailed, useOutboxStore, type OutboxRow, type OutboxStatus } from '../features/outbox';
import { useTrip } from '../features/trip';
import { useAvisaiDock } from '../features/voice';
import { colors } from '../lib/theme';
import { useNetwork } from '../services/network';
import { hapticTap } from '../utils/haptics';

const STATUS_TONE: Record<OutboxStatus, BadgeTone> = {
  pending: 'wait',
  sending: 'neutral',
  sent: 'ok',
  failed: 'alert',
};

/** Quantos dos três trechos (na fila → enviando → entregue) já foram cumpridos. */
const STATUS_STEPS: Record<OutboxStatus, number> = { pending: 1, sending: 2, sent: 3, failed: 1 };

function clock(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function shortKey(key: string): string {
  return key.length <= 14 ? key : `${key.slice(0, 6)}…${key.slice(-6)}`;
}

/** Texto da mensagem: o que o motorista disse/escreveu ou, para eventos do app, o nome do evento. */
function messageText(row: OutboxRow, t: TFunction): string {
  try {
    const payload = JSON.parse(row.payload) as { text?: unknown; descricao?: unknown };
    const text = typeof payload.text === 'string' ? payload.text : payload.descricao;
    if (typeof text === 'string' && text.trim()) return text.trim();
  } catch {
    // payload inválido: cai no nome do evento
  }
  return t(`events.${row.type}`, row.type);
}

/**
 * Mensagens ao CCO (mockup `11-mensagens-cco`). Tudo o que o app envia passa pelo outbox
 * (offline-first, com chave de idempotência); cada cartão mostra em que trecho do envio está.
 */
export function MessagesPage() {
  const { t } = useTranslation();
  const rows = useOutboxStore((s) => s.rows);
  const refresh = useOutboxStore((s) => s.refresh);
  const quality = useNetwork((s) => s.quality());
  const phase = useTrip((s) => s.phase);
  const centralRequest = useTrip((s) => s.centralRequest);
  const sendDriverMessage = useTrip((s) => s.sendDriverMessage);
  const openPanel = useAvisaiDock((s) => s.openPanel);
  const [draft, setDraft] = useState('');

  const count = (s: OutboxStatus) => rows.filter((r) => r.status === s).length;
  const queued = count('pending');
  const sending = count('sending');
  const sent = count('sent');
  const failed = count('failed');
  // Digitar só com o veículo parado; em movimento, só voz.
  const moving = phase === 'driving' || phase === 'approaching';

  const send = () => {
    if (!draft.trim() || moving) return;
    hapticTap();
    sendDriverMessage(draft);
    setDraft('');
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          // A esfera do AvisAI fica acima da linha de escrever: espaço para o último cartão.
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: DOCK_CLEARANCE }}
          ListHeaderComponent={
            <View className="gap-3 mb-1">
              <ScreenTitle eyebrow={t('messages.eyebrow')} title={t('messages.title')} />
              <View className="flex-row flex-wrap gap-2">
                <Badge tone="wait" label={t('messages.counts.queued', { count: queued })} />
                {sending > 0 ? (
                  <Badge tone="neutral" label={t('messages.counts.sending', { count: sending })} />
                ) : null}
                <Badge tone="ok" label={t('messages.counts.sent', { count: sent })} />
                {failed > 0 ? (
                  <Badge tone="alert" label={t('messages.counts.failed', { count: failed })} />
                ) : null}
              </View>
              {quality === 'offline' ? (
                <View accessibilityRole="alert" className="bg-wait-500/15 rounded-3xl p-4">
                  <Text className="text-wait-500 text-base leading-6">{t('messages.offline')}</Text>
                </View>
              ) : null}
              {centralRequest ? (
                <View className="bg-info-900 rounded-3xl p-4">
                  <Text className="text-info-300 text-sm font-bold">
                    {centralRequest.status === 'respondida'
                      ? t('trip.centralRequest.answeredTitle')
                      : t('trip.centralRequest.title')}
                  </Text>
                  <Text className="text-ink-50 text-lg mt-1">“{centralRequest.pergunta}”</Text>
                  {centralRequest.resposta ? (
                    <Text className="text-ink-300 text-sm mt-1">{centralRequest.resposta}</Text>
                  ) : null}
                </View>
              ) : null}
              {failed > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  label={t('outbox.retry')}
                  icon={<Icon name="refresh" size={16} color={colors.ink[300]} />}
                  onPress={() => {
                    hapticTap();
                    retryFailed();
                    refresh();
                  }}
                />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View className="bg-ink-900 border border-ink-800 rounded-3xl p-6 items-center">
              <Icon name="check" size={28} color={colors.ok[500]} />
              <Text className="text-ink-50 text-base font-bold text-center mt-2">{t('outbox.empty')}</Text>
              <Text className="text-ink-300 text-sm text-center mt-1 leading-5">{t('outbox.emptyHint')}</Text>
            </View>
          }
          renderItem={({ item }) => <MessageCard row={item} t={t} />}
        />

        {/* Escrever: voz sempre; teclado só parado. A esfera do AvisAI fica acima desta linha. */}
        <View
          className="flex-row items-center gap-2 px-4 pt-3 border-t border-ink-800"
          style={{ paddingBottom: 12 }}
        >
          <Pressable
            onPress={() => {
              hapticTap();
              openPanel();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('messages.dictate')}
            className="w-14 h-14 rounded-2xl bg-brand-500 items-center justify-center active:opacity-80"
          >
            <Icon name="mic" size={24} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            editable={!moving}
            placeholder={moving ? t('messages.voiceOnlyWhileMoving') : t('messages.placeholder')}
            placeholderTextColor={colors.ink[300]}
            accessibilityLabel={t('messages.placeholder')}
            returnKeyType="send"
            onSubmitEditing={send}
            className="flex-1 h-14 bg-ink-900 border border-ink-800 rounded-2xl px-4 text-ink-50 text-base"
          />
          <Pressable
            onPress={send}
            disabled={moving || !draft.trim()}
            accessibilityRole="button"
            accessibilityLabel={t('messages.send')}
            accessibilityState={{ disabled: moving || !draft.trim() }}
            className={`w-14 h-14 rounded-2xl bg-brand-500 items-center justify-center active:opacity-80 ${
              moving || !draft.trim() ? 'opacity-50' : ''
            }`}
          >
            <Icon name="send" size={22} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function MessageCard({ row, t }: { row: OutboxRow; t: TFunction }) {
  const steps = STATUS_STEPS[row.status];
  const barColor =
    row.status === 'failed' ? 'bg-alert-500' : row.status === 'sent' ? 'bg-brand-400' : 'bg-wait-500';
  return (
    <View
      className={`bg-ink-900 border rounded-3xl p-4 ${
        row.status === 'pending' ? 'border-wait-500/40' : 'border-ink-800'
      }`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-ink-300 text-sm">
          <Text style={{ fontVariant: ['tabular-nums'] }} className="font-mono">
            {clock(row.created_at)}
          </Text>
          {' · '}
          {t('outbox.attempts', { n: row.attempts })}
        </Text>
        <Badge tone={STATUS_TONE[row.status]} label={t(`outbox.status.${row.status}`)} />
      </View>
      <Text className="text-ink-50 text-lg mt-2">{messageText(row, t)}</Text>
      <View
        className="flex-row gap-1.5 mt-3"
        accessible
        accessibilityLabel={t('messages.progressA11y', { step: steps, total: 3 })}
      >
        {[1, 2, 3].map((i) => (
          <View key={i} className={`flex-1 h-1.5 rounded-full ${i <= steps ? barColor : 'bg-ink-700'}`} />
        ))}
      </View>
      {row.idempotency_key ? (
        <Text className="text-ink-300 text-[11px] font-mono mt-2">
          {t('outbox.idempotencyPrefix')}: {shortKey(row.idempotency_key)}
        </Text>
      ) : null}
    </View>
  );
}
