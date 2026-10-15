import { QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { QUERY_ROOTS } from '@/shared/api/query-roots';
import { requireDecimalString } from '@/shared/money';
import { Quantity } from '@/shared/quantity';
import { cera } from '@/test/fixtures/materials';
import { ceraQuebrou, lossResult } from '@/test/fixtures/stock-losses';
import { server } from '@/test/msw/server';

import type { MaterialUpdate } from '../model/material-form';

import { materialKeys } from './material-keys';
import {
  useCreateMaterial,
  useDeleteStockLoss,
  useDeleteMaterial,
  useDiscontinueMaterial,
  useReactivateMaterial,
  useAdjustStock,
  useRecordLoss,
  useRemoveMaterialImage,
  useUpdateMaterial,
  useUploadMaterialImage,
} from './use-material-mutations';

const API = env.VITE_API_URL;

const CREATE_BODY = {
  name: 'Cera de soja',
  packageCost: '28.00',
  packageQuantity: 1000,
  consumptionUnit: 'GRAM',
  stockQuantity: 0,
  minimumStockAlert: 300,
} as const;

/**
 * The three things a change to a material makes stale, as keys somebody has
 * read: the materials, the composite products that use them, and the shortage
 * list. They are seeded in the cache by hand, since those features' screens do
 * not exist yet — which is the point: the invalidation must not depend on
 * their code being there.
 */
const SEEDED: Record<string, QueryKey> = {
  materials: materialKeys.list({ includeDiscontinued: false }),
  'material detail': materialKeys.detail('mat-cera'),
  'material summary': materialKeys.summary({ includeDiscontinued: false }),
  'loss list': materialKeys.lossList({ from: 'a', to: 'b', limit: 20, offset: 0 }),
  'loss dataset': materialKeys.lossDataset({ from: 'a', to: 'b' }),
  'composite products': [QUERY_ROOTS.compositeProducts, 'list'],
  shortages: [QUERY_ROOTS.shortages, 'list', { saleIds: ['sale-1'] }],
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  for (const key of Object.values(SEEDED)) {
    client.setQueryData(key, []);
  }

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { client, wrapper };
}

function expectEverythingInvalidated(client: QueryClient, except: string[] = []): void {
  for (const [name, key] of Object.entries(SEEDED)) {
    if (!except.includes(name)) {
      expect(client.getQueryState(key)?.isInvalidated, `${name} should be invalidated`).toBe(true);
    }
  }
}

const jpeg = new File(['jpeg bytes'], 'cera.jpg', { type: 'image/jpeg' });

const UPDATE: MaterialUpdate = { consumptionUnit: null, patch: { name: 'Cera' } };

async function run<TVariables>(
  client: QueryClient,
  useHook: () => { mutateAsync: (variables: TVariables) => Promise<unknown> },
  variables: TVariables,
): Promise<void> {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(useHook, { wrapper });

  await act(() => result.current.mutateAsync(variables));
}

describe('every mutation of a material invalidates the materials, the products and the shortages', () => {
  const cases: [
    string,
    Parameters<typeof server.use>[0],
    (client: QueryClient) => Promise<void>,
  ][] = [
    [
      'creating',
      http.post(`${API}/materials`, () => HttpResponse.json(cera, { status: 201 })),
      (client) => run(client, useCreateMaterial, CREATE_BODY),
    ],
    [
      'editing',
      http.patch(`${API}/materials/mat-cera`, () => HttpResponse.json(cera)),
      (client) => run(client, useUpdateMaterial, { id: 'mat-cera', update: UPDATE }),
    ],
    ...(['ENTRY', 'RECOUNT'] as const).map(
      (kind) =>
        [
          `adjusting the stock (${kind})`,
          http.post(`${API}/materials/mat-cera/stock-entries`, () => HttpResponse.json(cera)),
          (client: QueryClient) =>
            run(client, useAdjustStock, {
              id: 'mat-cera',
              adjustment: { kind, quantity: Quantity.parse(requireDecimalString('500'), 'GRAM') },
            }),
        ] as [string, Parameters<typeof server.use>[0], (client: QueryClient) => Promise<void>],
    ),
    [
      'recording a loss',
      http.post(`${API}/materials/mat-cera/losses`, () =>
        HttpResponse.json(lossResult(), { status: 201 }),
      ),
      (client) =>
        run(client, useRecordLoss, {
          id: 'mat-cera',
          quantity: Quantity.parse(requireDecimalString('80'), 'GRAM'),
          details: { reason: 'BREAKAGE', observation: null },
        }),
    ],
    [
      'discontinuing',
      http.post(`${API}/materials/mat-cera/discontinue`, () => HttpResponse.json(cera)),
      (client) => run(client, useDiscontinueMaterial, 'mat-cera'),
    ],
    [
      'reactivating',
      http.post(`${API}/materials/mat-cera/reactivate`, () => HttpResponse.json(cera)),
      (client) => run(client, useReactivateMaterial, 'mat-cera'),
    ],
    [
      'deleting',
      http.delete(`${API}/materials/mat-cera`, () => new HttpResponse(null, { status: 204 })),
      (client) => run(client, useDeleteMaterial, 'mat-cera'),
    ],
    [
      'uploading a photo',
      http.post(`${API}/materials/mat-cera/image`, () => HttpResponse.json(cera)),
      (client) => run(client, useUploadMaterialImage, { id: 'mat-cera', file: jpeg }),
    ],
    [
      'removing a photo',
      http.delete(`${API}/materials/mat-cera/image`, () => HttpResponse.json(cera)),
      (client) => run(client, useRemoveMaterialImage, 'mat-cera'),
    ],
  ];

  it.each(cases)('after %s', async (_name, handler, execute) => {
    server.use(handler);
    const { client } = setup();

    await execute(client);

    // A deleted material's own detail is dropped instead (next test).
    expectEverythingInvalidated(client, _name === 'deleting' ? ['material detail'] : []);
  });

  it('still invalidates everything after a loss that the API refuses, since the refusal means the screen was out of date', async () => {
    server.use(
      http.post(`${API}/materials/mat-cera/losses`, () =>
        HttpResponse.json(
          { statusCode: 422, code: 'INSUFFICIENT_STOCK', error: 'E', message: 'm' },
          { status: 422 },
        ),
      ),
    );
    const { client } = setup();

    await expect(
      run(client, useRecordLoss, {
        id: 'mat-cera',
        quantity: Quantity.parse(requireDecimalString('999'), 'GRAM'),
        details: { reason: 'LOST', observation: null },
      }),
    ).rejects.toThrow();

    expectEverythingInvalidated(client);
  });

  it('drops the queries of a deleted material instead of fetching a record that is gone', async () => {
    server.use(
      http.delete(`${API}/materials/mat-cera`, () => new HttpResponse(null, { status: 204 })),
    );
    const { client } = setup();

    await run(client, useDeleteMaterial, 'mat-cera');

    expect(client.getQueryState(SEEDED['material detail']!)).toBeUndefined();
  });
});

describe('the requests the mutations send', () => {
  describe('the stock adjustments', () => {
    async function sentBody(
      kind: 'ENTRY' | 'WRITE_OFF' | 'RECOUNT',
      quantity: Quantity,
    ): Promise<unknown> {
      let body: unknown;
      server.use(
        http.post(`${API}/materials/mat-cera/stock-entries`, async ({ request }) => {
          body = await request.json();

          return HttpResponse.json(cera);
        }),
      );
      const { wrapper } = setup();
      const { result } = renderHook(() => useAdjustStock(), { wrapper });

      await act(() =>
        result.current.mutateAsync({ id: 'mat-cera', adjustment: { kind, quantity } }),
      );

      return body;
    }

    const kilo = (text: string) => Quantity.fromMajorUnit(requireDecimalString(text), 'GRAM');

    it('sends an entry as a manual relative increment, in the base unit', async () => {
      expect(await sentBody('ENTRY', kilo('1.5'))).toEqual({
        source: 'MANUAL',
        relativeIncrement: 1500,
      });
    });

    it('refuses to send a write-off as an entry: the API takes no negative increment there', async () => {
      await expect(sentBody('WRITE_OFF', kilo('1.5'))).rejects.toThrow(/buildLossRequest/);
    });

    it('sends a recount as the absolute quantity, and never both fields', async () => {
      const body = await sentBody('RECOUNT', kilo('2'));

      expect(body).toEqual({ source: 'MANUAL', absoluteQuantity: 2000 });
      expect(body).not.toHaveProperty('relativeIncrement');
    });

    it('sends a recount of zero as zero: somebody counted and found nothing', async () => {
      expect(await sentBody('RECOUNT', Quantity.zero('GRAM'))).toEqual({
        source: 'MANUAL',
        absoluteQuantity: 0,
      });
    });
  });

  describe('deleting a loss', () => {
    function runDeletion() {
      const { client, wrapper } = setup();
      const { result } = renderHook(() => useDeleteStockLoss(), { wrapper });

      const outcome = act(() => result.current.mutateAsync('loss-cera-1'));

      return { client, outcome };
    }

    it('sends a DELETE with no body to the route of the loss, and reads what was deleted', async () => {
      let method = '';
      let body = '';
      server.use(
        http.delete(`${API}/materials/losses/loss-cera-1`, async ({ request }) => {
          method = request.method;
          body = await request.text();

          return HttpResponse.json(ceraQuebrou);
        }),
      );

      const { outcome } = runDeletion();
      const deleted = await outcome;

      expect(method).toBe('DELETE');
      expect(body).toBe('');
      // The quantity is read in the unit the API sent with the loss, to say how much to put back.
      expect(deleted?.quantity.toDecimalString()).toBe('100.000');
      expect(deleted?.quantity.unit).toBe('GRAM');
      expect(deleted?.value.toCentsString()).toBe('2.80');
    });

    it('invalidates only the loss history: the stock did not change, so nothing that reads one is stale', async () => {
      server.use(
        http.delete(`${API}/materials/losses/loss-cera-1`, () => HttpResponse.json(ceraQuebrou)),
      );

      const { client, outcome } = runDeletion();
      await outcome;

      // The list and the dataset that the month's total is read from...
      expect(client.getQueryState(SEEDED['loss list']!)?.isInvalidated).toBe(true);
      expect(client.getQueryState(SEEDED['loss dataset']!)?.isInvalidated).toBe(true);
      // ...and nothing else: not the materials, the products or the shortages.
      for (const name of [
        'materials',
        'material detail',
        'material summary',
        'composite products',
        'shortages',
      ]) {
        expect(
          client.getQueryState(SEEDED[name]!)?.isInvalidated,
          `${name} should not be invalidated`,
        ).toBe(false);
      }
    });

    it('invalidates the loss history when the loss is already gone as well, so the list catches up', async () => {
      server.use(
        http.delete(`${API}/materials/losses/loss-cera-1`, () =>
          HttpResponse.json(
            { statusCode: 422, code: 'STOCK_LOSS_NOT_FOUND', error: 'E', message: 'm' },
            { status: 422 },
          ),
        ),
      );

      const { client, outcome } = runDeletion();
      await expect(outcome).rejects.toThrow();

      expect(client.getQueryState(SEEDED['loss list']!)?.isInvalidated).toBe(true);
      expect(client.getQueryState(SEEDED['loss dataset']!)?.isInvalidated).toBe(true);
    });
  });

  describe('the losses', () => {
    async function sentAdjustment<V>(
      useHook: () => { mutateAsync: (v: V) => Promise<unknown> },
      variables: V,
    ) {
      let body: unknown;
      server.use(
        http.post(`${API}/materials/mat-cera/losses`, async ({ request }) => {
          body = await request.json();

          return HttpResponse.json(lossResult({ stockQuantityAfter: 600 }), { status: 201 });
        }),
      );
      const { wrapper } = setup();
      const { result } = renderHook(useHook, { wrapper });

      const answer = await act(() => result.current.mutateAsync(variables));

      return { body, answer };
    }

    it('sends a loss to its own route, with the quantity taken, positive, in the base unit', async () => {
      const { body } = await sentAdjustment(useRecordLoss, {
        id: 'mat-cera',
        quantity: Quantity.fromMajorUnit(requireDecimalString('1.5'), 'GRAM'),
        details: { reason: 'EXPIRED' as const, observation: 'lote antigo' },
      });

      expect(body).toEqual({
        quantity: 1500,
        reason: 'EXPIRED',
        observation: 'lote antigo',
      });
    });

    it('answers with the balance the API reports, as a Quantity in the material’s unit', async () => {
      const { answer } = await sentAdjustment(useRecordLoss, {
        id: 'mat-cera',
        quantity: Quantity.parse(requireDecimalString('80'), 'GRAM'),
        details: { reason: 'LOST' as const, observation: null },
      });

      expect(
        (answer as { stockQuantityAfter: Quantity }).stockQuantityAfter.toDecimalString(),
      ).toBe('600.000');
    });
  });

  it('sends the photo as multipart/form-data in the field "file"', async () => {
    let received: FormDataEntryValue | null = null;
    let contentType: string | null = null;
    server.use(
      http.post(`${API}/materials/mat-cera/image`, async ({ request }) => {
        contentType = request.headers.get('content-type');
        received = (await request.formData()).get('file');

        return HttpResponse.json(cera);
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useUploadMaterialImage(), { wrapper });

    await act(() => result.current.mutateAsync({ id: 'mat-cera', file: jpeg }));

    expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
    // jsdom's File does not keep its name through the multipart encoding, so
    // the part is checked by what survives: it is a file, with its type and bytes.
    expect(typeof received).toBe('object');
    expect((received as unknown as File).type).toBe('image/jpeg');
    expect((received as unknown as File).size).toBe(jpeg.size);
  });

  it('changes the consumption unit first, on its own route, and then the rest', async () => {
    const calls: string[] = [];
    server.use(
      http.patch(`${API}/materials/mat-cera/consumption-unit`, async ({ request }) => {
        calls.push(`unit ${JSON.stringify(await request.json())}`);

        return HttpResponse.json(cera);
      }),
      http.patch(`${API}/materials/mat-cera`, async ({ request }) => {
        calls.push(`patch ${JSON.stringify(await request.json())}`);

        return HttpResponse.json(cera);
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useUpdateMaterial(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        id: 'mat-cera',
        update: {
          consumptionUnit: 'MILLILITER',
          patch: { packageQuantity: 1000, minimumStockAlert: 300 },
        },
      }),
    );

    expect(calls).toEqual([
      'unit {"consumptionUnit":"MILLILITER"}',
      'patch {"packageQuantity":1000,"minimumStockAlert":300}',
    ]);
  });

  it('does not touch the other fields when the API refuses the unit', async () => {
    let patched = false;
    server.use(
      http.patch(`${API}/materials/mat-cera/consumption-unit`, () =>
        HttpResponse.json(
          {
            statusCode: 422,
            code: 'CONSUMPTION_UNIT_LOCKED',
            error: 'ConsumptionUnitLockedError',
            message: 'locked',
          },
          { status: 422 },
        ),
      ),
      http.patch(`${API}/materials/mat-cera`, () => {
        patched = true;

        return HttpResponse.json(cera);
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useUpdateMaterial(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({
          id: 'mat-cera',
          update: { consumptionUnit: 'MILLILITER', patch: { name: 'Outro' } },
        })
        .catch(() => undefined);
    });

    expect(patched).toBe(false);
  });
});
