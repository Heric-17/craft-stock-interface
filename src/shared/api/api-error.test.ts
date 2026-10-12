import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { server } from '@/test/msw/server';

import type { ApiError } from './api-error';
import { consumptionUnitLockedReason, entityInUseSummary, messageForError } from './error-messages';
import { request } from './http-client';

const API = env.VITE_API_URL;

/**
 * The error contract, exercised through the network.
 *
 * Nothing here mocks `fetch` or the `http-client` module: the body the API
 * sends, the `code` it is keyed by and the `details` a screen reads are the
 * thing under test, so MSW answers and the real client parses.
 *
 * Every body below is the documented shape from `docs/api-reference.md`,
 * section 3.
 */
async function failWith(body: Record<string, unknown>, status: number): Promise<ApiError> {
  server.use(http.post(`${API}/probe`, () => HttpResponse.json(body, { status })));

  return (await request('/probe', { method: 'POST', body: {} }).catch(
    (caught: unknown) => caught,
  )) as ApiError;
}

describe('ENTITY_IN_USE', () => {
  it('reads the counts per kind of reference, and never the English message', async () => {
    const error = await failWith(
      {
        statusCode: 422,
        code: 'ENTITY_IN_USE',
        error: 'EntityInUseError',
        message: 'Material m1 cannot be deleted: it is referenced by 5 other record(s).',
        details: {
          entityName: 'Material',
          entityId: 'm1',
          saleItems: 3,
          bomItems: 2,
          purchaseItems: 0,
          stockMovements: 0,
          total: 5,
        },
      },
      422,
    );

    const details = error.detailsFor('ENTITY_IN_USE');

    expect(details?.total).toBe(5);
    expect(details?.saleItems).toBe(3);
    expect(entityInUseSummary(error)).toBe('Em uso em 3 vendas e 2 fichas técnicas.');
  });

  it('writes one reference in the singular', async () => {
    const error = await failWith(
      {
        statusCode: 422,
        code: 'ENTITY_IN_USE',
        error: 'EntityInUseError',
        message: 'in use',
        details: {
          entityName: 'CompositeProduct',
          entityId: 'p1',
          saleItems: 1,
          bomItems: 0,
          purchaseItems: 0,
          stockMovements: 0,
          total: 1,
        },
      },
      422,
    );

    expect(entityInUseSummary(error)).toBe('Em uso em 1 venda.');
  });

  it('gives no breakdown when the details are not the documented shape', async () => {
    // The nested `references` object the project notes once described. The
    // screen degrades to the generic sentence instead of crashing.
    const error = await failWith(
      {
        statusCode: 422,
        code: 'ENTITY_IN_USE',
        error: 'EntityInUseError',
        message: 'in use',
        details: { entityName: 'Material', entityId: 'm1', references: { saleItems: 3 }, total: 3 },
      },
      422,
    );

    expect(error.detailsFor('ENTITY_IN_USE')).toBeUndefined();
    expect(entityInUseSummary(error)).toBeUndefined();
    expect(messageForError(error)).toContain('Descontinue');
  });
});

describe('CONSUMPTION_UNIT_LOCKED', () => {
  it('explains stock on hand, with the way out for that reason', async () => {
    const error = await failWith(
      {
        statusCode: 422,
        code: 'CONSUMPTION_UNIT_LOCKED',
        error: 'ConsumptionUnitLockedError',
        message: 'locked',
        details: {
          materialId: 'm1',
          reason: 'STOCK_ON_HAND',
          stockQuantity: 1500,
          bomItemReferences: 0,
        },
      },
      422,
    );

    expect(error.detailsFor('CONSUMPTION_UNIT_LOCKED')?.reason).toBe('STOCK_ON_HAND');
    expect(consumptionUnitLockedReason(error)).toContain('Zere o estoque');
  });

  it('explains recipe references, with a different way out', async () => {
    const error = await failWith(
      {
        statusCode: 422,
        code: 'CONSUMPTION_UNIT_LOCKED',
        error: 'ConsumptionUnitLockedError',
        message: 'locked',
        details: {
          materialId: 'm1',
          reason: 'BOM_REFERENCES',
          stockQuantity: 0,
          bomItemReferences: 4,
        },
      },
      422,
    );

    const sentence = consumptionUnitLockedReason(error);

    expect(sentence).toContain('4 fichas técnicas');
    expect(sentence).not.toContain('Zere o estoque');
  });
});

