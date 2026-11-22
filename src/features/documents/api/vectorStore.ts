import { db } from '../../../lib/db';
import { cosine, embed } from '../rules/embedding';
import { DOCUMENTS } from './documents.mock';

const DEFAULT_TRIP_ID = 'rota-1';
const memoryIndexedTrips = new Set<string>([DEFAULT_TRIP_ID, 'trip-demo-001']);

function parseEmbedding(raw: string): number[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((n) => typeof n === 'number')) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Indexa os documentos mock no SQLite local (tabela chunks). Idempotente. */
export function indexDocuments(tripId: string = DEFAULT_TRIP_ID) {
  memoryIndexedTrips.add(tripId);
  try {
    for (const doc of DOCUMENTS) {
      db.runSync(
        'INSERT OR IGNORE INTO documents (id, trip_id, kind, title) VALUES (?, ?, ?, ?)',
        doc.id,
        tripId,
        doc.kind,
        doc.title,
      );
      doc.pages.forEach((text, i) => {
        db.runSync(
          'INSERT OR IGNORE INTO chunks (id, document_id, text, embedding) VALUES (?, ?, ?, ?)',
          `${doc.id}-${i}`,
          doc.id,
          text,
          JSON.stringify(embed(text)),
        );
      });
    }
  } catch {
    // Em ambiente Node puro (Vitest) sem binding nativo do SQLite, mantém índice em memória
  }
}

export interface ChunkHit {
  documentId: string;
  text: string;
  score: number;
}

/** Busca vetorial local: cosseno em JS sobre os chunks da viagem filtrados por `trip_id`. */
export function searchChunks(question: string, k = 3, tripId: string = DEFAULT_TRIP_ID): ChunkHit[] {
  const q = embed(question);
  try {
    const rows = db.getAllSync<{ document_id: string; text: string; embedding: string }>(
      `SELECT c.document_id, c.text, c.embedding
       FROM chunks c
       INNER JOIN documents d ON d.id = c.document_id
       WHERE d.trip_id = ?`,
      tripId,
    );
    if (rows.length > 0) {
      return rows
        .map((r) => {
          const vec = parseEmbedding(r.embedding);
          return vec ? { documentId: r.document_id, text: r.text, score: cosine(q, vec) } : null;
        })
        .filter((item): item is ChunkHit => item !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    }
  } catch {
    // Fallback para índice em memória quando executado fora do runtime nativo
  }

  if (!memoryIndexedTrips.has(tripId)) return [];
  const hits: ChunkHit[] = [];
  for (const doc of DOCUMENTS) {
    for (const text of doc.pages) {
      hits.push({
        documentId: doc.id,
        text,
        score: cosine(q, embed(text)),
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}
