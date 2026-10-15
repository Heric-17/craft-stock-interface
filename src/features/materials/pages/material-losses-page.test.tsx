import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '@/shared/config/env';
import { NON_BREAKING_SPACE } from '@/shared/format';
import { toIntOr } from '@/shared/lib/to-int';
import { Money, requireDecimalString } from '@/shared/money';
import { cera, essencia, materialDto, materialsHandlers, pavio } from '@/test/fixtures/materials';
import {
  apiErrorBody,
  ceraQuebrou,
  emptyDataset,
  lossDto,
  lossesHandlers,
  monthDataset,
  monthOfLosses,
} from '@/test/fixtures/stock-losses';
import { renderMaterialsPage } from '@/test/render-materials-page';
import { server } from '@/test/msw/server';
import { VERBATIM } from '@/test/text';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';

const API = env.VITE_API_URL;
const SPACE = NON_BREAKING_SPACE;
const dec = requireDecimalString;

const LOSSES = '/insumos/perdas';

beforeEach(() => {
  // The default period is "the last 12 months", which depends on today. Only
  // the date is frozen: timers stay real, so the network still answers.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T15:00:00-03:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

/** The reads the history needs: its losses, its dataset and the materials they name. */
function serve(
  options: Parameters<typeof lossesHandlers>[0] = {},
  materials = [cera, essencia, pavio],
) {
  server.use(...lossesHandlers(options), ...materialsHandlers({ materials }));
}

/** The card appears once the dataset is in; until then there is a skeleton, not a region. */
async function card() {
  return within(await screen.findByRole('region', { name: 'Perdas no período' }));
}

async function openHistory(route = LOSSES) {
  const view = renderMaterialsPage(route);
  await screen.findByRole('heading', { name: 'Perdas de estoque', level: 1 });

  return view;
}

/** The rows of the table, header left out. */
function rows(): HTMLElement[] {
  return screen.getAllByRole('row').slice(1);
}

function rowWith(text: string): HTMLElement {
  const found = rows().find((row) => row.textContent.includes(text));

  if (found === undefined) {
    throw new Error(`No row has "${text}".`);
  }

  return found;
}

describe('the loss history', () => {
  it('shows what was lost, how much, why, what it cost and when', async () => {
    serve();
    await openHistory();

    await screen.findByText('caiu da prateleira');
    const row = within(rowWith('caiu da prateleira'));

    expect(row.getByText('Cera de soja')).toBeInTheDocument();
    expect(row.getByText(`100${SPACE}g`, VERBATIM)).toBeInTheDocument();
    expect(row.getByText('Quebrou')).toBeInTheDocument();
    expect(row.getByText(`R$${SPACE}2,80`, VERBATIM)).toBeInTheDocument();
    expect(row.getByText('12 out, 11:32')).toBeInTheDocument();
  });

  it('reads each quantity in the unit of its own material', async () => {
    serve();
    await openHistory();

    await screen.findByText('caiu da prateleira');

    expect(
      within(rowWith('Essência baunilha')).getByText(`6${SPACE}ml`, VERBATIM),
    ).toBeInTheDocument();
    expect(
      within(rowWith('Pavio encerado')).getByText(`1${SPACE}un`, VERBATIM),
    ).toBeInTheDocument();
  });

  it('reads the quantity of a material that was discontinued after the loss', async () => {
    const discontinued = materialDto({
      id: 'mat-antiga',
      name: 'Fragrância antiga',
      isActive: false,
    });
    serve(
      {
        losses: [
          lossDto({
            id: 'loss-antiga',
            materialId: 'mat-antiga',
            materialName: 'Fragrância antiga',
            quantity: 250,
          }),
        ],
      },
      [cera, discontinued],
    );
    await openHistory();

    expect(
      within(await screen.findByRole('row', { name: /Fragrância antiga/ })).getByText(
        `250${SPACE}g`,
        VERBATIM,
      ),
    ).toBeInTheDocument();
  });

  it('counts the filtered set from `total`, not the rows on screen', async () => {
    serve();
    await openHistory();

    expect(await screen.findByText('22 perdas')).toBeInTheDocument();
    expect(rows()).toHaveLength(20);
    expect(screen.getByText('1–20 de 22')).toBeInTheDocument();
  });

  it('goes to the next page by offset and says where it is', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    serve({ onRequest: (url) => requests.push(url) });
    await openHistory();
    await screen.findByText('22 perdas');

    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.getByText('21–22 de 22')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
    expect(
      requests
        .filter((url) => url.pathname.endsWith('/losses'))
        .at(-1)
        ?.searchParams.get('offset'),
    ).toBe('20');

    await user.click(screen.getByRole('button', { name: 'Anterior' }));

    await waitFor(() => expect(rows()).toHaveLength(20));
    expect(screen.getByText('1–20 de 22')).toBeInTheDocument();
  });

  it('asks the API for the default page size, never for more than it allows', async () => {
    const requests: URL[] = [];
    serve({ onRequest: (url) => requests.push(url) });
    await openHistory();
    await screen.findByText('22 perdas');

    const limit = toIntOr(
      requests.find((url) => url.pathname.endsWith('/losses'))?.searchParams.get('limit'),
      0,
    );

    expect(limit).toBeGreaterThan(0);
    expect(limit).toBeLessThanOrEqual(100);
  });

  it('shows a skeleton while it loads', () => {
    serve();
    renderMaterialsPage(LOSSES);

    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('says what to do when there is nothing yet', async () => {
    serve({ losses: [], dataset: emptyDataset });
    await openHistory();

    expect(await screen.findByText('Nenhuma perda neste período')).toBeInTheDocument();
  });

  it('shows the support code of an unexpected failure, and tries again on request', async () => {
    const user = userEvent.setup();
    let failing = true;
    server.use(
      http.get(`${API}/materials/losses`, () =>
        failing
          ? HttpResponse.json(
              apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-losses-1' }),
              { status: 500 },
            )
          : HttpResponse.json({ items: [ceraQuebrou], total: 1, limit: 20, offset: 0 }),
      ),
      http.get(`${API}/materials/losses/dataset`, () => HttpResponse.json(monthDataset)),
      ...materialsHandlers({ materials: [cera] }),
    );
    await openHistory();

    expect(await screen.findByText('Não foi possível carregar as perdas')).toBeInTheDocument();
    expect(screen.getByText('err-losses-1')).toBeInTheDocument();
    expect(screen.queryByText('INTERNAL_ERROR')).not.toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('caiu da prateleira')).toBeInTheDocument();
  });
});

describe('the value of a loss', () => {
  it('is the figure the API derived from the cost it froze, not a product made on this side', async () => {
    // 100 g at R$ 28,00 the kilo would be R$ 2,80 here. The API froze a different
    // cost when the loss was recorded (R$ 20,00 the kilo) and says R$ 2,00.
    const frozen = lossDto({
      id: 'loss-frozen',
      quantity: 100,
      value: dec('2.00'),
      costBasisAmount: dec('20.00'),
      costBasisQuantity: 1000,
      observation: 'custo congelado',
    });
    serve({ losses: [frozen] });
    await openHistory();

    const row = within(await screen.findByRole('row', { name: /custo congelado/ }));

    expect(row.getByText(`R$${SPACE}2,00`, VERBATIM)).toBeInTheDocument();
    expect(screen.queryByText(`R$${SPACE}2,80`, VERBATIM)).not.toBeInTheDocument();
  });

  it('is shown as the API spells it even when it is no product of the quantity and the price at all', async () => {
    // Nothing on this screen could arrive at 37,00 from 1 g and a basis of 40,00.
    const odd = lossDto({
      id: 'loss-odd',
      quantity: 1,
      value: dec('37.00'),
      costBasisAmount: dec('40.00'),
      costBasisQuantity: 1,
      observation: 'valor da API',
    });
    serve({ losses: [odd] });
    await openHistory();

    const row = within(await screen.findByRole('row', { name: /valor da API/ }));

    expect(row.getByText(`R$${SPACE}37,00`, VERBATIM)).toBeInTheDocument();
    expect(screen.queryByText(`R$${SPACE}40,00`, VERBATIM)).not.toBeInTheDocument();
  });

  it('does not move when the price of the material changes afterwards', async () => {
    // The material costs R$ 90,00 the kilo today; the loss keeps what it was worth.
    const dearer = materialDto({ packageCost: dec('90.00') });
    serve({ losses: [ceraQuebrou] }, [dearer]);
    await openHistory();

    const row = within(await screen.findByRole('row', { name: /caiu da prateleira/ }));

    expect(row.getByText(`R$${SPACE}2,80`, VERBATIM)).toBeInTheDocument();
    expect(screen.queryByText(`R$${SPACE}9,00`, VERBATIM)).not.toBeInTheDocument();
  });
});

describe('the "Perdas no período" card', () => {
  it('shows the dataset’s total and not the sum of the page of the list', async () => {
    serve();
    await openHistory();
    await screen.findByText('22 perdas');

    // The 20 rows of the first page add up to R$ 13,64, and what was lost in the
    // month, as the API closed it, is R$ 14,06.
    expect(await (await card()).findByText(`R$${SPACE}14,06`, VERBATIM)).toBeInTheDocument();
    expect((await card()).getByText('22 perdas')).toBeInTheDocument();
    expect((await card()).queryByText(`R${SPACE}13,64`, VERBATIM)).not.toBeInTheDocument();
  });

  it('closes with the list: the two pages together are the same R$ 14,06', async () => {
    const user = userEvent.setup();
    serve();
    await openHistory();
    await screen.findByText('22 perdas');

    const sumOfRows = () =>
      Money.sum(
        rows().map((row) => {
          const cell = within(row).getAllByText(/^R\$/).at(-1)!.textContent;

          return Money.parse(requireDecimalString(cell.replace(/[^\d,]/g, '').replace(',', '.')));
        }),
      );

    const first = sumOfRows();
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    const second = sumOfRows();

    expect(first.toCentsString()).toBe('13.64');
    expect(first.plus(second).toCentsString()).toBe('14.06');
    expect(await (await card()).findByText(`R$${SPACE}14,06`, VERBATIM)).toBeInTheDocument();
  });

  it('keeps two reasons and two materials of the same month apart, from the dataset’s own cells', async () => {
    serve();
    await openHistory();

    const reasons = within(
      await (await card()).findByText('Por motivo').then((title) => title.parentElement!),
    );

    expect(reasons.getByText(/Venceu/).closest('li')?.textContent).toContain(`R$${SPACE}6,08`);
    expect(reasons.getByText(/Quebrou/).closest('li')?.textContent).toContain(`R$${SPACE}4,20`);
    expect(reasons.getByText(/Perdido/).closest('li')?.textContent).toContain(`R$${SPACE}3,78`);
    // A reason nobody lost anything for is not on the list.
    expect(reasons.queryByText(/Estragou/)).not.toBeInTheDocument();
    expect(reasons.queryByText(/Outro/)).not.toBeInTheDocument();

    const biggest = within((await card()).getByText('Maior perda').parentElement!);
    expect(biggest.getByText('Essência baunilha')).toBeInTheDocument();
    expect(biggest.getByText(`R$${SPACE}6,08`, VERBATIM)).toBeInTheDocument();
  });

  it('adds the months of the dataset when the period has more than one', async () => {
    serve({
      losses: [ceraQuebrou],
      dataset: {
        ...monthDataset,
        byMonth: [
          { month: '2026-09', lossCount: 3, lossValue: dec('5.00') },
          { month: '2026-10', lossCount: 2, lossValue: dec('7.50') },
        ],
      },
    });
    await openHistory();

    // Five losses and R$ 12,50, from two cells of the dataset; the list has one row.
    expect(await (await card()).findByText(`R$${SPACE}12,50`, VERBATIM)).toBeInTheDocument();
    expect((await card()).getByText('5 perdas')).toBeInTheDocument();
    expect(rows()).toHaveLength(1);
  });

  it('answers for the whole period whatever the list is filtered by, and says so', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    serve({ onRequest: (url) => requests.push(url) });
    await openHistory();
    await (await card()).findByText(`R$${SPACE}14,06`, VERBATIM);

    await user.selectOptions(screen.getByLabelText('Insumo'), 'mat-cera');

    // The list is the two losses of cera...
    await waitFor(() => expect(screen.getByText('2 perdas')).toBeInTheDocument());
    // ...and the card is still the month: it asks the dataset, which has no filter but the period.
    expect((await card()).getByText(`R$${SPACE}14,06`, VERBATIM)).toBeInTheDocument();
    expect((await card()).getByText(/sem os filtros da lista/)).toBeInTheDocument();
    const dataset = requests.filter((url) => url.pathname.endsWith('/losses/dataset'));
    expect(dataset.length).toBeGreaterThan(0);
    for (const url of dataset) {
      expect([...url.searchParams.keys()].sort()).toEqual(['from', 'to']);
    }
  });

  it('says zero when nothing was lost: it is a result, not a missing figure', async () => {
    serve({ losses: [], dataset: emptyDataset });
    await openHistory();

    expect(await (await card()).findByText(`R$${SPACE}0,00`, VERBATIM)).toBeInTheDocument();
    expect((await card()).getByText('Nenhuma perda neste período.')).toBeInTheDocument();
    expect((await card()).queryByText('Por motivo')).not.toBeInTheDocument();
  });

  it('fails on its own: the list still works if the dataset does not', async () => {
    server.use(
      http.get(`${API}/materials/losses/dataset`, () =>
        HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-ds' }), {
          status: 500,
        }),
      ),
      http.get(`${API}/materials/losses`, () =>
        HttpResponse.json({ items: [ceraQuebrou], total: 1, limit: 20, offset: 0 }),
      ),
      ...materialsHandlers({ materials: [cera] }),
    );
    await openHistory();

    expect(
      await screen.findByText('Não foi possível carregar as perdas do período'),
    ).toBeInTheDocument();
    expect(screen.getByText('err-ds')).toBeInTheDocument();
    expect(await screen.findByText('caiu da prateleira')).toBeInTheDocument();
  });
});