describe('DUPLICATE_INVOICE', () => {
  it('answers 409 and carries the purchase that already exists', async () => {
    const error = await failWith(
      {
        statusCode: 409,
        code: 'DUPLICATE_INVOICE',
        error: 'DuplicateInvoiceError',
        message: 'Invoice 3524… was already imported as Purchase p9.',
        details: { accessKey: '3'.repeat(44), existingPurchaseId: 'p9' },
      },
      409,
    );

    expect(error.statusCode).toBe(409);
    expect(error.detailsFor('DUPLICATE_INVOICE')?.existingPurchaseId).toBe('p9');
    expect(messageForError(error)).toBe('Esta nota já foi importada.');
  });
});

describe('DISCOUNT_ALLOCATION', () => {
  it('gives the sentence of the reason, and the amounts as decimal strings', async () => {
    const error = await failWith(
      {
        statusCode: 422,
        code: 'DISCOUNT_ALLOCATION',
        error: 'DiscountAllocationError',
        message: 'Allocated 4.00 does not match discountTotal 6.00.',
        details: { reason: 'SUM_MISMATCH', expected: '6.00', provided: '4.00' },
      },
      422,
    );

    const details = error.detailsFor('DISCOUNT_ALLOCATION');

    // Decimal strings, to go through Money — never parsed out of the message.
    expect(details?.expected).toBe('6.00');
    expect(details?.provided).toBe('4.00');
    expect(messageForError(error)).toBe('O desconto distribuído não fecha com o desconto da nota.');
  });

  it('gives a different sentence for each reason, and names the line when there is one', async () => {
    const error = await failWith(
      {
        statusCode: 422,
        code: 'DISCOUNT_ALLOCATION',
        error: 'DiscountAllocationError',
        message: 'line exceeds gross',
        details: {
          reason: 'LINE_EXCEEDS_GROSS',
          itemId: 'i7',
          expected: '10.00',
          provided: '12.00',
        },
      },
      422,
    );

    expect(error.detailsFor('DISCOUNT_ALLOCATION')?.itemId).toBe('i7');
    expect(messageForError(error)).toBe('Uma linha recebeu mais desconto do que ela vale.');
  });

  it('falls back to the generic sentence for a reason this build does not know', async () => {
    const error = await failWith(
      {
        statusCode: 422,
        code: 'DISCOUNT_ALLOCATION',
        error: 'DiscountAllocationError',
        message: 'something new',
        details: { reason: 'SOME_NEW_REASON', expected: '1.00' },
      },
      422,
    );

    expect(error.detailsFor('DISCOUNT_ALLOCATION')).toBeUndefined();
    expect(messageForError(error)).toBe('A distribuição do desconto não pôde ser aplicada.');
  });
});

describe('PENDING_DISCOUNT_ALLOCATION', () => {
  it('carries what is expected and what the lines add up to', async () => {
    const error = await failWith(
      {
        statusCode: 422,
        code: 'PENDING_DISCOUNT_ALLOCATION',
        error: 'PendingDiscountAllocationError',
        message: 'pending',
        details: { purchaseId: 'c1', expected: '6.00', provided: '2.50' },
      },
      422,
    );

    const details = error.detailsFor('PENDING_DISCOUNT_ALLOCATION');

    expect(details?.purchaseId).toBe('c1');
    expect(details?.expected).toBe('6.00');
    expect(messageForError(error)).toContain('Distribua todo o desconto');
  });
});

