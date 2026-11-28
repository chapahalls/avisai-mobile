import { useTrip } from '../features/trip';
import { useVoice } from '../features/voice';
import { setBackendStreamHandlers } from '../services/backendStream';

/** Liga o stream do backend (`/ws`) à viagem e à voz. Retorna o "desligar". */
export function wireBackendStream(): () => void {
  setBackendStreamHandlers({
    snapshot: (dado) => useTrip.getState().applyBackendSnapshot(dado),
    posicao: (dado) => useTrip.getState().applyBackendPosicao(dado),
    contador: (estadias) => useTrip.getState().applyBackendContador(estadias),
    task: (task) => useTrip.getState().applyBackendTask(task),
    evento: (dado) => useTrip.getState().applyBackendEvento(dado),
    reset: () => useTrip.getState().applyBackendReset(),
    agentSays: (texto) => useVoice.getState().pushTranscript('agent', texto),
  });
  return () => setBackendStreamHandlers(null);
}