describe('the period', () => {
  function lossRequests(requests: URL[]) {
    return requests.filter((url) => url.pathname.endsWith('/losses'));
  }

  function datasetRequests(requests: URL[]) {
    return requests.filter((url) => url.pathname.endsWith('/losses/dataset'));
  }

  it('is the last 12 months to begin with, cut in the calendar of São Paulo, to exclusive', async () => {
    const requests: URL[] = [];
    serve({ onRequest: (url) => requests.push(url) });
    await openHistory();
    await screen.findByText('22 perdas');

    const expected = ['2025-11-01T00:00:00-03:00', '2026-11-01T00:00:00-03:00'];

    for (const url of [lossRequests(requests)[0]!, datasetRequests(requests)[0]!]) {
      expect([url.searchParams.get('from'), url.searchParams.get('to')]).toEqual(expected);
    }
    expect(screen.getByLabelText('Período')).toHaveValue('LAST_12_MONTHS');
  });

  it('moves the list and the card together when another one is chosen', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    serve({ onRequest: (url) => requests.push(url) });
    await openHistory();
    await screen.findByText('22 perdas');

    await user.selectOptions(screen.getByLabelText('Período'), 'THIS_MONTH');

    await waitFor(() =>
      expect(lossRequests(requests).at(-1)?.searchParams.get('from')).toBe(
        '2026-10-01T00:00:00-03:00',
      ),
    );
    expect(lossRequests(requests).at(-1)?.searchParams.get('to')).toBe('2026-11-01T00:00:00-03:00');
    await waitFor(() =>
      expect(datasetRequests(requests).at(-1)?.searchParams.get('from')).toBe(
        '2026-10-01T00:00:00-03:00',
      ),
    );
  });

  it('takes two days typed in as both included: the end goes to the start of the next day', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    serve({ onRequest: (url) => requests.push(url) });
    await openHistory();
    await screen.findByText('22 perdas');

    await user.selectOptions(screen.getByLabelText('Período'), 'CUSTOM');
    await user.type(screen.getByLabelText('De'), '2026-10-01');
    await user.type(screen.getByLabelText('Até'), '2026-10-31');

    await waitFor(() =>
      expect(lossRequests(requests).at(-1)?.searchParams.get('to')).toBe(
        '2026-11-01T00:00:00-03:00',
      ),
    );
    expect(lossRequests(requests).at(-1)?.searchParams.get('from')).toBe(
      '2026-10-01T00:00:00-03:00',
    );
  });

  it('waits for the second day instead of asking the API with half a period', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    serve({ onRequest: (url) => requests.push(url) });
    await openHistory();
    await screen.findByText('22 perdas');
    const before = requests.length;

    await user.selectOptions(screen.getByLabelText('Período'), 'CUSTOM');
    await user.type(screen.getByLabelText('De'), '2026-10-01');

    expect(
      screen.getByText('Escolha o primeiro e o último dia do período para ver as perdas.'),
    ).toBeInTheDocument();
    expect(requests).toHaveLength(before);
  });

  it('says so when the period ends before it starts, and asks nothing', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    serve({ onRequest: (url) => requests.push(url) });
    await openHistory();
    await screen.findByText('22 perdas');
    const before = requests.length;

    await user.selectOptions(screen.getByLabelText('Período'), 'CUSTOM');
    await user.type(screen.getByLabelText('De'), '2026-10-31');
    await user.type(screen.getByLabelText('Até'), '2026-10-01');

    expect(
      (await screen.findAllByText('A data final vem antes da inicial.')).length,
    ).toBeGreaterThan(0);
    expect(requests).toHaveLength(before);
  });
});

