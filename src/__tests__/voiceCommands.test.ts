import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../lib/i18n';
import { DOCUMENTS } from '../features/documents/api/documents.mock';
import { findDocumentByName } from '../features/documents/rules/find';
import {
  executeClientAction,
  needsStop,
  pendingWhileMoving,
  resumeWhenStopped,
  setMovingProbeForTests,
  tryExecuteVoiceCommand,
  useVoiceCommandToast,
} from '../services/voiceCommands';

const msg = () => useVoiceCommandToast.getState().message;

describe('comandos do app vindos do backend (acao_cliente)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR');
    useVoiceCommandToast.getState().clear();
  });

  it('abre cada tela pedida pelo agente', () => {
    const casos: [Parameters<typeof executeClientAction>[1], string][] = [
      [{ tela: 'mapa' }, 'Comando de voz: Abrindo Mapa'],
      [{ tela: 'documentos' }, 'Comando de voz: Abrindo Documentos'],
      [{ tela: 'mensagens' }, 'Comando de voz: Abrindo Mensagens'],
      [{ tela: 'fila' }, 'Comando de voz: Abrindo Fila no recebedor'],
      [{ tela: 'inicio' }, 'Comando de voz: Voltando para o Início'],
    ];
    for (const [opts, esperado] of casos) {
      useVoiceCommandToast.getState().clear();
      expect(executeClientAction('open_screen', opts)).toBe(true);
      expect(msg()).toBe(esperado);
    }
  });

  it('abre documento, volta, encerra a conversa e sai da conta', () => {
    expect(executeClientAction('open_document', { documento: 'NF-e' })).toBe(true);
    expect(msg()).toBe('Comando de voz: Abrindo NF-e');
    expect(executeClientAction('go_back')).toBe(true);
    expect(msg()).toBe('Comando de voz: Voltando');
    expect(executeClientAction('end_voice')).toBe(true);
    expect(msg()).toBe('Comando de voz: Encerrando a conversa');
    expect(executeClientAction('logout')).toBe(true);
    expect(msg()).toBe('Comando de voz: Saindo da conta');
  });

  it('ignora a mesma ação repetida em sequência', () => {
    expect(executeClientAction('open_screen', { tela: 'mapa' })).toBe(true);
    expect(executeClientAction('open_screen', { tela: 'mapa' })).toBe(false);
    expect(executeClientAction('open_screen', { tela: 'documentos' })).toBe(true);
  });
});

describe('modo simulado: a fala vira a mesma ação', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR');
    useVoiceCommandToast.getState().clear();
  });

  it('navega pelas telas em pt-BR e en', async () => {
    const casos: [string, string][] = [
      ['Abrir mapa da rota', 'Comando de voz: Abrindo Mapa'],
      ['Vai pras mensagens', 'Comando de voz: Abrindo Mensagens'],
      ['Mudar para documentos', 'Comando de voz: Abrindo Documentos'],
      ['Ver fila de sincronização', 'Comando de voz: Abrindo Mensagens'],
      ['Abre a fila do recebedor', 'Comando de voz: Abrindo Fila no recebedor'],
      ['Abrir os arquivos anexados', 'Comando de voz: Abrindo Documentos'],
      ['Mostrar estadia', 'Comando de voz: Voltando para o Início'],
      ['volta', 'Comando de voz: Voltando'],
    ];
    for (const [fala, esperado] of casos) {
      useVoiceCommandToast.getState().clear();
      expect(tryExecuteVoiceCommand(fala), fala).toBe(true);
      expect(msg()).toBe(esperado);
    }

    await i18n.changeLanguage('en');
    useVoiceCommandToast.getState().clear();
    expect(tryExecuteVoiceCommand('Open route map')).toBe(true);
    expect(msg()).toBe('Voice command: Opening Map');
    useVoiceCommandToast.getState().clear();
    expect(tryExecuteVoiceCommand('Show documents')).toBe(true);
    expect(msg()).toBe('Voice command: Opening Documents');
  });

  it('abre NF-e e CT-e, mas pergunta sobre o documento fica com o agente', () => {
    expect(tryExecuteVoiceCommand('Mostrar a nota fiscal')).toBe(true);
    expect(msg()).toBe('Comando de voz: Abrindo NF-e');
    expect(tryExecuteVoiceCommand('Ver CT-e')).toBe(true);
    expect(msg()).toBe('Comando de voz: Abrindo CT-e');
    expect(tryExecuteVoiceCommand('me mostra o peso da nota')).toBe(false);
    expect(tryExecuteVoiceCommand('Qual o peso da nota?')).toBe(false);
  });

  it('encerra a conversa e só sai da conta com confirmação', () => {
    expect(tryExecuteVoiceCommand('tchau, AvisAI')).toBe(true);
    expect(msg()).toBe('Comando de voz: Encerrando a conversa');

    useVoiceCommandToast.getState().clear();
    expect(tryExecuteVoiceCommand('quero sair da conta')).toBe(true);
    expect(msg()).toBe('Para sair da conta, diga “confirmo, sair da conta”');
    expect(tryExecuteVoiceCommand('confirmo, sair da conta')).toBe(true);
    expect(msg()).toBe('Comando de voz: Saindo da conta');
  });

  it('inicia a viagem e evita execução duplicada', () => {
    expect(tryExecuteVoiceCommand('Iniciar viagem')).toBe(true);
    expect(msg()).toBe('Comando de voz: Viagem iniciada');
    expect(tryExecuteVoiceCommand('Iniciar viagem')).toBe(false);
  });

  it('sai do modo direção em pt-BR e en', async () => {
    expect(tryExecuteVoiceCommand('Sair do modo direção')).toBe(true);
    expect(msg()).toBe('Comando de voz: saindo do modo direção');

    await i18n.changeLanguage('en');
    useVoiceCommandToast.getState().clear();
    expect(tryExecuteVoiceCommand('Exit driving mode')).toBe(true);
    expect(msg()).toBe('Voice command: exiting driving mode');
  });
});

