# RODAR Mobile

- **What:** app do motorista do AvisAI (agente de voz que avisa o recebedor, conta a espera e prova cada hora parada).
- **Stack:** Expo + React Native + TypeScript + NativeWind + zustand + i18next + expo-sqlite. Roda no Expo Go.
- **Run it:** `npm install && npx expo install --fix && npx expo start`
- **Test it:** `npm run typecheck`

## Regras

1. Arquitetura feature/domínio (`docs/ARQUITETURA.md`). Uma feature só importa outra pelo `index.ts`; `trip` e `voice` conversam pelo `services/agentBus.ts`.
2. Regras de negócio em `docs/REGRAS-DE-NEGOCIO.md` e nos arquivos `rules/` das features. Parâmetros em `src/lib/config.ts`, nunca espalhados.
3. Toda escrita passa pelo `outbox` (offline-first, com `idempotencyKey`).
4. Tudo é mock (mapa, GPS, voz, PDF, servidor, SSO). Qualquer mock novo entra na seção "O que é simulado" do README (E8).
5. Textos de tela sempre por i18n (`src/assets/locales`), em pt-BR e en.
6. Cores só pelos tokens (`tailwind.config.js`, `docs/DESIGN.md`). Cor nunca comunica sozinha.
7. Nada de chave, token ou telefone real no git (E7).
