# AvisAI Mobile

App do motorista do **AvisAI**: o agente de voz que avisa o recebedor, conta a espera e prova cada hora parada. Hackathon UNMUTE by Agora (22/11/2026).

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

## Como plugar Google Maps e o Backend Oficial (`chapahalls/avisai` `v1.0-entrega` / `ccb36e7` + Agora Conversational AI)

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
3. Toque no botão do microfone (`MicButton`) para iniciar a sessão real (`POST /sessions`) e conversar ao vivo com o agente no canal RTC (`uid 1001` motorista ↔ `uid 9001` agente).

### Contratos e Endpoints Oficiais Integrados (`src/types/backend.ts` & `src/services/httpApi.ts`)
- **Healthcheck:** `GET /health`
- **Sessão de Voz (Agora ConvoAI):** `POST /sessions` (`{ rota_id }`), `DELETE /sessions/{id}`, `POST /sessions/{id}/speak`, `GET /token?channel=...&uid=...`
- **Rota, GPS e Geocerca:** `GET /rotas/{id}`, `POST /rotas/{id}/posicao`, `POST /rotas/{id}/chegada`, `POST /rotas/{id}/descarga`, `POST /rotas/{id}/ligar-recebedor`, `POST /rotas/{id}/reset`
- **Estado CCO e Tempo Real:** `GET /cco/estado?rota_id={id}` e WebSocket `WS /ws?rota_id={id}` (`src/services/backendStream.ts`) sincronizando automaticamente `snapshot`, `posicao`, `contador` (estadia ao vivo a cada 1 s), `task`, `fala`, `evento` e `reset`.
- **Google Maps (`GOOGLE_MAPS_API_KEY_ANDROID`):** lida em tempo de build pelo `app.config.ts` para injetar `android.config.googleMaps.apiKey` somente quando não-vazia, expondo apenas o booleano `extra.hasGoogleMapsKey` para o runtime JS. Se a chave ou o módulo nativo não estiverem presentes, `RouteMap` faz fallback automático para `RouteMapSvg`.
- **Voz Agora (`EXPO_PUBLIC_VOICE_MODE=agora`):** `AgoraVoiceSession` (`react-native-agora@4.6.4`) aplica os parâmetros `aplicarAudioIA` recomendados pela Agora (`AudioScenarioAiClient`, `ChannelProfileLiveBroadcasting`, AEC/AINS baixa latência), decodifica em tempo real o datastream oficial em chunks base64 da Agora ConvoAI (`AgoraStreamParser`: `user.transcription`, `assistant.transcription`, `message.state`, `message.interrupt`, `message.metrics`) exibindo legendas parciais ao vivo (`liveTranscript`), e é compatível tanto com `ARES + Custom LLM + TTS` quanto com `Agora ConvoAI MLLM / Realtime` (`llm_mode`). Solicita permissão `RECORD_AUDIO`, renova token via `GET /token`, detecta barge-in por volume/fala local e expõe controles de **Mudo** e **Encerrar sessão**.

---

## Dependências e Componentes Preexistentes (E5)

Nenhum código proprietário anterior ao hackathon foi utilizado. Apenas pacotes open-source públicos fixados para o **Expo SDK 52** (`package.json`):
- **Core:** Expo SDK 52 (`~52.0.37`), React `18.3.1`, React Native `0.76.7`, TypeScript `~5.3.3`, `expo-dev-client`, `expo-build-properties`, `expo-constants`.
- **Voz e RTC:** `react-native-agora` (`^4.5.1`), `expo-speech` (`~13.0.1`).
- **Mapa e UI:** `react-native-maps` (`1.18.0`), `react-native-svg` (`15.8.0`), NativeWind `^4.1.23` + Tailwind CSS `^3.4.17`, React Navigation v7, `react-native-reanimated` (`~3.16.1`), `react-native-safe-area-context`, `react-native-screens`.
- **Dados, Estado e i18n:** `expo-sqlite` (`~15.1.2`), `zustand` (`^5.0.3`), `i18next` (`^24.2.2`), `react-i18next` (`^15.4.0`), `expo-localization` (`~16.0.1`), `expo-crypto` (`~14.0.2`), `@react-native-community/netinfo` (`11.4.1`).
- **Testes:** `vitest` (`^3.0.5`).

---

## O que é simulado vs. Real / Plugável (E8)

Todos os controles de simulação ficam isolados no componente `DemoControls` (identificado com **borda tracejada** na interface):

- **Mapa:** `RouteMap` suporta `RouteMapGoogle` (`react-native-maps` com `PROVIDER_GOOGLE` e estilo escuro) quando `GOOGLE_MAPS_API_KEY_ANDROID` está configurada no Dev Build, e faz fallback automático para `RouteMapSvg` (mapa simulado em SVG) quando sem chave ou em modo SVG.
- **GPS e relógio:** simulador percorre a polilinha da rota em tempo acelerado (`1 s real = 1 min simulado`), com botões de atalho na demo (`+1 h`, `Ir p/ Aproximação (8 km)`, `Ir p/ Chegada`).
- **Voz:** `VoiceSession` possui dois adapters reais:
  - `MockVoiceSession`: frases rápidas bilíngues (`pt-BR` / `en`) + síntese de voz `expo-speech` + barge-in + medição de latência.
  - `AgoraVoiceSession`: conexão RTC via `react-native-agora` integrada ao Conversational AI Engine via `agent-server` (com fallback automático para mock caso offline/sem backend).
- **Recebedor:** em modo `mock`, respostas simuladas (confirma doca/horário, não recebe hoje, não atende); em modo `http`, delega para `POST /rotas/{id}/ligar-recebedor` e recebe a confirmação em tempo real via WebSocket (`resposta_recebedor`).
- **Documentos:** NF-e (`000.482.913` — 28 paletes de bebidas, 28 t, `Mercadão Campinas, CD Norte`, veículo `RST-4B21`) e CT-e (`000.987`) fictícios alinhados ao `seed.py` do backend; visualizador de PDF simulado (`MockPdfViewer`); busca vetorial local em SQLite (embedding determinístico de 64 dimensões + similaridade cosseno) e resposta estrita por campos extraídos (**R7**).
- **Servidor e SSO:** fila offline-first real em SQLite (`outbox` + `events` + `settings`) com `idempotencyKey` e ordem estrita FIFO; transporte plugável entre `mockApi.ts` e `httpApi.ts` + stream tempo real `backendStream.ts` (`/ws`).
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
