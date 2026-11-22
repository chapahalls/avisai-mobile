import type { MockDocument } from '../types';

/** Documentos FICTÍCIOS para a demo (declarados no README). */
export const DOCUMENTS: MockDocument[] = [
  {
    id: 'nfe-1',
    kind: 'NF-e',
    title: 'NF-e 000.123.456',
    fields: {
      numero: '000.123.456',
      peso: '28.400 kg',
      valor: 'R$ 186.900,00',
      destinatario: 'Supermercado Destino (fictício)',
      produto: 'Bebidas não alcoólicas, 1.420 caixas',
    },
    pages: [
      'NOTA FISCAL ELETRÔNICA (exemplo fictício)\nNúmero 000.123.456 · Série 1\nEmitente: Indústria Exemplo Ltda.\nDestinatário: Supermercado Destino (fictício)',
      'Produtos: bebidas não alcoólicas, 1.420 caixas.\nPeso bruto total: 28.400 kg.\nValor total da nota: R$ 186.900,00.',
    ],
  },
  {
    id: 'cte-1',
    kind: 'CT-e',
    title: 'CT-e 000.987',
    fields: {
      numero: '000.987',
      transportadora: 'Transportadora Exemplo (fictícia)',
      origem: 'CD Origem (fictício)',
      destino: 'Supermercado Destino (fictício)',
    },
    pages: [
      'CONHECIMENTO DE TRANSPORTE ELETRÔNICO (exemplo fictício)\nNúmero 000.987\nTransportadora Exemplo (fictícia)\nOrigem: CD Origem · Destino: Supermercado Destino',
    ],
  },
];