describe('the filters', () => {
  it('narrows the list by material, in the address, and starts again from the first page', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    serve({ onRequest: (url) => requests.push(url) });
    const { router } = await openHistory();
    await screen.findByText('22 perdas');
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(rows()).toHaveLength(2));

    await user.selectOptions(screen.getByLabelText('Insumo'), 'mat-pavio');

    await waitFor(() => expect(screen.getByText('18 perdas')).toBeInTheDocument());
    expect(router.state.location.search).toBe('?materialId=mat-pavio');
    const last = requests.filter((url) => url.pathname.endsWith('/losses')).at(-1);
    expect(last?.searchParams.get('materialId')).toBe('mat-pavio');
    expect(last?.searchParams.get('offset')).toBe('0');
  });

  it('narrows it by reason', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    serve({ onRequest: (url) => requests.push(url) });
    await openHistory();
    await screen.findByText('22 perdas');

    await user.selectOptions(screen.getByLabelText('Motivo'), 'EXPIRED');

    await waitFor(() => expect(screen.getByText('2 perdas')).toBeInTheDocument());
    expect(
      requests
        .filter((url) => url.pathname.endsWith('/losses'))
        .at(-1)
        ?.searchParams.get('reason'),
    ).toBe('EXPIRED');
    expect(rows().every((row) => row.textContent.includes('Venceu'))).toBe(true);
  });

  it('opens already filtered by the material in the address', async () => {
    serve();
    await openHistory(`${LOSSES}?materialId=mat-essencia`);

    expect(await screen.findByText('2 perdas')).toBeInTheDocument();
    expect(screen.getByLabelText('Insumo')).toHaveValue('mat-essencia');
    expect(rows().every((row) => row.textContent.includes('Essência baunilha'))).toBe(true);
  });

  it('offers every material, discontinued ones included, and the five reasons', async () => {
    const discontinued = materialDto({
      id: 'mat-antiga',
      name: 'Fragrância antiga',
      isActive: false,
    });
    serve({}, [cera, discontinued]);
    await openHistory();

    const materials = await screen.findByLabelText('Insumo');
    await waitFor(() =>
      expect(
        within(materials)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Todos os insumos', 'Cera de soja', 'Fragrância antiga']),
    );
    expect(
      within(screen.getByLabelText('Motivo'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Todos os motivos', 'Quebrou', 'Venceu', 'Estragou', 'Perdido', 'Outro']);
  });

  it('says nothing matched, and clears the filters on request', async () => {
    const user = userEvent.setup();
    serve({ losses: [ceraQuebrou] });
    await openHistory();
    await screen.findByText('caiu da prateleira');

    await user.selectOptions(screen.getByLabelText('Motivo'), 'OTHER');

    expect(await screen.findByText('Nenhuma perda encontrada')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    expect(await screen.findByText('caiu da prateleira')).toBeInTheDocument();
    expect(screen.getByLabelText('Motivo')).toHaveValue('');
  });
});

describe('deleting a loss', () => {
  /**
   * The month after the first loss of cera is deleted, worked out by hand from
   * the one before it (R$ 14,06 in 22 losses): R$ 2,80 less and one loss less,
   * with the dataset's own order of materials by value.
   */
  const datasetAfterDeletingCera = {
    ...monthDataset,
    byMonth: [
      { month: '2026-09', lossCount: 0, lossValue: dec('0.00') },
      { month: '2026-10', lossCount: 21, lossValue: dec('11.26') },
    ],
    byReason: [
      { reason: 'BREAKAGE', lossCount: 1, lossValue: dec('1.40') },
      { reason: 'EXPIRED', lossCount: 2, lossValue: dec('6.08') },
      { reason: 'SPOILAGE', lossCount: 0, lossValue: dec('0.00') },
      { reason: 'LOST', lossCount: 18, lossValue: dec('3.78') },
      { reason: 'OTHER', lossCount: 0, lossValue: dec('0.00') },
    ],
    byMaterial: [
      {
        materialId: 'mat-essencia',
        materialName: 'Essência baunilha',
        lossCount: 2,
        lossValue: dec('6.08'),
      },
      {
        materialId: 'mat-pavio',
        materialName: 'Pavio encerado',
        lossCount: 18,
        lossValue: dec('3.78'),
      },
      {
        materialId: 'mat-cera',
        materialName: 'Cera de soja',
        lossCount: 1,
        lossValue: dec('1.40'),
      },
    ],
  };

  /** The API's state, which a deletion changes and the next read shows. */
  function serveDeletable(
    options: { losses?: typeof monthOfLosses; onRequest?: (url: URL) => void } = {},
  ) {
    const losses = [...(options.losses ?? monthOfLosses)];
    let dataset: typeof monthDataset = monthDataset;
    const deleted: string[] = [];
    const watch = options.onRequest === undefined ? {} : { onRequest: options.onRequest };

    server.use(
      http.delete(`${API}/materials/losses/:lossId`, ({ params }) => {
        const index = losses.findIndex((loss) => loss.id === params.lossId);

        if (index === -1) {
          return HttpResponse.json(apiErrorBody(422, 'STOCK_LOSS_NOT_FOUND'), { status: 422 });
        }

        deleted.push(String(params.lossId));
        const [removed] = losses.splice(index, 1);
        dataset = datasetAfterDeletingCera;

        return HttpResponse.json(removed);
      }),
      ...lossesHandlers({ losses, dataset: () => dataset, ...watch }),
      ...materialsHandlers({ materials: [cera, essencia, pavio], ...watch }),
    );

    return { losses, deleted };
  }

  async function askToDelete(
    user: ReturnType<typeof userEvent.setup>,
    note = 'caiu da prateleira',
  ) {
    await screen.findByText(note);
    await user.click(
      within(rowWith(note)).getByRole('button', { name: 'Excluir perda de Cera de soja' }),
    );

    return screen.findByRole('alertdialog', { name: 'Excluir a perda de Cera de soja?' });
  }

  it('gives every loss the action, and no seal and no undo anywhere', async () => {
    serveDeletable();
    await openHistory();
    await screen.findByText('22 perdas');

    expect(screen.getAllByRole('button', { name: /^Excluir perda de/ })).toHaveLength(20);
    expect(screen.queryByText('Revertida')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reverter|Desfazer/ })).not.toBeInTheDocument();
  });

  it('asks first, and says before anything that the stock will not change', async () => {
    const user = userEvent.setup();
    const { deleted } = serveDeletable();
    await openHistory();

    const dialog = await askToDelete(user);

    expect(
      within(dialog).getByText(new RegExp(`100${SPACE}g de Cera de soja`), VERBATIM),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('O estoque não será alterado.')).toBeInTheDocument();
    expect(within(dialog).getByText(/continua fora até você repor/)).toBeInTheDocument();
    expect(within(dialog).getByText(/use “Corrigir contagem” no insumo/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Não dá para restaurar a perda/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(deleted).toEqual([]);
  });

  it('removes it from the list and takes its value off the month, read again from the dataset', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    const { deleted } = serveDeletable({ onRequest: (url) => requests.push(url) });
    await openHistory();
    await screen.findByText('22 perdas');
    expect(await (await card()).findByText(`R$${SPACE}14,06`, VERBATIM)).toBeInTheDocument();
    const datasetReads = () =>
      requests.filter((url) => url.pathname.endsWith('/losses/dataset')).length;
    const before = datasetReads();

    const dialog = await askToDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Excluir perda' }));

    expect(await screen.findByText(/Perda excluída/)).toBeInTheDocument();
    expect(deleted).toEqual(['loss-cera-1']);
    // Gone from the list...
    await waitFor(() => expect(screen.queryByText('caiu da prateleira')).not.toBeInTheDocument());
    // The count of the list and the one of the card, both one less.
    expect(screen.getAllByText('21 perdas')).toHaveLength(2);
    // ...and R$ 2,80 off the month: the dataset was read again, nothing was subtracted here.
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Perdas no período' }).textContent).toContain(
        `R$${SPACE}11,26`,
      ),
    );
    expect(datasetReads()).toBeGreaterThan(before);
    expect((await card()).getByText('21 perdas')).toBeInTheDocument();
  });

  it('says the stock was not changed, and how much to put back, in the unit of the material', async () => {
    const user = userEvent.setup();
    serveDeletable();
    await openHistory();

    const dialog = await askToDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Excluir perda' }));

    expect(
      await screen.findByText(
        `Perda excluída. O estoque não foi alterado: adicione de volta 100${SPACE}g de Cera de soja.`,
        VERBATIM,
      ),
    ).toBeInTheDocument();
  });

  it('leaves the stock alone: no material is read again', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    serveDeletable({ onRequest: (url) => requests.push(url) });
    await openHistory();
    await screen.findByText('22 perdas');
    const materialReads = () =>
      requests.filter(
        (url) => url.pathname.includes('/materials') && !url.pathname.includes('/losses'),
      ).length;
    const before = materialReads();

    const dialog = await askToDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Excluir perda' }));
    await screen.findByText(/Perda excluída/);
    await waitFor(() => expect(screen.getAllByText('21 perdas').length).toBeGreaterThan(0));

    expect(materialReads()).toBe(before);
  });

  it('offers to count the stock back from the notice, with the stock exactly as it was', async () => {
    const user = userEvent.setup();
    serveDeletable();
    await openHistory();

    const dialog = await askToDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Excluir perda' }));
    await user.click(await screen.findByRole('button', { name: 'Corrigir contagem' }));

    const panel = await screen.findByRole('dialog', { name: 'Ajustar estoque' });
    expect(within(panel).getByRole('radio', { name: 'Corrigir contagem' })).toBeChecked();
    expect(within(panel).getByText('Cera de soja')).toBeInTheDocument();
    // The deletion did not touch it: it is still 680 g.
    expect(within(panel).getByText(`680${SPACE}g`, VERBATIM)).toBeInTheDocument();
  });

  it('is not a failure when the loss is already gone: it says so, and the list catches up', async () => {
    const user = userEvent.setup();
    const { losses } = serveDeletable();
    await openHistory();
    await screen.findByText('22 perdas');

    // Another tab deletes it first.
    server.use(
      http.delete(`${API}/materials/losses/loss-cera-1`, () => {
        losses.splice(
          losses.findIndex((loss) => loss.id === 'loss-cera-1'),
          1,
        );

        return HttpResponse.json(apiErrorBody(422, 'STOCK_LOSS_NOT_FOUND'), { status: 422 });
      }),
    );
    const dialog = await askToDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Excluir perda' }));

    expect(await screen.findByText(/Esta perda já não existe/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('caiu da prateleira')).not.toBeInTheDocument());
    expect(screen.getByText('21 perdas')).toBeInTheDocument();
    // No system error: no support code, no code, no generic sentence.
    expect(screen.queryByText(/Envie este código/)).not.toBeInTheDocument();
    expect(screen.queryByText(/STOCK_LOSS_NOT_FOUND/)).not.toBeInTheDocument();
    expect(screen.queryByText('Algo deu errado. Tente novamente.')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('holds every action while a deletion is on its way, so a double click cannot send two', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let sent = 0;
    serveDeletable();
    server.use(
      http.delete(`${API}/materials/losses/loss-cera-1`, async () => {
        sent += 1;
        await gate;

        return HttpResponse.json(ceraQuebrou);
      }),
    );
    await openHistory();

    const dialog = await askToDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Excluir perda' }));

    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Aguarde…' })).toBeDisabled(),
    );
    // The dialog is modal and hides the page from the accessibility tree, so the
    // buttons behind it are looked up as hidden ones.
    for (const button of screen.getAllByRole('button', {
      name: /^Excluir perda de/,
      hidden: true,
    })) {
      expect(button).toBeDisabled();
    }
    release();
    await screen.findByText(/Perda excluída/);
    expect(sent).toBe(1);
  });

  it('goes back to the last page that has rows when it deletes the only loss of the last one', async () => {
    const user = userEvent.setup();
    // 21 losses: the second page holds exactly one, the last wick.
    const losses = monthOfLosses.slice(0, 21);
    server.use(
      http.delete(`${API}/materials/losses/:lossId`, ({ params }) => {
        const index = losses.findIndex((loss) => loss.id === params.lossId);
        const [removed] = losses.splice(index, 1);

        return HttpResponse.json(removed);
      }),
      ...lossesHandlers({ losses }),
      ...materialsHandlers({ materials: [cera, essencia, pavio] }),
    );
    await openHistory();
    await screen.findByText('21 perdas');
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(rows()).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: /^Excluir perda de Pavio encerado/ }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir perda' }),
    );

    await waitFor(() => expect(screen.getByText('1–20 de 20')).toBeInTheDocument());
    expect(rows()).toHaveLength(20);
  });

  it('keeps the action within reach on a phone', async () => {
    setViewportWidth(PHONE_WIDTH);
    serveDeletable();
    await openHistory();
    await screen.findByText('caiu da prateleira');

    const cardOfLoss = within(
      within(screen.getByRole('list', { name: 'Perdas de estoque' }))
        .getAllByRole('listitem')
        .find((item) => item.textContent.includes('caiu da prateleira'))!,
    );

    expect(
      cardOfLoss.getByRole('button', { name: 'Excluir perda de Cera de soja' }),
    ).toBeInTheDocument();
  });
});

