import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import {
  monthOfLosses,
  lossesHandlers,
  essenciaVenceu,
  lossDto,
} from '@/test/fixtures/stock-losses';
import { server } from '@/test/msw/server';

import { useStockLosses } from './use-materials';

const FILTERS = {
  from: '2025-11-01T00:00:00-03:00',
  to: '2026-11-01T00:00:00-03:00',
  limit: 20,
  offset: 0,
};

function renderLosses() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return renderHook(() => useStockLosses(FILTERS), { wrapper });
}

describe('the loss list', () => {
  it('reads each quantity in the unit its loss came with, without asking for the materials', async () => {
    const paths: string[] = [];
    // No handler for `GET /materials`: the suite fails on an unhandled request,
    // and this list is also watched for any attempt to make one.
    server.use(...lossesHandlers({ losses: monthOfLosses }));
    server.events.on('request:start', ({ request }) => paths.push(new URL(request.url).pathname));

    const { result } = renderLosses();

    await waitFor(() => expect(result.current.data).toBeDefined());
    server.events.removeAllListeners();

    expect(paths.filter((path) => !path.startsWith('/materials/losses'))).toEqual([]);
    expect(paths).not.toContain('/materials');
    expect(result.current.data?.items[1]?.quantity.unit).toBe('MILLILITER');
  });

  it('reads a unit that is not grams as the API says it, even when the loss is the only row', async () => {
    server.use(
      ...lossesHandlers({
        losses: [lossDto({ ...essenciaVenceu, consumptionUnit: 'CENTIMETER' })],
      }),
    );

    const { result } = renderLosses();

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.items[0]?.quantity.unit).toBe('CENTIMETER');
  });
});
