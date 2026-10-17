import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { env } from '@/shared/config/env';
import { NON_BREAKING_SPACE } from '@/shared/format';
import { requireDecimalString } from '@/shared/money';
import { compositeProductsHandlers } from '@/test/fixtures/composite-products';
import { cera, essencia, materialsHandlers, pavio } from '@/test/fixtures/materials';
import {
  saleDto,
  salesHandlers,
  snapshotVela,
  vendaAna,
  vendaJoao,
  vendaMarina,
} from '@/test/fixtures/sales';
import {
  apiErrorBody,
  fitaSemEmbalagem,
  listaComLinhaSemEstimativa,
  listaCompleta,
  shortagesHandlers,
  type ShoppingListDto,
} from '@/test/fixtures/shortages';
import { server } from '@/test/msw/server';
import { renderShortages } from '@/test/render-shortages';
import { VERBATIM } from '@/test/text';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';

const API = env.VITE_API_URL;
const SPACE = NON_BREAKING_SPACE;
const dec = requireDecimalString;

/** A second order with production pending, so choosing among sales means something. */
const vendaCarlos = saleDto({
  id: 'dddd4444-0000-4000-8000-000000000004',
  customerName: 'Carlos Dias',
  items: [snapshotVela({ id: 'item-vela-carlos', quantity: 4 })],
  createdAt: '2026-10-13T09:05:00.000Z',
});

/** The ids of the two sales whose production is pending, in the order the API sorts them. */
const PENDING_IDS = [vendaMarina.id, vendaCarlos.id];

interface Setup {
  sales?: ReturnType<typeof saleDto>[];
  materials?: (typeof cera)[];
  list?: (saleIds: string[]) => ShoppingListDto;
}

/** The API for the screen: the sales, the materials and the shopping list, each as MSW answers it. */
function serve({ sales, materials, list }: Setup = {}) {
  const asked: string[][] = [];

  server.use(
    ...salesHandlers({ sales: sales ?? [vendaMarina, vendaCarlos, vendaJoao, vendaAna] }),
    ...materialsHandlers({ materials: materials ?? [cera, essencia, pavio, fitaSemEmbalagem] }),
    ...compositeProductsHandlers(),
    ...shortagesHandlers({
      ...(list === undefined ? {} : { list }),
      onRequest: (body) => asked.push(body.saleIds),
    }),
  );

  return { asked };
}

/** The row (table) or card (phone) of a material, found by the tick that carries its name. */
function rowOf(name: string): HTMLElement {
  const tick = screen.getByRole('checkbox', { name });

  return tick.closest('tr') ?? tick.closest('li') ?? tick;
}

async function waitForTable() {
  await screen.findByRole('table', { name: 'Necessidade de insumos' });
  // The size of a package comes from the material list, which loads on its own.
  await screen.findByText(`2 embalagens de 1${SPACE}kg`, VERBATIM);
}

