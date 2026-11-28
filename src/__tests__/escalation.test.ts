import { describe, expect, it } from 'vitest';
import { CCO_CHANNELS, channelFor, shouldCallReceiver } from '../features/trip/rules/escalation';

describe('escalation rules (R4)', () => {
  it('escala os canais na ordem push -> painel -> ligacao', () => {
    expect(CCO_CHANNELS).toEqual(['push', 'painel', 'ligação']);
    expect(channelFor(1)).toBe('push');
    expect(channelFor(2)).toBe('painel');
    expect(channelFor(3)).toBe('ligação');
    expect(channelFor(4)).toBe('ligação');
  });

  it('dispara ligacao ao recebedor somente apos 5 tentativas sem resposta do CCO', () => {
    expect(shouldCallReceiver(0, false)).toBe(false);
    expect(shouldCallReceiver(1, false)).toBe(false);
    expect(shouldCallReceiver(2, false)).toBe(false);
    expect(shouldCallReceiver(3, false)).toBe(false);
    expect(shouldCallReceiver(4, false)).toBe(false);
    expect(shouldCallReceiver(5, false)).toBe(true);
    expect(shouldCallReceiver(6, false)).toBe(true);
  });

  it('nao liga para o recebedor se o CCO ja assumiu o caso', () => {
    expect(shouldCallReceiver(2, true)).toBe(false);
    expect(shouldCallReceiver(5, true)).toBe(false);
  });

  it('respeita limite configuravel de tentativas da transportadora', () => {
    expect(shouldCallReceiver(2, false, 2)).toBe(true);
    expect(shouldCallReceiver(3, false, 5)).toBe(false);
  });
});
