import { describe, expect, it } from 'vitest';

import { appErrorPayloadSchema, ipcResponseSchema } from './errors';

describe('structured IPC errors', () => {
  it('valida resposta de sucesso sem misturar erro no payload', () => {
    expect(ipcResponseSchema.parse({ ok: true, data: { id: 'resultado-1' } })).toEqual({
      ok: true,
      data: { id: 'resultado-1' },
    });
  });

  it('valida código estável, mensagem de apresentação e detalhes estruturados', () => {
    const error = appErrorPayloadSchema.parse({
      code: 'VALIDATION_ERROR',
      message: 'Informe uma justificativa válida.',
      details: { field: 'reason', minimumLength: 3 },
    });

    expect(error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Informe uma justificativa válida.',
      details: { field: 'reason', minimumLength: 3 },
    });
    expect(ipcResponseSchema.parse({ ok: false, error })).toEqual({ ok: false, error });
  });

  it('rejeita códigos arbitrários para impedir mensagem textual como protocolo', () => {
    expect(() =>
      appErrorPayloadSchema.parse({
        code: 'JUSTIFICATIVA_CURTA',
        message: 'Inválido',
        details: null,
      }),
    ).toThrow();
  });
});
