export interface TripDocument {
  id: string;
  kind: 'NF-e' | 'CT-e' | 'MDF-e';
  title: string;
  /** Campos extraídos: a única fonte que o agente usa para responder números. */
  fields: Record<string, string>;
  /** Texto das "páginas" do PDF mock. */
  pages: string[];
}

export type MockDocument = TripDocument;
