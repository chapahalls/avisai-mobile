# RODAR — Design system

Mesma identidade do painel web (`rodar-web`, `src/index.css` e `docs/DESIGN.md`): superfícies quase pretas com tom verde, verde da marca para ações e o lima só no símbolo RODAR. O produto é o **RODAR**; **AvisAI** é o nome do agente de voz dentro dele ("RODAR com AvisAI, seu copiloto de voz"). Mockups de referência das telas: `rodar-web/docs/RODAR-telas/aplicativo/`. O selo "Powered by LiveKit" só conforme as regras de marca do LiveKit.

Os tokens ficam em `tailwind.config.js` (classes NativeWind) e em `src/lib/theme.ts` (valores em JS para SVG, mapa, navegação e sombras). O teste `src/__tests__/theme.test.ts` falha se os dois divergirem. Nenhum componente usa hexadecimal solto.

## Cores

| Token | Hex | Uso |
|---|---|---|
| `brand-500` | `#3D7A52` | fundo da ação primária (texto `ink-50`), switches ligados |
| `brand-600` | `#285C3B` | pressionado, fala do motorista |
| `brand-400` | `#4FAE74` | traçado da rota, onda de voz |
| `brand-300` | `#7FD19C` | texto e ícone de destaque, aba ativa, links (contraste ≥ 4,5:1 sobre `ink-950`) |
| `brand-50` | `#E8F2EA` | texto sobre fundo `brand-500` translúcido |
| `ink-950` | `#090B09` | fundo |
| `ink-900` | `#111511` | cards, barra de abas |
| `ink-800` | `#1C231D` | campos, fala do agente |
| `ink-700` | `#354037` | bordas |
| `ink-300` | `#AEB8B0` | texto secundário |
| `ink-50` | `#F6F8F6` | texto principal |
| `wait-500` | `#F5A524` | espera, estadia correndo, rede fraca |
| `alert-500` | `#F04438` | escalonamento, não atendeu, sem rede |
| `ok-500` | `#17B26A` | confirmado, descarga, sincronizado |
| `rodar-mark` | `#A2F200` | símbolo RODAR (bloco lima com o "R" vazado); só para a marca |
| `rodar-400` | `#9BE22D` | destaque da marca; brilho da esfera ao conectar; barra da abertura |
| `info-300` | `#9CC2F7` | texto de mensagens e cards do CCO (pessoas da central), nunca ações |
| `info-900` | `#13223A` | fundo dos cards do CCO |

Texto de destaque usa `text-brand-300`, não `text-brand-500` (o verde escuro não tem contraste suficiente sobre o fundo).

A esfera de voz do AvisAI usa a paleta `voiceOrb` de `src/lib/theme.ts` (degradê verde do mockup `13-componente-avisai`). Cada estado também muda ícone e texto: ouvindo (menta), falando (verde, ícone de pausa), conectando (lima), mudo (cinza).

Regra: cor nunca comunica sozinha. Todo estado tem texto ao lado.

## Tipografia

- Marca: palavra "RODAR" em Kumbh Sans Bold (`font-brand`, pacote `@expo-google-fonts/kumbh-sans`, empacotada no app). Só na assinatura.
- Títulos e números grandes (saudação, títulos das abas, horário de chegada, doca, contador): Space Grotesk Bold (`font-display`, `@expo-google-fonts/space-grotesk`). Nunca junto com `font-bold`/`font-semibold`: no Android o peso extra faz o RN trocar pela fonte do sistema.
- Texto: fonte do sistema (Roboto / SF). Os mockups usam Inter; ela ainda não está empacotada.
- Horários, placas e chaves: monoespaçada do sistema (`font-mono`).
- Escala: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36. Texto principal de leitura na cabine: 16 ou mais.

## Marca

