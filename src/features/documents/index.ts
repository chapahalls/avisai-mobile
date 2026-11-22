export { DOCUMENTS } from './api/documents.mock';
export { indexDocuments, searchChunks } from './api/vectorStore';
export { useDocuments, apiDocumentToTripDocument } from './hooks/useDocuments';
export { answerDocumentQuestion, answerDocumentQuestionWithMeta } from './rules/answer';
export { embed, cosine } from './rules/embedding';
export { MockPdfViewer } from './components/MockPdfViewer';
export { DocumentList } from './components/DocumentList';
export type { MockDocument, TripDocument } from './types';
