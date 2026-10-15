import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { server } from '@/test/msw/server';
import { ProbeQuery } from '@/test/probe';

const API = env.VITE_API_URL;

/** The real client, the real network layer and the real error state, with MSW as the API. */
function renderProbe() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ProbeQuery />
    </QueryClientProvider>,
  );
}

function probeAnswers(status: number, body: Record<string, unknown>) {
  server.use(http.get(`${API}/probe`, () => HttpResponse.json(body, { status })));
}

describe('an unexpected failure', () => {
  const internalError = {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    error: 'InternalServerError',
    message: 'Internal server error',
    path: '/probe',
    timestamp: '2026-10-12T12:00:00.000Z',
    correlationId: 'corr-7f3a',
    errorId: 'err-9c1d-44',
  };

  it('shows the errorId on screen, with the instruction to send it to support', async () => {
    probeAnswers(500, internalError);
    renderProbe();

    expect(await screen.findByText('err-9c1d-44')).toBeInTheDocument();
    expect(screen.getByText('Envie este código para o suporte')).toBeInTheDocument();
  });

  it('copies the code with the button', async () => {
    probeAnswers(500, internalError);
    const user = userEvent.setup();
    renderProbe();

    await user.click(await screen.findByRole('button', { name: 'Copiar código' }));

    expect(await navigator.clipboard.readText()).toBe('err-9c1d-44');
    expect(await screen.findByRole('button', { name: 'Código copiado' })).toBeInTheDocument();
  });

  it('shows nothing technical: no stack, no JSON, no code, no English', async () => {
    probeAnswers(500, {
      ...internalError,
      stack: 'Error: boom\n    at handler (/app/dist/x.js:1:1)',
    });
    renderProbe();

    await screen.findByText('err-9c1d-44');

    const text = document.body.textContent ?? '';
    expect(text).not.toContain('Internal server error');
    expect(text).not.toContain('INTERNAL_ERROR');
    expect(text).not.toContain('InternalServerError');
    expect(text).not.toContain('at handler');
    expect(text).not.toContain('{');
  });

  it('falls back to the correlation id, from the header, when the body says nothing', async () => {
    server.use(
      http.get(
        `${API}/probe`,
        () => new HttpResponse(null, { status: 502, headers: { 'X-Correlation-Id': 'edge-5521' } }),
      ),
    );
    renderProbe();

    expect(await screen.findByText('edge-5521')).toBeInTheDocument();
    expect(screen.getByText('Envie este código para o suporte')).toBeInTheDocument();
  });

  it('reads a gateway page that is not JSON without breaking the screen', async () => {
    server.use(
      http.get(
        `${API}/probe`,
        () =>
          new HttpResponse('<html><body>Bad Gateway</body></html>', {
            status: 502,
            headers: { 'Content-Type': 'text/html', 'X-Correlation-Id': 'edge-8800' },
          }),
      ),
    );
    renderProbe();

    expect(await screen.findByText('edge-8800')).toBeInTheDocument();
    expect(screen.queryByText(/Bad Gateway/)).not.toBeInTheDocument();
  });

  it('tells a network failure apart, and has no code to show because none was recorded', async () => {
    server.use(http.get(`${API}/probe`, () => HttpResponse.error()));
    renderProbe();

    expect(await screen.findByText(/Verifique a conexão/)).toBeInTheDocument();
    expect(screen.queryByText('Envie este código para o suporte')).not.toBeInTheDocument();
  });

  it('offers to try again, and recovers when the API does', async () => {
    probeAnswers(500, internalError);
    const user = userEvent.setup();
    renderProbe();

    await screen.findByText('err-9c1d-44');
    probeAnswers(200, { ok: true });
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('carregado')).toBeInTheDocument();
  });
});

describe('a failure the user can act on', () => {
  it('writes ENTITY_IN_USE with the counts read from details, and the way out', async () => {
    probeAnswers(422, {
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
        stockLosses: 0,
        total: 5,
      },
      correlationId: 'corr-1',
    });
    renderProbe();

    expect(await screen.findByText('Em uso em 3 vendas e 2 fichas técnicas.')).toBeInTheDocument();
    expect(screen.getByText(/Descontinue em vez de excluir/)).toBeInTheDocument();
    // A refused domain rule is not a failure of ours: no support code.
    expect(screen.queryByText('Envie este código para o suporte')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('referenced by');
    expect(document.body.textContent).not.toContain('ENTITY_IN_USE');
  });

  it('writes CONSUMPTION_UNIT_LOCKED differently for each reason', async () => {
    const locked = (reason: string, stockQuantity: number, bomItemReferences: number) => ({
      statusCode: 422,
      code: 'CONSUMPTION_UNIT_LOCKED',
      error: 'ConsumptionUnitLockedError',
      message: 'locked',
      details: { materialId: 'm1', reason, stockQuantity, bomItemReferences },
    });

    probeAnswers(422, locked('STOCK_ON_HAND', 1500, 0));
    const stock = renderProbe();
    const onStock = (await screen.findByText(/Zere o estoque/)).textContent;
    stock.unmount();

    probeAnswers(422, locked('BOM_REFERENCES', 0, 4));
    renderProbe();
    const onRecipes = (await screen.findByText(/4 fichas técnicas usam este insumo/)).textContent;

    expect(onStock).not.toBe(onRecipes);
    expect(screen.queryByText(/Zere o estoque/)).not.toBeInTheDocument();
  });

  it('writes the amounts of a discount that does not close, as money, from details', async () => {
    probeAnswers(422, {
      statusCode: 422,
      code: 'DISCOUNT_ALLOCATION',
      error: 'DiscountAllocationError',
      message: 'Allocated 4.00 does not match discountTotal 6.00.',
      details: { reason: 'SUM_MISMATCH', expected: '6.00', provided: '4.00' },
    });
    renderProbe();

    expect(await screen.findByText(/Distribuído R\$.4,00 de R\$.6,00\./)).toBeInTheDocument();
  });
});

describe('an error code this build has never heard of', () => {
  it.each([
    [422, 'SOME_RULE_ADDED_NEXT_YEAR', /Confira os campos/],
    [404, 'SOMETHING_ELSE_NOT_FOUND', /Não encontramos/],
    [409, 'SOME_NEW_CONFLICT', /conflito/],
  ])('falls back by the status band for a %i', async (status, code, expected) => {
    probeAnswers(status, {
      statusCode: status,
      code,
      error: 'SomeNewError',
      message: 'An English sentence nobody translated.',
    });
    renderProbe();

    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(/English sentence/)).not.toBeInTheDocument();
    expect(screen.queryByText(code)).not.toBeInTheDocument();
  });

  it('survives a detail it cannot read: the generic sentence stands', async () => {
    probeAnswers(422, {
      statusCode: 422,
      code: 'ENTITY_IN_USE',
      error: 'EntityInUseError',
      message: 'in use',
      details: 'not an object',
    });
    renderProbe();

    expect(await screen.findByText(/Descontinue em vez de excluir/)).toBeInTheDocument();
  });
});
