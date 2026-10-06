import { describe, expect, it } from 'vitest';
import {
  confirmarExclusao,
  confirmarTransicaoBot,
  criarTravaDeMutacao,
  formatarUltimaAlteracaoBot,
  isLeadIdValido,
  normalizarBotAtivo,
} from './lead-management';

describe('regras de gerenciamento de leads', () => {
  it.each([1, 42])('aceita o ID inteiro positivo %s', (id) => {
    expect(isLeadIdValido(id)).toBe(true);
  });

  it.each([0, -1, 1.2, NaN, '1', null])('rejeita o ID inválido %s', (id) => {
    expect(isLeadIdValido(id)).toBe(false);
  });

  it('normaliza somente os valores legados reconhecidos como ativos', () => {
    expect(normalizarBotAtivo(true)).toBe(true);
    expect(normalizarBotAtivo('true')).toBe(true);
    expect(normalizarBotAtivo('ativo')).toBe(true);
    expect(normalizarBotAtivo(false)).toBe(false);
    expect(normalizarBotAtivo(null)).toBe(false);
  });

  it('formata timestamp válido e rejeita valores ausentes ou inválidos', () => {
    expect(formatarUltimaAlteracaoBot(null)).toBe('não registrada');
    expect(formatarUltimaAlteracaoBot('inválido')).toBe('não registrada');
    expect(formatarUltimaAlteracaoBot('2026-07-23T12:00:00.000Z')).not.toBe('não registrada');
  });

  it('confirma exclusão apenas quando o banco devolve o mesmo ID', () => {
    expect(confirmarExclusao(8, { id: 8 })).toBe(true);
    expect(confirmarExclusao(8, { id: 9 })).toBe(false);
    expect(confirmarExclusao(8, null)).toBe(false);
  });

  it('confirma IA apenas com ID, estado e timestamp retornados pelo banco', () => {
    expect(
      confirmarTransicaoBot(8, true, {
        id: 8,
        bot_ativo: 'true',
        bot_ativo_alterado_em: '2026-07-23T12:00:00.000Z',
      })
    ).toBe(true);
    expect(
      confirmarTransicaoBot(8, true, {
        id: 8,
        bot_ativo: false,
        bot_ativo_alterado_em: '2026-07-23T12:00:00.000Z',
      })
    ).toBe(false);
    expect(
      confirmarTransicaoBot(8, true, {
        id: 8,
        bot_ativo: true,
        bot_ativo_alterado_em: '',
      })
    ).toBe(false);
  });

  it('permite somente uma mutação por vez até a liberação', () => {
    const trava = criarTravaDeMutacao();
    expect(trava.tentarAdquirir()).toBe(true);
    expect(trava.tentarAdquirir()).toBe(false);
    trava.liberar();
    expect(trava.tentarAdquirir()).toBe(true);
  });
});
