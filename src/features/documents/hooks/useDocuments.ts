import { create } from 'zustand';
import { getApiClient, useApiConfig } from '../../../services/api';
import type { ApiDocumentResponse } from '../../../types/backend';
import { brl } from '../../../utils/format';
import { DOCUMENTS } from '../api/documents.mock';
import type { TripDocument } from '../types';

function buildReadablePages(doc: ApiDocumentResponse, fields: Record<string, string>): string[] {
  if (doc.kind === 'NF-e') {
    const numero = fields.numero ?? doc.number;
    const emitente = fields.emitente ?? doc.issuer ?? 'Transportadora Rota Sul';
    const destinatario = fields.destinatario ?? doc.recipient ?? 'Mercadão Campinas';
    const chave = fields.chave ? `\nChave: ${fields.chave}` : '';
    const itens = fields.itens ?? fields.produto ?? doc.items ?? '28 paletes de bebidas';
    const peso = fields.peso_kg ?? fields.peso ?? '28.000 kg (28 t)';
    const valor = fields.valor ?? (typeof doc.valueBRL === 'number' ? brl(doc.valueBRL) : 'R$ 84.230,50');
    return [
      `NOTA FISCAL ELETRÔNICA\nNúmero ${numero} · Série 1\nEmitente: ${emitente}\nDestinatário: ${destinatario}${chave}`,
      `Itens: ${itens}.\nPeso bruto total: ${peso}.\nValor total da nota: ${valor}.`,
    ];
  }

  const numero = fields.numero ?? doc.number;
  const transportadora = fields.transportadora ?? doc.carrier ?? 'Transportadora Rota Sul';
  const placa = fields.placa ?? doc.plate ?? 'RST-4B21';
  const frete = fields.frete ?? (typeof doc.freightBRL === 'number' ? brl(doc.freightBRL) : 'R$ 3.120,00');
  const nfeRef = fields.nfe_referenciada ? ` · NF-e referenciada: ${fields.nfe_referenciada}` : '';
  return [
    `CONHECIMENTO DE TRANSPORTE ELETRÔNICO\nNúmero ${numero}\nTransportadora: ${transportadora} · Placa: ${placa}\nFrete: ${frete}${nfeRef}`,
  ];
}

export function apiDocumentToTripDocument(apiDoc: ApiDocumentResponse): TripDocument {
  const fields: Record<string, string> = {};

  if (apiDoc.campos && typeof apiDoc.campos === 'object') {
    for (const [k, v] of Object.entries(apiDoc.campos)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        fields[k] = String(v);
      }
    }
  }

  if (!fields.numero && apiDoc.number) fields.numero = apiDoc.number;
  if (!fields.emitente && apiDoc.issuer) fields.emitente = apiDoc.issuer;
  if (!fields.destinatario && apiDoc.recipient) fields.destinatario = apiDoc.recipient;
  if (!fields.peso_kg && !fields.peso && typeof apiDoc.weightKg === 'number') {
    const tons = Math.round(apiDoc.weightKg / 1000);
    fields.peso_kg = `${apiDoc.weightKg.toLocaleString('pt-BR')} kg (${tons} t)`;
  }
  if (!fields.itens && !fields.produto && apiDoc.items) fields.itens = apiDoc.items;
  if (!fields.valor && typeof apiDoc.valueBRL === 'number') fields.valor = brl(apiDoc.valueBRL);
  if (!fields.transportadora && apiDoc.carrier) fields.transportadora = apiDoc.carrier;
  if (!fields.placa && apiDoc.plate) fields.placa = apiDoc.plate;
  if (!fields.frete && typeof apiDoc.freightBRL === 'number') fields.frete = brl(apiDoc.freightBRL);

  return {
    id: apiDoc.id,
    kind: apiDoc.kind,
    title: apiDoc.title,
    fields,
    pages: buildReadablePages(apiDoc, fields),
  };
}

interface DocumentsState {
  documents: TripDocument[];
  loading: boolean;
  lastSyncedAt: string | null;
  syncFromBackend: (tripId?: string) => Promise<void>;
  reset: () => void;
}

export const useDocuments = create<DocumentsState>((set) => ({
  documents: DOCUMENTS,
  loading: false,
  lastSyncedAt: null,
  syncFromBackend: async (tripId?: string) => {
    const { rotaId } = useApiConfig.getState();
    set({ loading: true });
    try {
      const apiDocs = await getApiClient().getDocuments(tripId ?? String(rotaId));
      if (Array.isArray(apiDocs) && apiDocs.length > 0) {
        set({
          documents: apiDocs.map(apiDocumentToTripDocument),
          lastSyncedAt: new Date().toISOString(),
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },
  reset: () => set({ documents: DOCUMENTS, loading: false, lastSyncedAt: null }),
}));
