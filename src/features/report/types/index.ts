/** O que o agente está esperando ouvir do motorista agora. */
export type ReportContext = 'pickup' | 'checkin' | 'unload' | 'occurrence' | 'free';

export type FieldKey =
  | 'carga'
  | 'caminhao'
  | 'status_carga'
  | 'avarias'
  | 'ocorrencias'
  | 'descarga'
  | 'problema'
  | 'km'
  | 'br';
