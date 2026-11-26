# Revisão de usabilidade e desempenho (nov/2026)

Revisão feita no código e no app rodando em 390 × 844 (build web de captura, modo Mock, pt-BR).
A pergunta: o app é rápido e serve para quem dirige um caminhão?

## Resumo

O app está aderente ao que o produto precisa: voz em primeiro lugar, letra grande, alvos de toque grandes, cor sempre com texto ou ícone, offline-first e i18n completo. Faltavam três coisas, todas ligadas a quem está ao volante. Esta revisão corrige essas três e mais dois pontos de desempenho. Abaixo ficam os pontos que ainda pedem decisão.

## Corrigido nesta entrega

| # | Problema | O que mudou |
|---|---|---|
| 1 | Nada impedia mexer no app com o caminhão andando. Só os comandos de voz "abrir documento" e "abrir mensagens" esperavam parar, e o critério era a fase da viagem, não a velocidade. | **Modo direção (R10)**: a velocidade do GPS decide, com histerese (entra > 10 km/h por 4 s, sai < 3 km/h por 5 s). Andando, uma tela por cima de tudo deixa só a voz. Parou, libera sozinha e abre o que ficou pendente. |
| 2 | A esfera do AvisAI ficava fixa no canto inferior direito e cobria botões em algumas telas (por isso sumia nas telas empilhadas). | **Esfera solta**: arrasta para qualquer lugar, fica por cima de tudo, a posição é salva e aparece em todas as telas, inclusive no documento aberto. Toque continua abrindo o painel; leitor de tela abre com o "ativar" normal. |
| 3 | O AvisAI só respondia um campo por vez ("qual o peso?"). Não lia o documento inteiro. | **Leitura em voz alta**: "lê a nota pra mim", "o que diz o documento complementar". Lê só campos extraídos (R7), sem a chave de 44 dígitos. Andando, o PDF fica para quando parar. No documento aberto, botão **Ouvir em voz alta**. |
| 4 | Início, Mapa, Fila, contador de espera e painel Demo assinavam o estado inteiro da viagem (`useTrip()`). O simulador grava o relógio a cada 500 ms, então essas telas redesenhavam duas vezes por segundo, mesmo paradas e mesmo em abas que não estavam à vista. | Cada tela seleciona só os campos que usa (`useShallow`). O Início não redesenha mais enquanto o caminhão espera na doca. |
| 5 | Com o agente falando, o nível do áudio chega a cada 160 ms e redesenhava o painel e a conversa em tela cheia, mesmo fechados. | `AvisaiPanel` e `CabinModeModal` com `memo`: só a esfera acompanha o áudio. |
| 6 | Rodapé do documento com três botões de largura total: com o novo botão, ocupava um terço da tela. | **Ouvir** e **Documentos** lado a lado, mantendo 48 dp de altura. |

## Ainda pede decisão

1. **Passageiro no modo direção.** O Waze pergunta "você é passageiro?". Aqui não há essa opção: quem usa o app é o motorista. Se um ajudante usar o celular do motorista com o caminhão andando, a tela fica travada. Sugestão: manter assim.
2. **Tela de direção no Dev Build com voz real.** No modo Agora, a esfera grande abre a conversa por voz. A leitura de documentos é do agente no backend. O prompt do backend precisa da mesma regra (lista de campos, sem chave de acesso, PDF só parado). Hoje só o agente simulado (`agentMock.ts`) segue a regra.
3. **Textos cortados no Início em 390 dp.** O nome do motorista vira "Carl…" (o selo "AvisAI pronto" disputa a linha) e o destino vira "Mercadão Campinas, CD N…". O destino é a informação mais importante da tela. Sugestão: selo de estado em uma linha própria, ou nome só no primeiro acesso do dia; destino em até 2 linhas.
4. **Texto pequeno (`text-xs`, 12 px) em informação útil.** Aparece no contador de espera (4×), no mapa SVG/Google (12×) e na conversa em tela cheia (4×). Na cabine, com vibração, 12 px é difícil de ler. Sugestão: mínimo `text-sm` (14 px) fora do painel Demo.
5. **Botões `size="sm"` (40 dp de altura)** em 9 lugares. O padrão de acessibilidade é 48 dp. Sugestão: `min-h-12` no próprio `Button` quando `size="sm"`.
6. **O tour do README (`scripts/readme-captures/tour.mjs`) toca no Mapa e no Início durante a viagem.** Com o modo direção, esses toques caem na tela travada. O roteiro precisa passar a usar os **Controles da demo** da tela de direção (ou chegar ao destino antes de navegar pelas abas).
7. **Início com 484 linhas e 16 campos da viagem.** Funciona, mas cada mudança de posição no simulador redesenha a tela inteira. Separar cartão da viagem, atalhos e jornada em componentes, cada um com o próprio seletor.

## O que foi conferido e está bom

- Cor nunca comunica sozinha: estados têm texto e ícone (aba ativa ganha fundo, selo de estado do AvisAI tem rótulo).
- Textos 100% por i18n, pt-BR e en espelhados.
- Escritas pela `outbox` com `idempotencyKey`; o modo direção não grava nada, só lê a velocidade.
- Comandos de voz cobrem todas as telas; o que exige leitura espera o caminhão parar.
- Barra de abas respeita a barra de navegação do Android (área segura).
