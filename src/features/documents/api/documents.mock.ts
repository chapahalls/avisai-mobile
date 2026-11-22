import type { TripDocument } from '../types';

/** Documentos FICTÍCIOS para a demo alinhados a backend/app/dominio/documentos.py (declarados no README). */
export const DOCUMENTS: TripDocument[] = [
  {
    id: 'nfe-1',
    kind: 'NF-e',
    title: 'NF-e 000.482.913',
    fields: {
      numero: '000.482.913',
      peso_kg: '28.000 kg (28 t)',
      valor: 'R$ 84.230,50',
      emitente: 'Transportadora Rota Sul',
      destinatario: 'Mercadão Campinas',
      itens: '28 paletes de bebidas',
      chave: '3526 1104 8291 3000 0155 5500 1000 4829 1310 0048 2913',
    },
    pages: [
      'NOTA FISCAL ELETRÔNICA (exemplo fictício)\nNúmero 000.482.913 · Série 1\nEmitente: Transportadora Rota Sul\nDestinatário: Mercadão Campinas\nChave: 3526 1104 8291 3000 0155 5500 1000 4829 1310 0048 2913',
      'Itens: 28 paletes de bebidas.\nPeso bruto total: 28.000 kg (28 t).\nValor total da nota: R$ 84.230,50.',
    ],
  },
  {
    id: 'cte-1',
    kind: 'CT-e',
    title: 'CT-e 000.771.204',
    fields: {
      numero: '000.771.204',
      transportadora: 'Transportadora Rota Sul',
      placa: 'RST-4B21',
      frete: 'R$ 3.120,00',
      nfe_referenciada: '000.482.913',
    },
    pages: [
      'CONHECIMENTO DE TRANSPORTE ELETRÔNICO (exemplo fictício)\nNúmero 000.771.204\nTransportadora: Transportadora Rota Sul · Placa: RST-4B21\nFrete: R$ 3.120,00 · NF-e referenciada: 000.482.913',
    ],
  },
];
