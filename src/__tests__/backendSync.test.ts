import { beforeEach, describe, expect, it, vi } from 'vitest';

import { statusRotaToPhase, useTrip } from '../features/trip/hooks/useTrip';
import {
  apiDocumentToTripDocument,
  apiRouteFileToTripDocument,
  useDocuments,
} from '../features/documents';
import { useVoice } from '../features/voice';
import { useHeadsUpBanner } from '../components/HeadsUpBanner';
import i18n from '../lib/i18n';
import { useApiConfig } from '../services/api';
import {
  buildBackendWebSocketUrl,
  handleStreamMessage,
  useBackendStream,
} from '../services/backendStream';
import { mockApiClient } from '../services/mockApi';
import { useVoiceCommandToast } from '../services/voiceCommands';
import { wireBackendStream } from '../app/wireBackendStream';

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

describe('backend integration & stream events', () => {
  beforeEach(async () => {
    wireBackendStream();
    await i18n.changeLanguage('pt-BR');
    useApiConfig.setState({
      mode: 'mock',
      rotaId: 1,
      driverId: 1,
      recentUrls: ['http://localhost:8000'],
    });
    useTrip.getState().reset();
    useVoice.getState().reset();
    useVoiceCommandToast.getState().clear();
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
    expect(statusRotaToPhase('cancelada')).toBe('idle');
  });

  it('não forma WebSocket para URL parcial enquanto o usuário a edita', () => {
    expect(buildBackendWebSocketUrl('ttp://10.218.130.187:8000', 1, 1)).toBeNull();
    expect(buildBackendWebSocketUrl('http://10.218.130.187:8000', 1, 1)).toBe(
      'ws://10.218.130.187:8000/ws?motorista_id=1',
    );
    expect(buildBackendWebSocketUrl('https://api.exemplo.test/base/', 7, null)).toBe(
      'wss://api.exemplo.test/base/ws?rota_id=7',
    );
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
    expect(await mockApiClient.getRouteFiles(1)).toEqual([]);
  });

  it('mapeia arquivo real da rota para documento que abre no visualizador nativo', () => {
    const file = apiRouteFileToTripDocument({
      id: 7,
      rota_id: 3,
      nome_original: 'ordem-coleta.pdf',
      tipo_mime: 'application/pdf',
      tamanho_bytes: 2048,
      categoria: 'documento',
      descricao: 'Ordem de coleta',
      criado_em: '2026-11-22T12:00:00Z',
      url_download: 'http://10.0.2.2:8000/rotas/3/arquivos/7/download',
    });

    expect(file.kind).toBe('Arquivo');
    expect(file.realFile).toBe(true);
    expect(file.fileUrl).toContain('/rotas/3/arquivos/7/download');
    expect(file.fields.descricao).toBe('Ordem de coleta');
  });

  it('executa ação tipada recebida do backend sem ler texto transcrito', () => {
    handleStreamMessage(
      JSON.stringify({
        canal: 'acao_cliente',
        dado: { rota_id: 1, acao: 'open_map' },
      }),
    );

    expect(useVoiceCommandToast.getState().message).toBe('Comando de voz: Abrindo Mapa');
  });

  it('trata pergunta_documento na timeline sem registrar transcrição', () => {
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
    expect(transcript).toHaveLength(0);
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

  it('normaliza polyline em formato de tupla [lat, lng] do backend real em syncRouteFromBackend', async () => {
    const baseRoute = await mockApiClient.getAssignedRoute({ tripId: '1', driverId: 1 });
    expect(baseRoute).not.toBeNull();

    const tuplePolyline: [number, number][] = [
      [-23.1857, -46.8978],
      [-23.31, -46.72],
      [-23.4543, -46.5337],
    ];
    const spy = vi.spyOn(mockApiClient, 'getAssignedRoute').mockResolvedValueOnce({
      ...baseRoute!,
      polyline: tuplePolyline,
    });

    await useTrip.getState().syncRouteFromBackend(1);
    spy.mockRestore();

    const { path } = useTrip.getState().activeRoute;
    expect(path).toEqual([
      { lat: -23.1857, lng: -46.8978 },
      { lat: -23.31, lng: -46.72 },
      { lat: -23.4543, lng: -46.5337 },
    ]);
    for (const pt of path) {
      expect(Number.isFinite(pt.lat)).toBe(true);
      expect(Number.isFinite(pt.lng)).toBe(true);
    }
  });

  it('adota um snapshot único da nova rota e descarta dados de outra rota', () => {
    handleStreamMessage(
      JSON.stringify({
        canal: 'snapshot',
        dado: {
          rotas: [
            {
              id: 9,
              status: 'em_transito',
              placa: 'LIVE-009',
              nota_fiscal: 'NF-009',
              carga_descricao: 'Carga da rota ativa',
              carga_t: 12,
              origem_nome: 'CD Jundiaí',
              destino_nome: 'Destino ao vivo',
              destino_lat: -23.42,
              destino_lng: -46.31,
              ultima_lat: -23.31,
              ultima_lng: -46.51,
              distancia_m: 6500,
              eta_min: 9,
              recebedor_empresa: 'Cliente Live',
              recebedor_nome: 'Portaria',
              motorista_nome: 'Marina Souza',
              canal_motorista: 'avisai-rota-9',
              uid_motorista: 1001,
              uid_cco: 2001,
              uid_agente: 9001,
            },
          ],
          tasks: [
            {
              id: 1,
              rota_id: 1,
              tipo: 'antiga',
              status: 'pendente',
              prioridade: 'normal',
              tentativas: 9,
              canal_atual: 'painel',
              criada_em: '2026-11-22T12:00:00Z',
              ultima_notificacao: null,
              confirmado_em: null,
              confirmado_por: null,
              resposta_recebedor: null,
              concluida_em: null,
            },
            {
              id: 9,
              rota_id: 9,
              tipo: 'atual',
              status: 'pendente',
              prioridade: 'normal',
              tentativas: 2,
              canal_atual: 'painel',
              criada_em: '2026-11-22T12:00:00Z',
              ultima_notificacao: null,
              confirmado_em: null,
              confirmado_por: null,
              resposta_recebedor: null,
              concluida_em: null,
            },
          ],
          estadias: [],
          ligacoes: [],
          ocorrencias: [],
          eventos: [],
        },
      }),
    );

    expect(useApiConfig.getState().rotaId).toBe(9);
    expect(useTrip.getState().activeRoute).toMatchObject({
      rotaId: 9,
      plate: 'LIVE-009',
      destination: { name: 'Destino ao vivo' },
    });
    expect(useTrip.getState().position).toEqual({ lat: -23.31, lng: -46.51 });
    expect(useTrip.getState().backendTask?.id).toBe(9);
  });

  it('não aceita GPS de outra rota e não deixa o simulador sobrescrever o WebSocket no modo HTTP', () => {
    const backendPosition = { lat: -23.31, lng: -46.51 };
    useApiConfig.setState({ mode: 'http', rotaId: 1 });
    useTrip.setState({
      phase: 'driving',
      position: backendPosition,
      simMinutes: 22,
      etaMin: 11,
      speedKmh: 42,
    });

    useTrip.getState().applyBackendPosicao({
      rota_id: 99,
      lat: -20.1,
      lng: -44.2,
      distancia_m: 1,
      eta_min: 1,
      status: 'em_transito',
    });
    expect(useTrip.getState().position).toEqual(backendPosition);

    useTrip.getState().tick(120_000);
    expect(useTrip.getState()).toMatchObject({
      position: backendPosition,
      simMinutes: 22,
      etaMin: 11,
      speedKmh: 42,
    });
  });

  it('preserva a posição recém-chegada no WebSocket quando /api/route ainda não tem GPS', async () => {
    const baseRoute = await mockApiClient.getAssignedRoute({ tripId: '1', driverId: 1 });
    expect(baseRoute).not.toBeNull();
    const gpsFromSnapshot = { lat: -23.27, lng: -46.72 };
    useTrip.setState({
      activeRoute: { ...useTrip.getState().activeRoute, rotaId: 1 },
      position: gpsFromSnapshot,
    });
    const spy = vi.spyOn(mockApiClient, 'getAssignedRoute').mockResolvedValueOnce({
      ...baseRoute!,
      position: {
        lat: null,
        lng: null,
        distanceM: null,
        etaMin: null,
      },
    });

    await useTrip.getState().syncRouteFromBackend(1);
    spy.mockRestore();

    expect(useTrip.getState().position).toEqual(gpsFromSnapshot);
  });

  it('não deixa uma resposta antiga de rota sobrescrever a rota recém-atribuída', async () => {
    const oldRoute = await mockApiClient.getAssignedRoute({ tripId: '1', driverId: 1 });
    const newRoute = await mockApiClient.getAssignedRoute({ tripId: '2', driverId: 2 });
    if (!oldRoute || !newRoute) throw new Error('fixtures de rota indisponíveis');

    let resolveOldRequest!: (route: NonNullable<typeof oldRoute>) => void;
    const oldRequest = new Promise<NonNullable<typeof oldRoute>>((resolve) => {
      resolveOldRequest = resolve;
    });
    const spy = vi
      .spyOn(mockApiClient, 'getAssignedRoute')
      .mockImplementationOnce(() => oldRequest)
      .mockResolvedValueOnce(newRoute);

    const pendingOldSync = useTrip.getState().syncRouteFromBackend(1);
    useApiConfig.getState().setRotaId(2);
    const currentSync = useTrip.getState().syncRouteFromBackend(2);
    await currentSync;

    resolveOldRequest(oldRoute);
    await pendingOldSync;
    spy.mockRestore();

    expect(useApiConfig.getState().rotaId).toBe(2);
    expect(useTrip.getState().activeRoute).toMatchObject({
      rotaId: 2,
      plate: newRoute.plate,
    });
  });
});