describe('UNSUPPORTED_IMAGE_MIME_TYPE', () => {
  it('carries what was sent and what is accepted', async () => {
    const error = await failWith(
      {
        statusCode: 422,
        code: 'UNSUPPORTED_IMAGE_MIME_TYPE',
        error: 'UnsupportedImageMimeTypeError',
        message: 'unsupported',
        details: {
          mimeType: 'image/gif',
          supported: ['image/jpeg', 'image/png', 'image/webp'],
        },
      },
      422,
    );

    const details = error.detailsFor('UNSUPPORTED_IMAGE_MIME_TYPE');

    expect(details?.mimeType).toBe('image/gif');
    expect(details?.supported).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });
});

describe('VALIDATION_FAILED', () => {
  it('binds each violation to the field by path, including an array index', async () => {
    const error = await failWith(
      {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        error: 'ValidationFailed',
        message: 'Validation failed',
        details: [
          { path: 'email', constraints: ['email must be an email'] },
          {
            path: 'billOfMaterials.0.quantity',
            constraints: ['quantity must be positive'],
          },
        ],
      },
      400,
    );

    expect(error.validationIssues).toHaveLength(2);
    expect(error.issuesForPath('billOfMaterials.0.quantity')).toEqual([
      'quantity must be positive',
    ]);
    expect(error.issuesForPath('packageCost')).toEqual([]);
    expect(messageForError(error)).toContain('campos destacados');
  });

  it('keeps the older bare-string shape as form-level issues', async () => {
    const error = await failWith(
      {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        error: 'Bad Request',
        message: 'Validation failed',
        details: ['packageCost must be a decimal amount, e.g. "12.90"'],
      },
      400,
    );

    expect(error.validationIssues).toHaveLength(1);
    expect(error.validationIssues[0]?.path).toBe('');
  });
});

describe('an unknown code', () => {
  it('falls back by status band instead of breaking the screen', async () => {
    const error = await failWith(
      {
        statusCode: 422,
        code: 'SOME_RULE_ADDED_LATER',
        error: 'SomeRuleAddedLaterError',
        message: 'A rule this build has never heard of.',
        details: { whatever: true },
      },
      422,
    );

    expect(error.code).toBe('SOME_RULE_ADDED_LATER');
    expect(messageForError(error)).toBe('Confira os campos destacados e tente de novo.');
    expect(messageForError(error)).not.toContain('never heard of');
  });

  it('falls back to the conflict band for an unknown 409', async () => {
    const error = await failWith(
      { statusCode: 409, code: 'SOME_CONFLICT', error: 'SomeConflictError', message: 'conflict' },
      409,
    );

    expect(messageForError(error)).toBe('Isso entra em conflito com algo que já existe.');
  });

  it('treats a 503 as temporary rather than as a failure of ours', async () => {
    const error = await failWith(
      {
        statusCode: 503,
        code: 'INVOICE_SOURCE_UNAVAILABLE',
        error: 'InvoiceSourceUnavailableError',
        message: 'portal down',
      },
      503,
    );

    expect(messageForError(error)).toContain('SEFAZ');
  });

  it('shows nothing technical for an unexpected failure, only the support code', async () => {
    const error = await failWith(
      {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        error: 'InternalServerError',
        message: 'Cannot read properties of undefined',
        correlationId: 'zz-9',
        errorId: 'zz-9',
      },
      500,
    );

    expect(error.supportId).toBe('zz-9');
    expect(messageForError(error)).not.toContain('undefined');
    expect(messageForError(error)).toContain('suporte');
  });
});

describe('the session', () => {
  it('tells a refused refresh apart from any other 401', async () => {
    const refused = await failWith(
      {
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN',
        error: 'InvalidRefreshTokenError',
        message: 'Refresh token is invalid, expired, or already used.',
      },
      401,
    );

    expect(refused.isUnauthenticated).toBe(true);
    expect(refused.isSessionOver).toBe(true);

    const wrongPassword = await failWith(
      {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        error: 'InvalidCredentialsError',
        message: 'Invalid email or password.',
      },
      401,
    );

    expect(wrongPassword.isSessionOver).toBe(false);
    expect(messageForError(wrongPassword)).toBe('E-mail ou senha incorretos.');
  });
});
