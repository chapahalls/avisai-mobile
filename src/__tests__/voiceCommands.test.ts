import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../lib/i18n';
import { tryExecuteVoiceCommand, useVoiceCommandToast } from '../services/voiceCommands';

describe('voiceCommands automation', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR');
    useVoiceCommandToast.getState().clear();
  });

  it('reconhece comando de abrir mapa em pt-BR e en', async () => {
    expect(tryExecuteVoiceCommand('Abrir mapa da rota')).toBe(true);
    expect(useVoiceCommandToast.getState().message).toBe('Comando de voz: Abrindo Mapa');

    useVoiceCommandToast.getState().clear();
    await i18n.changeLanguage('en');
    expect(tryExecuteVoiceCommand('Open route map')).toBe(true);
    expect(useVoiceCommandToast.getState().message).toBe('Voice command: Opening Map');
  });

  it('reconhece comando de abrir NF-e e CT-e em pt-BR e en', async () => {
    expect(tryExecuteVoiceCommand('Mostrar a nota fiscal')).toBe(true);
    expect(useVoiceCommandToast.getState().message).toBe('Comando de voz: Abrindo NF-e');

    useVoiceCommandToast.getState().clear();
    expect(tryExecuteVoiceCommand('Ver CT-e')).toBe(true);
    expect(useVoiceCommandToast.getState().message).toBe('Comando de voz: Abrindo CT-e');

    useVoiceCommandToast.getState().clear();
    await i18n.changeLanguage('en');
    expect(tryExecuteVoiceCommand('Open invoice')).toBe(true);
    expect(useVoiceCommandToast.getState().message).toBe('Voice command: Opening NF-e');
  });

  it('reconhece comando de abrir documentos em pt-BR e en', async () => {
    expect(tryExecuteVoiceCommand('Abrir documentos da viagem')).toBe(true);
    expect(useVoiceCommandToast.getState().message).toBe('Comando de voz: Abrindo Documentos');

    useVoiceCommandToast.getState().clear();
    expect(tryExecuteVoiceCommand('Abrir os arquivos anexados')).toBe(true);
    expect(useVoiceCommandToast.getState().message).toBe('Comando de voz: Abrindo Documentos');

    useVoiceCommandToast.getState().clear();
    await i18n.changeLanguage('en');
    expect(tryExecuteVoiceCommand('Show documents')).toBe(true);
    expect(useVoiceCommandToast.getState().message).toBe('Voice command: Opening Documents');
  });

  it('reconhece comando de abrir fila / sincronização em pt-BR e en', async () => {
    expect(tryExecuteVoiceCommand('Ver fila de sincronização')).toBe(true);
    expect(useVoiceCommandToast.getState().message).toBe('Comando de voz: Abrindo Fila');

    useVoiceCommandToast.getState().clear();
    await i18n.changeLanguage('en');
    expect(tryExecuteVoiceCommand('Open outbox')).toBe(true);
    expect(useVoiceCommandToast.getState().message).toBe('Voice command: Opening Queue');
  });

  it('reconhece comando de voltar para viagem / estadia / voz em pt-BR e en', async () => {
    expect(tryExecuteVoiceCommand('Mostrar estadia')).toBe(true);
    expect(useVoiceCommandToast.getState().message).toBe('Comando de voz: Voltando para Viagem');

    useVoiceCommandToast.getState().clear();
    await i18n.changeLanguage('en');
    expect(tryExecuteVoiceCommand('Go to trip')).toBe(true);
    expect(useVoiceCommandToast.getState().message).toBe('Voice command: Returning to Trip');
  });

  it('reconhece comando de iniciar viagem e evita execução duplicada dentro de 2,5 s', () => {
    expect(tryExecuteVoiceCommand('Iniciar viagem')).toBe(true);
    expect(useVoiceCommandToast.getState().message).toBe('Comando de voz: Viagem iniciada');

    // Mesma fala imediatamente depois é bloqueada pela deduplicação de 2,5 s
    expect(tryExecuteVoiceCommand('Iniciar viagem')).toBe(false);

    // Fala comum que não é comando de navegação retorna false
    expect(tryExecuteVoiceCommand('Qual o peso da nota?')).toBe(false);
  });
});