`src/components/RodarLogo.tsx` traz `RodarMark` (só o símbolo) e `RodarLogo` (símbolo + palavra), com o contorno de `rodar-web/docs/RODAR-telas/marca/rodar-icone.svg`. Proporções iguais às do web: com o símbolo de altura `size`, o corpo da palavra é ≈ 0,724 × `size` e o espaço entre eles ≈ 0,2 × `size`. O login mostra a assinatura com o subtítulo "com AvisAI, seu copiloto de voz". O ícone do app (`assets/app-icon.png`) é o símbolo sobre `ink-950`.

## Forma

- Raio: 8 (etiquetas), 16 (botões, campos), 24 (cards), 999 (esfera, pílulas). Espaçamento em múltiplos de 4.
- Cards: `ink-900`, borda `ink-800`, raio 24 (`rounded-3xl`), padding 16–20.
- Botões: altura ~56 (`py-4`), raio 16; `primary` verde, `outline`, `wait` (âmbar, pendência que trava a viagem) e `light` (mostrar à fiscalização).
- Etiquetas de status: fundo tingido e texto na cor do tom, sem borda; o texto sempre diz o estado.
- Abas: Início, Mapa, Documentos, Mensagens. A aba ativa muda a cor e ganha um fundo (a cor não comunica sozinha).
- Margem lateral 16; espaço no fim da rolagem para não ficar atrás da esfera do AvisAI (`DOCK_CLEARANCE`).

## Componentes-chave

| Componente | Comportamento |
|---|---|
| Esfera do AvisAI | 76 px, flutuante acima das abas. Toque abre o painel de comandos; quando o agente fala, um balão mostra a fala por 6 s |
| Painel do AvisAI | estado, microfone (toque = falar; com o agente falando = **interromper**), falas simuladas no modo Mock e "Abrir conversa em tela cheia" |
| Conversa em tela cheia | esfera de 236 px (toque = falar/interromper), última fala em fonte grande, mudo, rota de áudio e espera |
| Indicador de voz | `pronto` → `ouvindo` → `pensando` → `falando` → `interrompido`, com a latência em ms |
| Banner de rede | topo da tela: "Sem conexão · 3 na fila" / "Rede fraca: só eventos críticos" |
| Mensagens | cada envio tem 3 trechos (na fila → enviando → entregue); digitar só com o veículo parado, em movimento só voz |
| Contador de espera | número grande; fica âmbar depois da franquia e mostra a estadia em R$; barra de tentativas ao CCO (1/3, 2/3, 3/3) |
| Card do recebedor | etiqueta: não avisado / ligando… / doca 4, 15:00 / não recebe hoje / não atendeu |
| Controles da demo | borda tracejada para deixar claro que é simulação: rede, CCO responde, +1 h |

## Responsividade (celular pequeno e fonte grande)

Testado no aparelho em 360×640 dp e com fonte do sistema em 1,3×, inclusive os dois juntos.

- **Tela apertada** = largura em dp ÷ escala da fonte abaixo de `LAYOUT.compactWidthDp` (340, em `src/lib/config.ts`); o hook é `useCompactLayout()` (`src/utils/layout.ts`). Nela, o estado do AvisAI desce para baixo da saudação, o rótulo da viagem pode quebrar em duas linhas e os três atalhos do Início viram lista (em colunas, "recebedor" quebrava no meio da palavra).
- **Rodapés fixos** (botões no fim da tela) somam `useBottomInset()` para não ficar embaixo da barra de navegação do Android.
- **Esfera do AvisAI** sobe acima da linha de escrever em Mensagens (`LAYOUT.messagesComposerDp`), em vez de espremer o campo de texto.
- **Rótulos curtos** (abas) crescem no máximo `LAYOUT.tabLabelMaxScale` com a fonte do sistema; a assinatura RODAR é logotipo e não cresce.
- Desenhos de tamanho fixo (anel da Fila) acompanham a largura e não encolhem (`flexShrink: 0`).
- Número e unidade usam espaço não separável (`55 km`), para "km" não ficar sozinho na linha.