describe('findDocumentByName', () => {
  it('acha pelo tipo ou pelo nome do anexo', () => {
    expect(findDocumentByName(DOCUMENTS, 'a nota fiscal')?.kind).toBe('NF-e');
    expect(findDocumentByName(DOCUMENTS, 'CT-e')?.kind).toBe('CT-e');
    const outro = DOCUMENTS.find((d) => d.kind === 'NF-e')!;
    expect(findDocumentByName(DOCUMENTS, outro.title)?.id).toBe(outro.id);
    expect(findDocumentByName(DOCUMENTS, 'carta de amor')).toBeNull();
  });
});

describe('navegar, recado ao CCO e telas de leitura com o caminhão andando', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR');
    useVoiceCommandToast.getState().clear();
    setMovingProbeForTests(null);
  });

  it('abre a navegação pelo backend e pela fala no modo simulado', () => {
    expect(executeClientAction('open_navigation')).toBe(true);
    expect(msg()).toBe('Comando de voz: Abrindo a rota no mapa do celular');
    useVoiceCommandToast.getState().clear();
    expect(tryExecuteVoiceCommand('me leva até o recebedor')).toBe(true);
    expect(msg()).toBe('Comando de voz: Abrindo a rota no mapa do celular');
  });

  it('manda recado ao CCO no modo simulado', () => {
    expect(tryExecuteVoiceCommand('avisa o CCO que vou parar pra almoçar')).toBe(true);
    expect(msg()).toBe('Comando de voz: Recado enviado ao CCO');
  });

  it('documentos e mensagens esperam o caminhão parar; mapa abre na hora', () => {
    let moving = true;
    setMovingProbeForTests(() => moving);

    expect(executeClientAction('open_document', { documento: 'NF-e' })).toBe(true);
    expect(msg()).toBe('Comando de voz: com o caminhão andando, abro quando você parar');
    expect(pendingWhileMoving()?.action).toBe('open_document');

    expect(executeClientAction('open_screen', { tela: 'mapa' })).toBe(true);
    expect(msg()).toBe('Comando de voz: Abrindo Mapa');

    expect(resumeWhenStopped()).toBe(false); // ainda andando
    moving = false;
    expect(resumeWhenStopped()).toBe(true);
    expect(msg()).toBe('Comando de voz: Abrindo NF-e');
    expect(pendingWhileMoving()).toBeNull();
  });

  it('marca só as telas de leitura', () => {
    expect(needsStop('open_document')).toBe(true);
    expect(needsStop('open_screen', { tela: 'mensagens' })).toBe(true);
    expect(needsStop('open_screen', { tela: 'mapa' })).toBe(false);
    expect(needsStop('open_navigation')).toBe(false);
  });
});