describe('the need of the open sales', () => {
  it('shows, per material, what is needed, what is in stock and what is missing, with units', async () => {
    serve();
    renderShortages();
    await waitForTable();

    const row = within(rowOf('Cera de soja'));

    expect(row.getByText(`2,44${SPACE}kg`, VERBATIM)).toBeInTheDocument();
    expect(row.getByText(`680${SPACE}g`, VERBATIM)).toBeInTheDocument();
    expect(row.getByText(`1,76${SPACE}kg`, VERBATIM)).toBeInTheDocument();
    expect(row.getByText('Comprar')).toBeInTheDocument();

    const essenciaRow = within(rowOf('Essência baunilha'));

    expect(essenciaRow.getByText(`32${SPACE}ml`, VERBATIM)).toBeInTheDocument();
    expect(essenciaRow.getByText(`18${SPACE}ml`, VERBATIM)).toBeInTheDocument();
    expect(essenciaRow.getByText(`14${SPACE}ml`, VERBATIM)).toBeInTheDocument();
  });

  it('says how many closed packages to buy, of what size, on every line that is missing', async () => {
    serve();
    renderShortages();
    await waitForTable();

    expect(
      within(rowOf('Cera de soja')).getByText(`2 embalagens de 1${SPACE}kg`, VERBATIM),
    ).toBeInTheDocument();
    expect(
      within(rowOf('Essência baunilha')).getByText(`1 embalagem de 100${SPACE}ml`, VERBATIM),
    ).toBeInTheDocument();
  });

  it('marks a material the stock covers as enough, with nothing to buy and nothing to tick', async () => {
    serve();
    renderShortages();
    await waitForTable();

    const row = within(rowOf('Pavio encerado'));

    expect(row.getByText('Suficiente')).toBeInTheDocument();
    // Nothing to buy and nothing to pay: both cells say so, in words a screen reader reads.
    expect(row.getAllByText('Nada a comprar')).toHaveLength(2);
    expect(screen.getByRole('checkbox', { name: 'Pavio encerado' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Pavio encerado' })).not.toBeChecked();
  });

  it('shows the figures the API sent, whatever they would add up to here', async () => {
    serve({
      list: () => ({
        lines: [{ ...listaCompleta.lines[2]!, estimatedCost: dec('77.77') }],
        estimatedTotal: dec('88.88'),
        unestimatedLineCount: 0,
      }),
    });
    renderShortages();
    await waitForTable();

    expect(screen.getByText(`R$${SPACE}77,77`, VERBATIM)).toBeInTheDocument();
    expect(screen.getByText(`R$${SPACE}88,88`, VERBATIM)).toBeInTheDocument();
  });

  it('shows the photo of the material, from the material list', async () => {
    serve({
      materials: [{ ...cera, imageUrl: 'https://imagens.teste/cera.jpg' }, essencia, pavio],
    });
    renderShortages();
    await waitForTable();

    await waitFor(() =>
      expect(within(rowOf('Cera de soja')).getByAltText('Cera de soja')).toHaveAttribute(
        'src',
        'https://imagens.teste/cera.jpg',
      ),
    );
  });
});

describe('the sales the list is built from', () => {
  it('starts with every sale whose production is pending, and only those', async () => {
    const { asked } = serve();
    renderShortages();
    await waitForTable();

    expect(asked).toEqual([PENDING_IDS]);
    expect(screen.getByText('2 vendas consideradas')).toBeInTheDocument();
    expect(screen.getByText('Todas as vendas com produção pendente')).toBeInTheDocument();
  });

  it('reads every page of the pending sales, not only the first', async () => {
    const many = Array.from({ length: 130 }, (_, index) =>
      saleDto({ id: `sale-${String(index).padStart(3, '0')}`, customerName: `Cliente ${index}` }),
    );
    const offsets: string[] = [];
    const { asked } = serve({ sales: many });
    server.use(
      ...salesHandlers({
        sales: many,
        onRequest: (url) => url.pathname.endsWith('/sales') && offsets.push(url.search),
      }),
    );
    renderShortages();
    await waitForTable();

    expect(offsets).toHaveLength(2);
    expect(offsets[0]).toContain('offset=0');
    expect(offsets[1]).toContain('offset=100');
    expect(asked[0]).toHaveLength(130);
    expect(screen.getByText('130 vendas consideradas')).toBeInTheDocument();
  });

  it('lets the person choose which ones, and asks the API again for only those', async () => {
    const user = userEvent.setup();
    const { asked } = serve();
    renderShortages();
    await waitForTable();

    await user.click(screen.getByRole('button', { name: 'Escolher vendas' }));
    const panel = await screen.findByRole('dialog', { name: 'Escolher as vendas da lista' });

    // Sales that are already assembled or delivered are not offered: they have drawn on the stock.
    expect(within(panel).queryByText(/João Pereira/)).not.toBeInTheDocument();
    expect(within(panel).queryByText(/Ana Lima/)).not.toBeInTheDocument();
    expect(within(panel).getByRole('checkbox', { name: /Marina Souza/ })).toBeChecked();

    await user.click(within(panel).getByRole('checkbox', { name: /Carlos Dias/ }));
    await user.click(within(panel).getByRole('button', { name: 'Usar 1 venda' }));

    await waitFor(() => expect(asked).toEqual([PENDING_IDS, [vendaMarina.id]]));
    expect(await screen.findByText('1 venda considerada')).toBeInTheDocument();
    expect(screen.getByText('De 2 vendas com produção pendente')).toBeInTheDocument();
  });

  it('does not let the person use no sale at all', async () => {
    const user = userEvent.setup();
    serve();
    renderShortages();
    await waitForTable();

    await user.click(screen.getByRole('button', { name: 'Escolher vendas' }));
    const panel = await screen.findByRole('dialog', { name: 'Escolher as vendas da lista' });
    await user.click(within(panel).getByRole('button', { name: 'Desmarcar todas' }));

    expect(
      within(panel).getByRole('button', { name: 'Escolha ao menos uma venda' }),
    ).toBeDisabled();
  });

  it('leaves the choice as it was when the panel is closed without using it', async () => {
    const user = userEvent.setup();
    const { asked } = serve();
    renderShortages();
    await waitForTable();

    await user.click(screen.getByRole('button', { name: 'Escolher vendas' }));
    const panel = await screen.findByRole('dialog', { name: 'Escolher as vendas da lista' });
    await user.click(within(panel).getByRole('checkbox', { name: /Carlos Dias/ }));
    await user.click(within(panel).getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByText('2 vendas consideradas')).toBeInTheDocument();
    expect(asked).toEqual([PENDING_IDS]);
  });

  it('says so, with a way to the sales, when none has production pending', async () => {
    const { asked } = serve({ sales: [vendaJoao, vendaAna] });
    renderShortages();

    expect(await screen.findByText('Nenhuma venda com produção pendente')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver vendas' })).toHaveAttribute('href', '/vendas');
    expect(asked).toEqual([]);
    expect(screen.getByRole('button', { name: 'Gerar lista de compras' })).toBeDisabled();
  });
});

describe('the filter "apenas faltantes"', () => {
  it('leaves only what still has to be bought, and brings the rest back when it is off', async () => {
    const user = userEvent.setup();
    serve();
    renderShortages();
    await waitForTable();

    const filter = screen.getByRole('button', { name: 'Apenas faltantes' });

    expect(filter).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('checkbox', { name: 'Pavio encerado' })).toBeInTheDocument();

    await user.click(filter);

    expect(filter).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('checkbox', { name: 'Pavio encerado' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Cera de soja' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Essência baunilha' })).toBeInTheDocument();

    await user.click(filter);

    expect(screen.getByRole('checkbox', { name: 'Pavio encerado' })).toBeInTheDocument();
  });

  it('says nothing is missing, with a way back, when the stock covers it all', async () => {
    const user = userEvent.setup();
    serve({
      list: () => ({
        ...listaCompleta,
        lines: [listaCompleta.lines[1]!],
        estimatedTotal: dec('0.00'),
      }),
    });
    renderShortages();
    await screen.findByRole('checkbox', { name: 'Pavio encerado' });

    await user.click(screen.getByRole('button', { name: 'Apenas faltantes' }));

    expect(screen.getByText('Nada falta')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mostrar todos os insumos' }));

    expect(screen.getByRole('checkbox', { name: 'Pavio encerado' })).toBeInTheDocument();
  });
});

describe('a line the API could not estimate', () => {
  it('is flagged, with the reason, and shows no price: unknown is not zero', async () => {
    serve({ list: () => listaComLinhaSemEstimativa });
    renderShortages();
    await screen.findByRole('checkbox', { name: 'Fita de cetim' });

    const row = within(rowOf('Fita de cetim'));

    expect(row.getByText('Sem estimativa')).toBeInTheDocument();
    expect(row.getByText(/Falta o tamanho ou o preço da embalagem/)).toBeInTheDocument();
    expect(row.getByText('Embalagens: não dá para calcular')).toBeInTheDocument();
    // Needed and missing are the same 300 cm: there is nothing in stock.
    expect(row.getAllByText(`300${SPACE}cm`, VERBATIM)).toHaveLength(2);
    // No price of any kind on the line — not R$ 0,00, not any other.
    expect(row.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it('makes the total on top say it is partial, and why, instead of passing it as the whole', async () => {
    serve({ list: () => listaComLinhaSemEstimativa });
    renderShortages();
    await screen.findByRole('checkbox', { name: 'Fita de cetim' });

    const summary = within(screen.getByRole('region', { name: 'Resumo da lista de compras' }));

    expect(summary.getByText('Total estimado parcial')).toBeInTheDocument();
    expect(summary.getByText(`R$${SPACE}94,00`, VERBATIM)).toBeInTheDocument();
    expect(summary.getByRole('note')).toHaveTextContent(
      'Este total não cobre 1 insumo sem estimativa',
    );
  });

  it('shows a plain total, with no warning, when every line was estimated', async () => {
    serve();
    renderShortages();
    await waitForTable();

    const summary = within(screen.getByRole('region', { name: 'Resumo da lista de compras' }));

    expect(summary.getByText('Total estimado')).toBeInTheDocument();
    expect(summary.getByText(`R$${SPACE}94,00`, VERBATIM)).toBeInTheDocument();
    expect(summary.queryByRole('note')).not.toBeInTheDocument();
    expect(summary.queryByText(/não cobre/)).not.toBeInTheDocument();
  });
});

const FULL_LIST_TEXT = [
  'Lista de compras',
  'Baseada em 2 vendas.',
  '',
  `- Essência baunilha: 1 embalagem de 100${SPACE}ml (falta 14${SPACE}ml) — R$${SPACE}38,00`,
  `- Cera de soja: 2 embalagens de 1${SPACE}kg (falta 1,76${SPACE}kg) — R$${SPACE}56,00`,
  `- Fita de cetim: falta 300${SPACE}cm (sem dados da embalagem) — sem estimativa de custo`,
  '',
  `Total estimado: R$${SPACE}94,00 (não inclui 1 insumo sem estimativa)`,
].join('\n');

async function openList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Gerar lista de compras' }));
  const panel = await screen.findByRole('dialog', { name: 'Lista de compras' });

  return { panel, text: within(panel).getByRole('textbox', { name: 'Texto da lista de compras' }) };
}

describe('the shopping list', () => {
  it('is the text of the ticked materials, with the packages and the API’s estimates', async () => {
    const user = userEvent.setup();
    serve({ list: () => listaComLinhaSemEstimativa });
    renderShortages();
    await waitForTable();

    const { text } = await openList(user);

    // The material that is not missing is not on it.
    expect(text).toHaveValue(FULL_LIST_TEXT);
  });

  it('leaves out what was unticked, and leaves out the total it would no longer match', async () => {
    const user = userEvent.setup();
    serve({ list: () => listaComLinhaSemEstimativa });
    renderShortages();
    await waitForTable();

    await user.click(screen.getByRole('checkbox', { name: 'Cera de soja' }));
    const { text } = await openList(user);

    expect((text as HTMLTextAreaElement).value).not.toContain('Cera de soja');
    expect((text as HTMLTextAreaElement).value).toContain('Essência baunilha');
    expect((text as HTMLTextAreaElement).value).not.toContain('Total estimado');
  });

  it('cannot be made with nothing ticked', async () => {
    const user = userEvent.setup();
    serve();
    renderShortages();
    await waitForTable();

    await user.click(screen.getByRole('checkbox', { name: 'Cera de soja' }));
    await user.click(screen.getByRole('checkbox', { name: 'Essência baunilha' }));

    expect(screen.getByRole('button', { name: 'Gerar lista de compras' })).toBeDisabled();
  });

  it('is copied as the very text on screen', async () => {
    const user = userEvent.setup();
    serve({ list: () => listaComLinhaSemEstimativa });
    renderShortages();
    await waitForTable();

    const { panel } = await openList(user);
    await user.click(within(panel).getByRole('button', { name: 'Copiar texto' }));

    expect(await screen.findByText('Lista copiada.')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(FULL_LIST_TEXT);
  });

  it('says the copy failed, and where to take the text from, when the clipboard refuses', async () => {
    const user = userEvent.setup();
    serve();
    renderShortages();
    await waitForTable();
    const { panel } = await openList(user);
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));

    await user.click(within(panel).getByRole('button', { name: 'Copiar texto' }));

    expect(await screen.findByText(/Não foi possível copiar/)).toBeInTheDocument();
  });

  describe('shared through the phone', () => {
    afterEach(() => {
      Reflect.deleteProperty(navigator, 'share');
    });

    it('offers no share button where the browser has no share sheet', async () => {
      const user = userEvent.setup();
      serve();
      renderShortages();
      await waitForTable();

      const { panel } = await openList(user);

      expect(within(panel).queryByRole('button', { name: 'Compartilhar' })).not.toBeInTheDocument();
    });

    it('hands the text to the share sheet where there is one', async () => {
      const share = vi.fn((_data: ShareData) => Promise.resolve());
      Object.defineProperty(navigator, 'share', { configurable: true, value: share });
      const user = userEvent.setup();
      serve({ list: () => listaComLinhaSemEstimativa });
      renderShortages();
      await waitForTable();

      const { panel } = await openList(user);
      await user.click(within(panel).getByRole('button', { name: 'Compartilhar' }));

      expect(share).toHaveBeenCalledWith({ title: 'Lista de compras', text: FULL_LIST_TEXT });
    });

    it('says nothing when the share sheet is closed without choosing', async () => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => Promise.reject(new DOMException('closed', 'AbortError')),
      });
      const user = userEvent.setup();
      serve();
      renderShortages();
      await waitForTable();

      const { panel } = await openList(user);
      await user.click(within(panel).getByRole('button', { name: 'Compartilhar' }));

      expect(screen.queryByText(/Não foi possível compartilhar/)).not.toBeInTheDocument();
    });
  });

  describe('printed', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('asks the browser to print, with the text laid out in the body for the print stylesheet', async () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      const user = userEvent.setup();
      serve({ list: () => listaComLinhaSemEstimativa });
      const { container } = renderShortages();
      await waitForTable();

      const { panel } = await openList(user);
      await user.click(within(panel).getByRole('button', { name: 'Imprimir' }));

      expect(print).toHaveBeenCalledOnce();

      // A direct child of the body, outside the application's root: it is what
      // the print stylesheet leaves visible when it hides everything else.
      const area = document.body.querySelector(':scope > [data-print-area]');

      expect(area).not.toBeNull();
      expect(area).toHaveTextContent('Lista de compras');
      expect(area?.textContent).toBe(FULL_LIST_TEXT);
      expect(container.contains(area)).toBe(false);
    });

    it('takes the text out of the body when the list is closed', async () => {
      const user = userEvent.setup();
      serve();
      renderShortages();
      await waitForTable();

      await openList(user);

      expect(document.querySelector('[data-print-area]')).not.toBeNull();

      await user.keyboard('{Escape}');

      await waitFor(() => expect(document.querySelector('[data-print-area]')).toBeNull());
    });
  });

  it('is never saved: the only thing sent is the question of what is missing', async () => {
    const user = userEvent.setup();
    const writes: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method !== 'GET') {
        writes.push(`${request.method} ${new URL(request.url).pathname}`);
      }
    });
    serve();
    renderShortages();
    await waitForTable();

    const { panel } = await openList(user);
    await user.click(within(panel).getByRole('button', { name: 'Copiar texto' }));
    await screen.findByText('Lista copiada.');
    server.events.removeAllListeners();

    expect(writes.length).toBeGreaterThan(0);
    expect(new Set(writes)).toEqual(new Set(['POST /sales/shopping-list']));
  });
});

