import { db } from '../../../lib/db';
import { cosine, embed } from '../rules/embedding';
import { DOCUMENTS } from './documents.mock';

/** Indexa os documentos mock no SQLite local (tabela chunks). Idempotente. */
export function indexDocuments(tripId: string) {
  for (const doc of DOCUMENTS) {
    db.runSync('INSERT OR IGNORE INTO documents (id, trip_id, kind, title) VALUES (?, ?, ?, ?)', doc.id, tripId, doc.kind, doc.title);
    doc.pages.forEach((text, i) => {
      db.runSync(
        'INSERT OR IGNORE INTO chunks (id, document_id, text, embedding) VALUES (?, ?, ?, ?)',
        `${doc.id}-${i}`, doc.id, text, JSON.stringify(embed(text)),
      );
    });
  }
}

export interface ChunkHit {
  documentId: string;
  text: string;
  score: number;
}

/** Busca vetorial local: cosseno em JS sobre os chunks da viagem. */
export function searchChunks(question: string, k = 3): ChunkHit[] {
  const q = embed(question);
  const rows = db.getAllSync<{ document_id: string; text: string; embedding: string }>(
    'SELECT document_id, text, embedding FROM chunks',
  );
  return rows
    .map((r) => ({ documentId: r.document_id, text: r.text, score: cosine(q, JSON.parse(r.embedding)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
