import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../lib/i18n';
import { DOCUMENTS } from '../features/documents/api/documents.mock';
import {
  buildDocumentReading,
  isDocumentReadRequest,
  readDocumentAloud,
} from '../features/documents/rules/readAloud';
import type { TripDocument } from '../features/documents/types';
import { agentRespond } from '../features/voice/api/agentMock';
import { clampOrb, orbFromRatio, orbToRatio } from '../features/voice/rules/orbPosition';

vi.mock('react-native', () => ({}));
vi.mock('react-native-reanimated', () => ({
  default: { View: () => null },
  cancelAnimation: vi.fn(),
  Easing: {
    inOut: (value: unknown) => value,
    linear: 'linear',
    sin: 'sin',
  },
  useAnimatedStyle: () => ({}),
  useSharedValue: (value: number) => ({ value }),
  withRepeat: (animation: unknown) => animation,
  withSequence: (...animations: unknown[]) => animations[0],
  withSpring: (value: number) => value,
  withTiming: (value: number) => value,
}));
vi.mock('react-native-svg', () => ({
  default: () => null,
  Path: () => null,
  Circle: () => null,
  Line: () => null,
  Polyline: () => null,
  Rect: () => null,
}));

describe('esfera do AvisAI solta na tela', () => {
  const b = { minX: 8, maxX: 300, minY: 40, maxY: 700 };

  it('não sai da tela', () => {
    expect(clampOrb({ x: -50, y: 9999 }, b)).toEqual({ x: 8, y: 700 });
    expect(clampOrb({ x: 120, y: 300 }, b)).toEqual({ x: 120, y: 300 });
  });

  it('guarda a posição em proporção e volta ao mesmo lugar em outra tela', () => {
    const r = orbToRatio({ x: 300, y: 40 }, b); // canto superior direito
    expect(r).toEqual({ x: 1, y: 0 });
    const rotated = { minX: 8, maxX: 700, minY: 20, maxY: 320 };
    expect(orbFromRatio(r, rotated)).toEqual({ x: 700, y: 20 });
  });
});

describe('AvisAI lê documentos em voz alta (R7)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR');
  });

  it('reconhece pedido de leitura só quando cita um documento', () => {
    expect(isDocumentReadRequest('Lê a nota fiscal pra mim')).toBe(true);
    expect(isDocumentReadRequest('o que diz o CT-e?')).toBe(true);
    expect(isDocumentReadRequest('Read me the invoice')).toBe(true);
    expect(isDocumentReadRequest('lê pra mim')).toBe(false);
    expect(isDocumentReadRequest('Qual o peso da nota?')).toBe(false);
  });

  it('lê só os campos extraídos, sem a chave de 44 dígitos', () => {
    const text = buildDocumentReading(DOCUMENTS[0]);
    expect(text).toContain('NF-e 000.482.913');
    expect(text).toContain('R$ 84.230,50');
    expect(text).toContain('28 paletes de bebidas');
    expect(text).not.toContain('3526 1104');
  });

  it('acha o documento pedido; sem citar qual, lê a NF-e; "complementar" vai para o anexo', () => {
    const anexo: TripDocument = {
      id: 'arquivo-9',
      kind: 'Arquivo',
      title: 'comprovante_pesagem.pdf',
      fields: { arquivo: 'comprovante_pesagem.pdf', tipo: 'application/pdf', descricao: 'Ticket da balança' },
      pages: [],
      realFile: true,
    };
    const docs = [anexo, ...DOCUMENTS];
    expect(readDocumentAloud('lê o CT-e', docs).documentId).toBe('cte-1');
    expect(readDocumentAloud('lê o documento', docs).documentId).toBe('nfe-1');
    const comp = readDocumentAloud('o que diz o documento complementar?', docs);
    expect(comp.documentId).toBe('arquivo-9');
    expect(comp.text).toContain('Ticket da balança');
    expect(comp.text).not.toContain('application/pdf');
    expect(readDocumentAloud('lê a nota', []).found).toBe(false);
  });

  it('andando, o agente lê e deixa o PDF para quando parar; parado, oferece o PDF', () => {
    const moving = agentRespond('free', 'Lê a nota fiscal pra mim', {}, { driving: true });
    expect(moving.reply).toContain('R$ 84.230,50');
    expect(moving.reply).toContain('Quando parar');
    expect(moving.documentAnswer?.documentId).toBe('nfe-1');

    const stopped = agentRespond('free', 'Lê a nota fiscal pra mim', {}, { driving: false });
    expect(stopped.reply).toContain('Quer ver o PDF?');
  });

  it('pergunta de campo continua respondendo só o campo', () => {
    const turn = agentRespond('free', 'Qual o peso da nota?', {});
    expect(turn.reply).toContain('28 t');
    expect(turn.reply).not.toContain('R$ 84.230,50');
  });
});