describe('when something goes wrong', () => {
  it('says the shopping list could not be worked out, with the support code and a retry', async () => {
    const user = userEvent.setup();
    serve();
    server.use(
      http.post(`${API}/sales/shopping-list`, () =>
        HttpResponse.json(
          apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-shopping-1' }),
          { status: 500 },
        ),
      ),
    );
    renderShortages();

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('Não foi possível calcular o que falta');
    expect(alert).toHaveTextContent('err-shopping-1');

    server.use(...shortagesHandlers());
    await user.click(within(alert).getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('checkbox', { name: 'Cera de soja' })).toBeInTheDocument();
  });

  it('says the sales could not be loaded, with a retry', async () => {
    server.use(
      http.get(`${API}/sales`, () =>
        HttpResponse.json(
          apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-sales-9' }),
          {
            status: 500,
          },
        ),
      ),
      ...materialsHandlers(),
      ...compositeProductsHandlers(),
    );
    renderShortages();

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('Não foi possível carregar as vendas');
    expect(alert).toHaveTextContent('err-sales-9');
    expect(within(alert).getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});

describe('on a phone (360px)', () => {
  it('turns the table into cards that carry the same figures, and the list can still be made', async () => {
    setViewportWidth(PHONE_WIDTH);
    const user = userEvent.setup();
    serve({ list: () => listaComLinhaSemEstimativa });
    renderShortages();

    const cards = await screen.findByRole('list', { name: 'Necessidade de insumos' });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(within(cards).getAllByRole('listitem')).toHaveLength(4);

    const card = within(rowOf('Cera de soja'));

    // Each figure is under its own heading, since a card has no column header to read it from.
    expect(card.getByText('Necessário')).toBeInTheDocument();
    expect(card.getByText('Em estoque')).toBeInTheDocument();
    expect(card.getByText('Falta comprar')).toBeInTheDocument();
    expect(card.getByText('Custo estimado')).toBeInTheDocument();
    expect(card.getByText('Situação')).toBeInTheDocument();
    expect(await card.findByText(`2 embalagens de 1${SPACE}kg`, VERBATIM)).toBeInTheDocument();

    // The line without an estimate is flagged in the card as well, and prices nothing.
    expect(within(rowOf('Fita de cetim')).getByText('Sem estimativa')).toBeInTheDocument();
    expect(within(rowOf('Fita de cetim')).queryByText(/R\$/)).not.toBeInTheDocument();

    // The action that matters is on the screen, and it works from here.
    const { text } = await openList(user);

    expect(text).toHaveValue(FULL_LIST_TEXT);
  });

  it('lets the sales be chosen from a panel that opens from the bottom', async () => {
    setViewportWidth(PHONE_WIDTH);
    const user = userEvent.setup();
    serve();
    renderShortages();
    await screen.findByRole('list', { name: 'Necessidade de insumos' });

    await user.click(screen.getByRole('button', { name: 'Escolher vendas' }));
    const panel = await screen.findByRole('dialog', { name: 'Escolher as vendas da lista' });

    expect(within(panel).getByRole('checkbox', { name: /Marina Souza/ })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Usar 2 vendas' })).toBeInTheDocument();
  });
});

describe('on a desktop', () => {
  it('shows a table, with a column per figure', async () => {
    serve();
    renderShortages();

    const table = await screen.findByRole('table', { name: 'Necessidade de insumos' });

    for (const header of [
      'Insumo',
      'Necessário',
      'Em estoque',
      'Falta comprar',
      'Custo estimado',
      'Situação',
    ]) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
  });
});
