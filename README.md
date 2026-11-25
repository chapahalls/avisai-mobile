# RODAR Mobile

App do motorista do **RODAR**, com o **AvisAI**: o agente de voz que avisa o recebedor, conta a espera e prova cada hora parada. Hackathon UNMUTE by Agora (22/11/2026).

O foco é a operação na cabine: o motorista consulta a viagem atribuída, acompanha a rota, fala com o agente, registra ocorrências e acessa documentos. O app mantém uma fila local para funcionar sem rede, mas **não** transforma o login MOCK, o GPS simulado, os documentos fiscais MOCK ou a voz de demonstração em recursos de produção.

| Repositório | Responsabilidade |
|---|---|
| [`chapahalls/avisai`](https://github.com/chapahalls/avisai) | backend FastAPI, regras de operação, agente Agora, streams e persistência |
| **este repositório** | aplicativo React Native/Expo do motorista |
| [`chapahalls/avisai-web`](https://github.com/chapahalls/avisai-web) | painel web do CCO para monitorar, responder e publicar rotas |

## Arquitetura de arquivos

```text
src/
├── app/                 bootstrap, providers e navegação
├── pages/               Login, Início, Mapa, Documentos, Visualizador, Mensagens, Fila no recebedor e Ajustes
├── features/
│   ├── auth/            seleção de perfil e SSO MOCK
│   ├── trip/            rota, geocerca, estadia, escalonamento e mapa
│   ├── voice/           sessões Mock/Agora, esfera flutuante do AvisAI e conversa em tela cheia
│   ├── documents/       documentos, busca local e respostas por campo
│   ├── report/          campos obrigatórios do reporte por voz
│   └── outbox/          fila offline FIFO e sincronização
├── services/            clientes HTTP/mock, WebSocket, GPS do aparelho e rede
├── components/          componentes de interface reutilizáveis
├── lib/                 configuração, SQLite, i18n e IDs
├── types/               eventos, rota e contratos do backend
├── utils/               geografia, formatação, haptics e texto
└── __tests__/           testes Vitest das regras e integrações de cliente
```

`pages → features → components/lib/services/utils/types` é a direção desejada das dependências. As features expõem somente o seu `index.ts`; `trip` e `voice` trocam eventos por `src/services/agentBus.ts`, evitando importação circular. Veja o detalhamento em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Telas do aplicativo

O visual segue os mockups do repositório web (`rodar-web/docs/RODAR-telas/aplicativo/`) e a paleta RODAR descrita em [docs/DESIGN.md](docs/DESIGN.md).

| Tela | Mockup | O que mostra |
|---|---|---|
| Abertura | `01-abertura` | símbolo RODAR, assinatura e barra de carregamento enquanto o app inicia |
| Login | `02-login` | assinatura RODAR, escolha do perfil cadastrado e SSO MOCK |
| Início | `03-home` | saudação, viagem (próxima ou em andamento, com etapas), atalhos, recado do CCO, espera e jornada |
| Mapa | `08-mapa` | destino, mapa da rota, horário de chegada, botão Navegar e paradas |
| Documentos | `09-documentos` | pedir ao AvisAI e lista agrupada (Carga, Transporte, Anexos) |
| Documento | `10-documento-guiado` | trilha, folha clara com os campos verificados e páginas do PDF MOCK |
| Mensagens | `11-mensagens-cco` | o que foi enviado ao CCO e em que trecho do envio está (outbox) |
| Fila no recebedor | `12-fila-recebedor` | doca prevista, estado do aviso ao recebedor e tempo parado |
| AvisAI | `13-componente-avisai`, `06-chat-ao-vivo` | esfera flutuante, painel de comandos e conversa em tela cheia |

Ainda sem tela no app, porque dependem de funções que não existem: login por SMS (`02-login/codigo-sms`), checklist de saída em 5 passos (`04`), modo viagem curva a curva (`05`) e chamada de voz com o CCO (`07`). As capturas em `docs/assets/` são da versão anterior (AvisAI, azul).

---

## Como rodar

### 1. Desenvolvimento, Typecheck e Testes via Docker (Node 20 LTS)

Toda a infraestrutura de desenvolvimento e build Android roda isolada em containers Docker (`Dockerfile.dev` com Node 20 LTS e `Dockerfile.android` com JDK 17 + Android SDK 35 + NDK 26):

```bash
# Instalar dependências (Node 20 LTS no container)
./scripts/android-dev.sh install

# Validar TypeScript (0 erros)
./scripts/android-dev.sh typecheck

# Rodar suíte de testes unitários (Vitest)
./scripts/android-dev.sh test

# Subir servidor Metro Dev Client na porta 8081
./scripts/android-dev.sh metro
```

### 2. Build e Instalação do Android Dev Build (APK) via Docker + USB

Para testar módulos nativos (`react-native-agora`, `react-native-maps`, `expo-dev-client`) diretamente em um celular Android via cabo USB:

```bash
# 1. (Opcional) Copie .env.example para .env e preencha variáveis desejadas
cp .env.example .env

# 2. Gere o APK de desenvolvimento (build/avisai-dev-debug.apk)
./scripts/android-dev.sh build-apk

# 3. Verifique o celular conectado via USB (depuração USB ativa)
./scripts/android-dev.sh devices

# 4. Instale o APK no aparelho e configure adb reverse tcp:8081 tcp:8081
./scripts/android-dev.sh install-apk

# 5. Inicie o Metro Dev Client
./scripts/android-dev.sh metro
```

### 3. Build via EAS Build (Alternativa em nuvem)

O arquivo `eas.json` inclui os perfis `development` (Dev Client APK), `preview` (APK interno) e `production`:

```bash
npx eas-cli build --profile development --platform android
```

### 4. Execução rápida no Expo Go (Modo Mock/Fallback)

O app possui detecção segura de módulos nativos e fallback automático (`Agora` → `Mock TTS`, `Google Maps` → `Mapa SVG`), podendo também ser aberto no Expo Go:

```bash
npm run start:go
```

---

## Como plugar Google Maps e o Backend Oficial (`chapahalls/avisai` + Agora Conversational AI)

Configure as variáveis no arquivo `.env` (nunca versionado no git — **E7**) ou altere **em tempo real** pelo Bottom Sheet **Demo** no app (sem reiniciar o Metro):

```env
# Modo da API: mock (padrão hackathon offline/demo) | http (backend oficial FastAPI chapahalls/avisai)
EXPO_PUBLIC_API_MODE=http
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
EXPO_PUBLIC_ROTA_ID=1

# Modo de voz: mock (expo-speech + chips) | agora (react-native-agora + Conversational AI)
EXPO_PUBLIC_VOICE_MODE=agora

# Chave nativa Android para Google Maps (injetada no AndroidManifest via app.config.ts, fora do bundle JS)
GOOGLE_MAPS_API_KEY_ANDROID=sua_chave_aqui
```

### Conectando ao Backend Oficial pelo túnel `trycloudflare.com`
1. No servidor backend (`https://github.com/chapahalls/avisai`), suba a API FastAPI na porta `8000` com o túnel Cloudflare (`https://xxxx.trycloudflare.com`) e rode o seed (`python -m app.seed`).
2. No app mobile, toque no botão **Demo** (canto superior direito):
   - Alterne **API: Backend** e **Voz: Agora**.
   - Cole a URL pública do túnel (`https://xxxx.trycloudflare.com`) no campo **URL do Backend** e toque em **Testar** (`GET /health` → badge verde `Online` e `WS conectado`).
3. Toque na esfera do AvisAI (canto inferior direito) e no microfone do painel para iniciar a sessão real (`POST /sessions`) e conversar ao vivo com o agente no canal RTC (`uid 1001` motorista ↔ `uid 9001` agente).

### Contratos e Endpoints Oficiais Integrados

`src/services/httpApi.ts`, `src/services/backendStream.ts` e `src/types/backend.ts` concentram o contrato HTTP/WS. A URL configurada aponta para a raiz do backend, sem acrescentar `/api`.

| Grupo | Rotas consumidas pelo app | Finalidade |
|---|---|---|
| Disponibilidade e perfil | `GET /health`, `GET /usuarios?role=driver`, `POST /auth/sso` | verifica a API, lista perfis de demonstração e seleciona a identidade do motorista |
| Rota atribuída | `GET /api/route?driverId={id}` ou `?tripId={id}`; `GET /rotas/{id}` | consulta autoritativa da viagem e seu detalhe |
| Tempo real | `WS /ws?motorista_id={id}` e `WS /ws?rota_id={id}` | recebe novas atribuições e atualizações de rota; após reconectar, o app faz refetch |
| Voz Agora | `POST /sessions`, `DELETE /sessions/{id}`, `POST /sessions/{id}/speak`, `GET /token?channel=&uid=` | cria/encerra a sessão e renova o token RTC |
| GPS e operação | `POST /rotas/{id}/posicao`, `/chegada`, `/descarga` | envia posição e registra os marcos operacionais autorizados pelo motorista |
| Documentos | `GET /api/documents?tripId={id}`, `GET /rotas/{id}/arquivos`, `/arquivos/{arquivoId}/download` | separa NF-e/CT-e MOCK dos anexos reais recebidos do CCO |
| Histórico | `GET /events?tripId={id}&since=...` | recupera a timeline normalizada para sincronização |

O mobile **não** publica rota, atribui motorista, confirma Task do CCO, chama o recebedor nem chama reset para obter sua viagem. Os endpoints operacionais atuais ainda não validam o token MOCK como autorização; essa proteção é obrigatória antes de qualquer uso produtivo.

- **Google Maps (`GOOGLE_MAPS_API_KEY_ANDROID`):** lida em tempo de build pelo `app.config.ts` para injetar `android.config.googleMaps.apiKey` somente quando não-vazia, expondo apenas o booleano `extra.hasGoogleMapsKey` para o runtime JS. Se a chave ou o módulo nativo não estiverem presentes, `RouteMap` faz fallback automático para `RouteMapSvg`.
- **Voz Agora (`EXPO_PUBLIC_VOICE_MODE=agora`):** `AgoraVoiceSession` (`react-native-agora@4.6.4`) aplica os parâmetros `aplicarAudioIA` recomendados pela Agora (`AudioScenarioAiClient`, `ChannelProfileLiveBroadcasting`, AEC/AINS baixa latência), conecta o RTC ao agente configurado no backend, processa eventos de estado/interrupção/métricas e evita TTS local. Solicita permissão `RECORD_AUDIO`, renova token via `GET /token`, detecta barge-in por volume/fala local e expõe controles de **Mudo** e **Encerrar sessão**.

---

## Dependências e Componentes Preexistentes (E5)

Nenhum código proprietário anterior ao hackathon foi utilizado. Apenas pacotes open-source públicos fixados para o **Expo SDK 52** (`package.json`):
- **Core:** Expo SDK 52 (`~52.0.37`), React `18.3.1`, React Native `0.76.7`, TypeScript `~5.3.3`, `expo-dev-client`, `expo-build-properties`, `expo-constants`.
- **Voz e RTC:** `react-native-agora` (`^4.5.1`), `expo-speech` (`~13.0.1`), `expo-speech-recognition` (`1.1.1`, wake word).
- **Mapa e UI:** `react-native-maps` (`1.18.0`), `react-native-svg` (`15.8.0`), NativeWind `^4.1.23` + Tailwind CSS `^3.4.17`, React Navigation v7, `react-native-reanimated` (`~3.16.1`), `react-native-safe-area-context`, `react-native-screens`.
- **Dados, Estado e i18n:** `expo-sqlite` (`~15.1.2`), `zustand` (`^5.0.3`), `i18next` (`^24.2.2`), `react-i18next` (`^15.4.0`), `expo-localization` (`~16.0.1`), `expo-crypto` (`~14.0.2`), `@react-native-community/netinfo` (`11.4.1`).
- **Testes:** `vitest` (`^3.0.5`).

---

## Comandos de voz e wake word

**Wake word:** com o app aberto, logado e sem conversa ativa, diga **"Ei AvisAI"**. O painel do AvisAI abre e a conversa começa sem tocar na tela. Usa o reconhecedor de fala padrão do Android (`expo-speech-recognition`, serviço do Google) em modo contínuo: o app abre o microfone uma vez e o Android não toca o bipe a cada frase (o indicador de microfone em uso fica aceso enquanto escuta). O reconhecimento sem internet fica desligado (`WAKE_WORD.preferOnDevice`): no Galaxy A17 o modelo "instalado" devolvia texto vazio. O texto serve só para achar a wake word e é descartado. A escuta para durante a conversa e em segundo plano, e liga/desliga em **Ajustes → Escutar "Ei AvisAI"**. Precisa do Dev Build (não roda no Expo Go).

**Comandos durante a conversa:** o agente entende o pedido e o backend manda a ação ao app (`acao_cliente` no `/ws`):

| Fale | O app |
|---|---|
| "abre o mapa", "vai pras mensagens", "mostra os documentos", "abre a fila do recebedor", "volta pro início" | abre a tela |
| "mostra a nota fiscal", "abre o CT-e", "abre o comprovante de pesagem" | abre o documento |
| "volta" | volta uma tela |
| "tchau, AvisAI", "pode encerrar a conversa" | o agente se despede e a conversa encerra |
| "sair da conta" | o agente pede confirmação; depois do "sim", sai da conta |
| "me leva até o recebedor", "abre o Waze" | abre a rota até o destino no app de mapas |
| "liga o GPS" | liga o GPS do aparelho |
| "avisa o CCO que vou parar pra almoçar" | manda o recado ao CCO (problema, como fila ou avaria, vira ocorrência) |
| "repete", "o que eu perdi?" | o agente repete os últimos avisos |

**Telas de leitura só com o caminhão parado:** documentos e mensagens pedidos por voz com o caminhão andando ficam esperando; abrem sozinhos quando ele para, e o agente avisa isso em vez de dizer "abrindo".

**Avisos com a conversa fechada:** quando o agente precisa falar e não há conversa aberta (aproximação, resposta do CCO ou do recebedor, rota nova, pergunta da central), o backend manda `aviso_motorista` pelo `/ws`. O app fala o aviso em voz local (`expo-speech`, sem gastar minutos da Agora), mostra na tela e, se for pergunta, abre a conversa para o motorista responder. A wake word pausa enquanto o aviso é falado.

No modo de voz simulado (sem backend), as mesmas frases dos chips viram as mesmas ações (`services/voiceCommands.ts`).

---

## O que é simulado vs. Real / Plugável (E8)

Todos os controles de simulação ficam isolados no componente `DemoControls` (identificado com **borda tracejada** na interface), aberto em **Ajustes** (Início) e no botão **Demo** do Mapa:

- **Mapa:** `RouteMap` suporta `RouteMapGoogle` (`react-native-maps` com `PROVIDER_GOOGLE` e estilo escuro) quando `GOOGLE_MAPS_API_KEY_ANDROID` está configurada no Dev Build, e faz fallback automático para `RouteMapSvg` (mapa simulado em SVG) quando sem chave ou em modo SVG.
- **GPS e relógio:** simulador percorre a polilinha da rota em tempo acelerado (`1 s real = 1 min simulado`), com botões de atalho na demo (`+1 h`, `Ir p/ Aproximação (8 km)`, `Ir p/ Chegada`).
- **Voz:** `VoiceSession` possui dois adapters reais:
  - `MockVoiceSession`: frases rápidas bilíngues (`pt-BR` / `en`) + síntese de voz `expo-speech` + barge-in + medição de latência.
  - `AgoraVoiceSession`: conexão RTC via `react-native-agora` integrada ao Conversational AI Engine via `agent-server` (com fallback automático para mock caso offline/sem backend).
- **Recebedor:** em modo `mock`, respostas simuladas (confirma doca/horário, não recebe hoje, não atende); em modo `http`, delega para `POST /rotas/{id}/ligar-recebedor` e recebe a confirmação em tempo real via WebSocket (`resposta_recebedor`).
- **Documentos:** NF-e e CT-e sincronizados da rota, mais anexos reais baixados pelo CCO; visualizador local/nativo, indexação vetorial local em SQLite (embedding determinístico de 64 dimensões + similaridade cosseno) e resposta estrita por campos extraídos (**R7**). O agente também informa os nomes dos documentos disponíveis. A voz real usa Agora RTC com o agente GPT-Live configurado no backend.
- **Servidor e SSO:** fila offline-first real em SQLite (`outbox` + `events` + `settings`) com `idempotencyKey` e ordem estrita FIFO; transporte plugável entre `mockApi.ts` e `httpApi.ts` + stream tempo real `backendStream.ts` (`/ws`).
- **Fila no recebedor:** a posição na fila e os outros caminhões do mockup não aparecem; o recebedor ainda não informa a fila. A tela mostra só a doca confirmada e o tempo parado.
- **Navegar:** abre o app de mapas do aparelho com o destino da rota (não é simulado).
- **Rota, placa, empresas e telefones:** 100% fictícios (`Carlos Andrade`, `Transportadora Rota Sul`, `RST-4B21`, `CD Jundiaí` → `Mercadão Campinas, CD Norte`).

---

## Segurança e Privacidade (E7 & R6)

- **Zero segredos no repositório:** `.env`, chaves `.keystore`/`.jks`, `google-services.json` e artefatos `.apk`/`.aab` estão bloqueados no `.gitignore`. Apenas `.env.example` com placeholders vazios é versionado.
- **Chave do Google Maps fora do bundle JS:** `app.config.ts` injeta `GOOGLE_MAPS_API_KEY_ANDROID` exclusivamente no manifesto nativo Android durante o prebuild; o `extra` expõe apenas `hasGoogleMapsKey: boolean`.
- **Privacidade de voz (`VOICE_PRIVACY`):** `recordAudio: false` e `transcriptionOnly: true`. O app exibe o selo `"Somente transcrição · sem gravação de áudio"` / `"Transcription only · no audio recorded"` e nunca invoca APIs de gravação de áudio.

---

## Documentação

- [Arquitetura e fluxos](docs/ARQUITETURA.md)
- [Regras de negócio](docs/REGRAS-DE-NEGOCIO.md)
- [Design system](docs/DESIGN.md)

## Versão entregue

`v0.1.0` (tag `v0.1.0-entrega` quando a entrega for fechada).