describe('getting to the history', () => {
  it('has a link beside the stock actions on the materials screen', async () => {
    serve();
    renderMaterialsPage('/insumos');

    expect(await screen.findByRole('link', { name: 'Perdas' })).toHaveAttribute(
      'href',
      '/insumos/perdas',
    );
  });

  it('opens already filtered by the material from its detail', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    serve({ onRequest: (url) => requests.push(url) });
    const { router } = renderMaterialsPage('/insumos?insumo=mat-cera');

    const detail = await screen.findByRole('dialog');
    const link = await within(detail).findByRole('link', { name: 'Ver perdas deste insumo' });

    expect(link).toHaveAttribute('href', '/insumos/perdas?materialId=mat-cera');

    await user.click(link);

    expect(
      await screen.findByRole('heading', { name: 'Perdas de estoque', level: 1 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(LOSSES);
    expect(await screen.findByText('2 perdas')).toBeInTheDocument();
    expect(screen.getByLabelText('Insumo')).toHaveValue('mat-cera');
    expect(
      requests
        .filter((url) => url.pathname.endsWith('/losses'))
        .at(-1)
        ?.searchParams.get('materialId'),
    ).toBe('mat-cera');
  });

  it('comes back to the materials from the history', async () => {
    const user = userEvent.setup();
    serve();
    const { router } = await openHistory();

    await user.click(screen.getByRole('link', { name: 'Voltar para insumos' }));

    expect(await screen.findByRole('heading', { name: 'Insumos', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/insumos');
  });
});

describe('the history on a phone', () => {
  beforeEach(() => setViewportWidth(PHONE_WIDTH));

  it('is a list of cards, with the card of the period and the filters still within reach', async () => {
    serve();
    await openHistory();
    await screen.findByText('caiu da prateleira');

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Perdas de estoque' });
    const first = within(within(list).getAllByRole('listitem')[0]!);

    expect(first.getByText('Valor')).toBeInTheDocument();
    expect(screen.getByLabelText('Período')).toBeInTheDocument();
    expect(screen.getByLabelText('Insumo')).toBeInTheDocument();
    expect(screen.getByLabelText('Motivo')).toBeInTheDocument();
    expect(await (await card()).findByText(`R$${SPACE}14,06`, VERBATIM)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeInTheDocument();
    // There is no way to undo a loss.
    expect(screen.queryByRole('button', { name: /Reverter|Desfazer/ })).not.toBeInTheDocument();
  });
});
