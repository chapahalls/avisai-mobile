import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../lib/i18n';
import { answerDocumentQuestion } from '../features/documents/rules/answer';
import { cosine, embed } from '../features/documents/rules/embedding';

describe('documents rules (R7)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR');
  });

  it('responde apenas com campos extraidos citando o documento em pt-BR', () => {
    const weightAnswer = answerDocumentQuestion('Qual o peso da nota?');
    expect(weightAnswer).toContain('NF-e 000.482.913');
    expect(weightAnswer).toContain('28 t');

    const valueAnswer = answerDocumentQuestion('Qual o valor da NF?');
    expect(valueAnswer).toContain('NF-e 000.482.913');
    expect(valueAnswer).toContain('R$ 84.230,50');

    const keyAnswer = answerDocumentQuestion('Qual a chave da NF-e?');
    expect(keyAnswer).toContain('NF-e 000.482.913');
    expect(keyAnswer).toContain('3526 1104 8291');

    const cteAnswer = answerDocumentQuestion('Qual o número do CT-e?');
    expect(cteAnswer).toContain('CT-e 000.771.204');
    expect(cteAnswer).toContain('000.771.204');
  });

  it('responde apenas com campos extraidos citando o documento em en', async () => {
    await i18n.changeLanguage('en');
    const weightAnswer = answerDocumentQuestion('What is the invoice weight?');
    expect(weightAnswer).toContain('NF-e 000.482.913');
    expect(weightAnswer).toContain('28 t');

    const cteAnswer = answerDocumentQuestion('What is the CT-e number?');
    expect(cteAnswer).toContain('CT-e 000.771.204');
    expect(cteAnswer).toContain('000.771.204');
  });

  it('retorna "nao encontrei" quando o campo nao existe no documento', async () => {
    // Compara com o texto do i18n: a frase pode ficar mais coloquial sem quebrar a regra.
    const notFound = i18n.t('documents.notFound');
    expect(answerDocumentQuestion('Qual o CNPJ e o valor do frete?')).toBe(notFound);
    expect(answerDocumentQuestion('Qual o valor do CT-e?')).toBe(notFound);

    await i18n.changeLanguage('en');
    expect(answerDocumentQuestion('What is the freight tax and CNPJ?')).toBe(i18n.t('documents.notFound'));
  });

  it('gera embeddings deterministicos de 64 dimensoes e calcula similaridade cosseno', () => {
    const v1 = embed('Peso bruto total 28.400 kg bebidas');
    const v2 = embed('Peso bruto total 28.400 kg bebidas');
    const v3 = embed('Assunto completamente diferente sem intersecao');

    expect(v1).toHaveLength(64);
    expect(cosine(v1, v2)).toBeCloseTo(1, 5);
    expect(cosine(v1, v3)).toBeLessThan(0.5);
  });
});
