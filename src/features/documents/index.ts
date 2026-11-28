export { DOCUMENTS } from './api/documents.mock';
export { indexDocuments, searchChunks } from './api/vectorStore';
export {
  useDocuments,
  apiDocumentToTripDocument,
  apiRouteFileToTripDocument,
} from './hooks/useDocuments';
export { answerDocumentQuestion, answerDocumentQuestionWithMeta } from './rules/answer';
export { findDocumentByName } from './rules/find';
export {
  buildDocumentReading,
  isDocumentReadRequest,
  readDocumentAloud,
  type DocumentReadingResult,
} from './rules/readAloud';
export { embed, cosine } from './rules/embedding';
export { MockPdfViewer } from './components/MockPdfViewer';
export { DocumentList } from './components/DocumentList';
export type { MockDocument, TripDocument } from './types';
