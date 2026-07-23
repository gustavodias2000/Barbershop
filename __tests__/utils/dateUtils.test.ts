import {
  formatMoney,
  precoParaCentavos,
  formatPreco,
  toLocalDateString,
  maskPhone,
  formatPhoneToE164,
  maskDiaMes,
  diaMesParaAniversario,
  aniversarioParaExibicao,
  birthdayParaAniversario,
  diasAteProximoAniversario,
} from '../../src/utils/dateUtils';

describe('dinheiro', () => {
  it('formata centavos em BRL', () => {
    expect(formatMoney(2500)).toContain('25,00');
  });

  it('converte preço legado (string) para centavos', () => {
    expect(precoParaCentavos('25,00')).toBe(2500);
    expect(precoParaCentavos('45,90')).toBe(4590);
  });

  it('prioriza precoEmCentavos sobre o campo legado preco', () => {
    expect(formatPreco({ precoEmCentavos: 4500, preco: '99,00' })).toContain('45,00');
  });
});

describe('toLocalDateString', () => {
  it('formata como YYYY-MM-DD usando a data local (não UTC)', () => {
    const d = new Date(2026, 6, 23); // 23/07/2026 (mês 0-indexado)
    expect(toLocalDateString(d)).toBe('2026-07-23');
  });
});

describe('telefone', () => {
  it('aplica a máscara (11) 99999-9999 progressivamente', () => {
    expect(maskPhone('11999999999')).toBe('(11) 99999-9999');
    expect(maskPhone('119999')).toBe('(11) 9999');
  });

  it('formata para E.164 brasileiro (55 + DDD + número)', () => {
    expect(formatPhoneToE164('(11) 99999-9999')).toBe('5511999999999');
    expect(formatPhoneToE164('5511999999999')).toBe('5511999999999');
  });
});

describe('aniversário (dia/mês) — usado em Aniversariantes e importação de contatos', () => {
  it('máscara DD/MM a partir de dígitos', () => {
    expect(maskDiaMes('2307')).toBe('23/07');
    expect(maskDiaMes('23')).toBe('23');
  });

  it('converte DD/MM digitado para o formato de armazenamento MM-DD', () => {
    expect(diaMesParaAniversario('23/07')).toBe('07-23');
  });

  it('rejeita mês inválido', () => {
    expect(diaMesParaAniversario('01/13')).toBeUndefined();
  });

  it('rejeita dia inválido para o mês (30/02 não existe mesmo em ano bissexto)', () => {
    expect(diaMesParaAniversario('30/02')).toBeUndefined();
  });

  it('aceita 29/02 (ano bissexto de referência)', () => {
    expect(diaMesParaAniversario('29/02')).toBe('02-29');
  });

  it('rejeita entrada incompleta', () => {
    expect(diaMesParaAniversario('2/7')).toBeUndefined();
  });

  it('converte de volta para exibição DD/MM', () => {
    expect(aniversarioParaExibicao('07-23')).toBe('23/07');
  });

  it('converte o Birthday do react-native-contacts', () => {
    expect(birthdayParaAniversario({ day: 23, month: 7 })).toBe('07-23');
    expect(birthdayParaAniversario({ day: undefined, month: 7 })).toBeUndefined();
    expect(birthdayParaAniversario(null)).toBeUndefined();
  });

  it('calcula dias até o próximo aniversário — hoje mesmo', () => {
    const hoje = new Date(2026, 6, 23);
    expect(diasAteProximoAniversario('07-23', hoje)).toBe(0);
  });

  it('calcula dias até o próximo aniversário — já passou este ano, pula pro ano seguinte', () => {
    const hoje = new Date(2026, 6, 23); // 23/07/2026
    // Aniversário em 01/01: já passou em 2026, deve calcular pra 01/01/2027
    const dias = diasAteProximoAniversario('01-01', hoje);
    expect(dias).toBeGreaterThan(150);
    expect(dias).toBeLessThan(200);
  });

  it('calcula dias até o próximo aniversário — ainda não chegou este ano', () => {
    const hoje = new Date(2026, 0, 1); // 01/01/2026
    const dias = diasAteProximoAniversario('01-15', hoje);
    expect(dias).toBe(14);
  });
});
