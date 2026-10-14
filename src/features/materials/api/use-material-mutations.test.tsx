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
import { server } from '@/test/msw/server';

import type { MaterialUpdate } from '../model/material-form';

import { materialKeys } from './material-keys';
import {
  useCreateMaterial,
  useDeleteMaterial,
  useDiscontinueMaterial,
  useReactivateMaterial,
  useAdjustStock,
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
    ...(['ENTRY', 'WRITE_OFF', 'RECOUNT'] as const).map(
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
    async function sentBody(kind: 'ENTRY' | 'WRITE_OFF' | 'RECOUNT', quantity: Quantity) {
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

    it('sends a write-off as the same field, negative: the contract has no other for a decrease', async () => {
      expect(await sentBody('WRITE_OFF', kilo('1.5'))).toEqual({
        source: 'MANUAL',
        relativeIncrement: -1500,
      });
      expect(
        await sentBody('WRITE_OFF', Quantity.parse(requireDecimalString('0.145'), 'GRAM')),
      ).toEqual({
        source: 'MANUAL',
        relativeIncrement: -0.145,
      });
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
