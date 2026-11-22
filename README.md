# AvisAI Mobile

App do motorista do **AvisAI**: o agente de voz que avisa o recebedor, conta a espera e prova cada hora parada. Hackathon UNMUTE by Agora (22/11/2026).

## Como rodar

```bash
npm install
npx expo install --fix   # alinha as versões com o SDK do Expo instalado
npx expo start           # abra no Expo Go (Android ou iOS)
```

## Dependências

Node 20+, Expo (Expo Go no celular). Bibliotecas: React Native, NativeWind 4 + Tailwind 3.4, React Navigation, zustand, i18next, expo-sqlite, expo-speech, expo-localization, expo-crypto, NetInfo, react-native-svg. Lista completa no `package.json`.

## O que é simulado (E8)

- **Mapa:** desenhado em SVG (o mapa do Google não roda no Expo Go).
- **GPS e rastreador:** simulador percorre a rota em tempo acelerado (1 s = 1 min).
- **Voz:** o motorista "fala" tocando em frases prontas; o agente responde com regras locais e voz sintética do aparelho (`expo-speech`). A conversa real pela Agora fica no `agent-server` / dev build.
- **Recebedor:** respostas aleatórias (confirma, não recebe hoje, não atende).
- **Documentos:** NF-e e CT-e fictícios; visualizador de PDF simulado; busca vetorial com embedding local (hash).
- **Servidor e SSO:** mock dentro do app (latência, falhas e idempotência simuladas).
- **Rota, placa, empresas e telefones:** fictícios.

## Componentes preexistentes (E5)

Nenhum código anterior ao hackathon. Só as bibliotecas de código aberto listadas acima.

## Documentação

- [Arquitetura e fluxos](docs/ARQUITETURA.md)
- [Regras de negócio](docs/REGRAS-DE-NEGOCIO.md)
- [Design system](docs/DESIGN.md)

## Versão entregue

`v0.1.0` (tag `v0.1.0-entrega` quando a entrega for fechada).
