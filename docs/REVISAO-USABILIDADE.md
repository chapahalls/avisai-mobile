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

## Segunda rodada (corrigido)

| # | Problema | O que mudou |
|---|---|---|
| 7 | Início em 390 dp cortava o nome ("Carl…") e o destino ("Mercadão Campinas, CD N…"). | O estado do AvisAI desce para uma linha própria; o nome encolhe para caber; o destino vai até 2 linhas. |
| 8 | Texto de 12 px (ou menos) em informação útil. | Contador de espera, mapas, conversa em tela cheia, jornada, avisos, faixa de rede, selos e mensagens sobem para 14 px; o que era 10–11 px vai para 12 px. Ficam em 12 px só os rótulos em caixa alta de seção, o painel Demo e o login simulado. |
| 9 | Botões `size="sm"` com 40 dp de altura. | `Button` garante 48 dp (`min-h-12`) em todos os tamanhos; o botão de Ajustes e o selo do AvisAI no Início também. |
| 10 | Tour do README tocava em abas com o caminhão andando. | `scripts/readme-captures/tour.mjs` tira o Mapa antes da saída, usa os **Controles da demo** da tela de direção para chegar a 8 km e ao destino, e ganhou a tela `driving.jpg`. Telas do README regeradas. |
| 11 | Início com 484 linhas e 16 campos da viagem num componente só. | Dividido em `pages/home/` (`HomeHeader`, `TripCard`, `HomeSections`), cada parte com o próprio seletor. Só o cartão da viagem acompanha a posição, e a distância vem arredondada: redesenha quando o número na tela muda. |

## Ainda pende

1. **Passageiro no modo direção.** Decisão: manter sem a opção "sou passageiro" (quem usa o app é o motorista).
2. **Prompt do agente no backend (`rodar-backend`).** Com a voz real (LiveKit), a leitura de documentos é do agente no servidor. O prompt precisa da mesma regra: ler só os campos extraídos (R7), sem a chave de acesso, e com o caminhão andando dizer que o PDF abre quando parar. O app já manda a intenção `open_document`, que espera o caminhão parar.

## O que foi conferido e está bom

- Cor nunca comunica sozinha: estados têm texto e ícone (aba ativa ganha fundo, selo de estado do AvisAI tem rótulo).
- Textos 100% por i18n, pt-BR e en espelhados.
- Escritas pela `outbox` com `idempotencyKey`; o modo direção não grava nada, só lê a velocidade.
- Comandos de voz cobrem todas as telas; o que exige leitura espera o caminhão parar.
- Barra de abas respeita a barra de navegação do Android (área segura).
