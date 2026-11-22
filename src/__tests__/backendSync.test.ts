import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({}));
vi.mock('react-native-svg', () => ({
  default: () => null,
  Path: () => null,
  Circle: () => null,
  Line: () => null,
  Polyline: () => null,
  Rect: () => null,
}));

import { statusRotaToPhase, useTrip } from '../features/trip/hooks/useTrip';
import { apiDocumentToTripDocument, useDocuments } from '../features/documents';
import { useVoice } from '../features/voice';
import { useHeadsUpBanner } from '../components/HeadsUpBanner';
import i18n from '../lib/i18n';
import { useApiConfig } from '../services/api';
import { handleStreamMessage, useBackendStream } from '../services/backendStream';
import { mockApiClient } from '../services/mockApi';

describe('backend integration & stream events', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR');
    useApiConfig.setState({
      mode: 'mock',
      rotaId: 1,
      driverId: 1,
      recentUrls: ['http://localhost:8000'],
    });
    useTrip.getState().reset();
    useVoice.getState().reset();
    useDocuments.getState().reset();
    useHeadsUpBanner.getState().clear();
    useBackendStream.setState({ status: 'disconnected', eventos: [], lastError: null });
  });

  it('mapeia todos os 7 StatusRota para TripPhase corretamente', () => {
    expect(statusRotaToPhase('publicada')).toBe('idle');
    expect(statusRotaToPhase('planejada')).toBe('idle');
    expect(statusRotaToPhase('na_origem')).toBe('pickup');
    expect(statusRotaToPhase('em_transito')).toBe('driving');
    expect(statusRotaToPhase('aproximando')).toBe('approaching');
    expect(statusRotaToPhase('no_destino')).toBe('waiting');
    expect(statusRotaToPhase('descarregada')).toBe('unloaded');
  });

  it('trata eventos de retirada_detectada, retirada e nao_recebe_hoje via WebSocket', () => {
    handleStreamMessage(
      JSON.stringify({
        canal: 'evento',
        dado: {
          id: 10,
          tipo: 'retirada_detectada',
          rota_id: 1,
          timestamp: new Date().toISOString(),
          mensagem: 'Entrada na geocerca de origem',
          dados: {},
        },
      }),
    );
    expect(useTrip.getState().phase).toBe('pickup');

    handleStreamMessage(
      JSON.stringify({
        canal: 'evento',
        dado: {
          id: 11,
          tipo: 'retirada',
          rota_id: 1,
          timestamp: new Date().toISOString(),
          mensagem: 'Retirada confirmada',
          dados: {},
        },
      }),
    );
    expect(useTrip.getState().phase).toBe('driving');

    handleStreamMessage(
      JSON.stringify({
        canal: 'evento',
        dado: {
          id: 12,
          tipo: 'nao_recebe_hoje',
          rota_id: 1,
          timestamp: new Date().toISOString(),
          mensagem: 'Recebedor informou que não recebe hoje',
          dados: {},
        },
      }),
    );
    expect(useTrip.getState().receiver).toEqual({ kind: 'not_today' });
  });

  it('trata pedido_central, resposta_central e divergencia_gps (R6) via WebSocket', () => {
    handleStreamMessage(
      JSON.stringify({
        canal: 'evento',
        dado: {
          id: 20,
          tipo: 'pedido_central',
          rota_id: 1,
          timestamp: new Date().toISOString(),
          mensagem: 'Qual a previsão para sair da fila?',
          dados: { pergunta: 'Qual a previsão para sair da fila?' },
        },
      }),
    );
    expect(useTrip.getState().centralRequest).toEqual({
      pergunta: 'Qual a previsão para sair da fila?',
      status: 'pendente',
    });

    handleStreamMessage(
      JSON.stringify({
        canal: 'evento',
        dado: {
          id: 21,
          tipo: 'resposta_central',
          rota_id: 1,
          timestamp: new Date().toISOString(),
          mensagem: 'Mais 20 minutos na doca 4',
          dados: { resposta: 'Mais 20 minutos na doca 4' },
        },
      }),
    );
    expect(useTrip.getState().centralRequest).toEqual({
      pergunta: 'Qual a previsão para sair da fila?',
      resposta: 'Mais 20 minutos na doca 4',
      status: 'respondida',
    });

    handleStreamMessage(
      JSON.stringify({
        canal: 'evento',
        dado: {
          id: 22,
          tipo: 'divergencia_gps',
          rota_id: 1,
          timestamp: new Date().toISOString(),
          mensagem: 'GPS do celular diverge 4.2 km do rastreador do caminhão',
          dados: {},
        },
      }),
    );
    expect(useTrip.getState().gpsDivergence).toBe(
      'GPS do celular diverge 4.2 km do rastreador do caminhão',
    );
  });

  it('trata rota_atribuida atualizando rotaId, banner e sincronizando activeRoute', async () => {
    handleStreamMessage(
      JSON.stringify({
        canal: 'evento',
        dado: {
          id: 30,
          tipo: 'rota_atribuida',
          rota_id: 7,
          timestamp: new Date().toISOString(),
          mensagem: 'Nova rota atribuída: CD Barueri → CD Sorocaba',
          dados: { rota_id: 7 },
        },
      }),
    );

    expect(useApiConfig.getState().rotaId).toBe(7);
    expect(useTrip.getState().routeAssignedBanner).toBe(
      'Nova rota atribuída: CD Barueri → CD Sorocaba',
    );

    useTrip.getState().clearRouteAssignedBanner();
    expect(useTrip.getState().routeAssignedBanner).toBeNull();
  });

  it('fornece getAssignedRoute, getDocuments, getCentralRequests e ssoLogin no mockApiClient', async () => {
    const sso = await mockApiClient.ssoLogin('carlos@rotasul.test');
    expect(sso.driverId).toBe(1);
    expect(sso.tripId).toBe('1');

    const route = await mockApiClient.getAssignedRoute({ tripId: '1', driverId: 1 });
    expect(route).not.toBeNull();
    expect(route?.plate).toBe('RST-4B21');
    expect(route?.polyline.length).toBeGreaterThanOrEqual(2);

    const docs = await mockApiClient.getDocuments('1');
    expect(docs).toHaveLength(2);
    expect(docs[0]?.kind).toBe('NF-e');
    expect(docs[0]?.campos?.valor).toBe('R$ 84.230,50');
    expect(docs[1]?.number).toBe('000.771.204');

    const converted = apiDocumentToTripDocument(docs[0]!);
    expect(converted.fields.chave).toContain('3526 1104 8291');
    expect(converted.pages.length).toBeGreaterThanOrEqual(2);

    const central = await mockApiClient.getCentralRequests(1);
    expect(central).toEqual([]);
  });

  it('trata pergunta_documento registrando na timeline e na transcricao', () => {
    handleStreamMessage(
      JSON.stringify({
        canal: 'evento',
        dado: {
          id: 40,
          tipo: 'pergunta_documento',
          rota_id: 1,
          timestamp: '2026-11-22T14:32:00Z',
          mensagem: 'Consulta à NF-e 000.482.913: valor R$ 84.230,50',
          dados: {
            documento: 'NF-e 000.482.913',
            pergunta: 'Qual o valor da nota?',
            resposta: 'Pela NF-e 000.482.913: valor R$ 84.230,50.',
          },
        },
      }),
    );

    const { timeline } = useTrip.getState();
    expect(timeline.some((e) => e.label.includes('NF-e 000.482.913'))).toBe(true);
    expect(timeline[0]?.time).toBe('14:32');

    const { transcript } = useVoice.getState();
    expect(transcript.some((l) => l.who === 'driver' && l.text.includes('Qual o valor da nota'))).toBe(
      true,
    );
    expect(transcript.some((l) => l.who === 'agent' && l.text.includes('R$ 84.230,50'))).toBe(true);
  });

  it('aciona bargeInBanner no interrupt(), mantem recentUrls e atualiza timeline nas acoes rapidas', () => {
    useVoice.getState().interrupt();
    expect(useVoice.getState().bargeInBanner).toBe(true);

    useApiConfig.getState().addRecentUrl('https://demo.trycloudflare.com/');
    expect(useApiConfig.getState().recentUrls[0]).toBe('https://demo.trycloudflare.com');

    useTrip.getState().start();
    expect(useTrip.getState().timeline.length).toBeGreaterThanOrEqual(1);

    useTrip.getState().quickArrive();
    expect(useTrip.getState().phase).toBe('waiting');

    useTrip.getState().quickReportQueue();
    useTrip.getState().quickUnload();
    expect(useTrip.getState().phase).toBe('unloaded');
    expect(useTrip.getState().timeline.length).toBeGreaterThanOrEqual(4);
  });
});
