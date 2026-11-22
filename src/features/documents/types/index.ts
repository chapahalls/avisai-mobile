export interface TripDocument {
  id: string;
  kind: 'NF-e' | 'CT-e' | 'MDF-e' | 'Arquivo';
  title: string;
  /** Campos extraídos: a única fonte que o agente usa para responder números. */
  fields: Record<string, string>;
  /** Texto das "páginas" do PDF mock. */
  pages: string[];
  /** URL de download de um anexo real da rota. */
  fileUrl?: string;
  mimeType?: string;
  description?: string | null;
  realFile?: boolean;
}

export type MockDocument = TripDocument;
