import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { NON_BREAKING_SPACE } from '@/shared/format';
import { requireDecimalString } from '@/shared/money';
import {
  apiErrorBody,
  cera,
  essencia,
  inventorySummary,
  materialsHandlers,
  pavio,
  priceHistory,
  velaAntiga,
} from '@/test/fixtures/materials';
import { server } from '@/test/msw/server';
import { VERBATIM } from '@/test/text';
import { PHONE_WIDTH, setViewportWidth, TABLET_WIDTH } from '@/test/viewport';

import { inRow, renderMaterialsPage } from '@/test/render-materials-page';

const API = env.VITE_API_URL;
const SPACE = NON_BREAKING_SPACE;

describe('the list of materials', () => {
  it('shows each material with its figures, as the API calculated them', async () => {
    server.use(...materialsHandlers());
    renderMaterialsPage();

    await screen.findByRole('link', { name: /Cera de soja/ });

    const ceraRow = inRow('Cera de soja');
    expect(ceraRow.getByText('Cera de soja')).toBeInTheDocument();
    expect(ceraRow.getByText('Embalagem')).toBeInTheDocument();
    expect(ceraRow.getByText(`1${SPACE}kg`, VERBATIM)).toBeInTheDocument();
    expect(ceraRow.getByText(`680${SPACE}g`, VERBATIM)).toBeInTheDocument();
    expect(ceraRow.getByText(`mín. 300${SPACE}g`, VERBATIM)).toBeInTheDocument();
    expect(ceraRow.getByText(`R$${SPACE}28,00/kg`, VERBATIM)).toBeInTheDocument();
    expect(ceraRow.getByText(`R$${SPACE}19,04`, VERBATIM)).toBeInTheDocument();

    const essenciaRow = inRow('Essência baunilha');
    expect(essenciaRow.getByText(`R$${SPACE}380,00/L`, VERBATIM)).toBeInTheDocument();
    expect(essenciaRow.getByText(`R$${SPACE}6,84`, VERBATIM)).toBeInTheDocument();

    expect(inRow('Pavio encerado').getByText(`R$${SPACE}0,21/un`, VERBATIM)).toBeInTheDocument();
  });

  it('never shows the fractional cost per gram', async () => {
    server.use(...materialsHandlers());
    renderMaterialsPage();

    await screen.findByRole('link', { name: /Cera de soja/ });

    expect(document.body.textContent).not.toMatch(/\/g\b/);
    expect(document.body.textContent).not.toMatch(/\/ml\b/);
  });

  it('shows the low-stock seal the API sent, and only on that material', async () => {
    server.use(...materialsHandlers());
    renderMaterialsPage();

    await screen.findByRole('link', { name: /Cera de soja/ });

    expect(inRow('Essência baunilha').getByText('Estoque baixo')).toBeInTheDocument();
    expect(inRow('Cera de soja').queryByText('Estoque baixo')).not.toBeInTheDocument();
    expect(inRow('Cera de soja').getByText('Saudável')).toBeInTheDocument();
  });

  it('counts the items shown', async () => {
    server.use(...materialsHandlers());
    renderMaterialsPage();

    expect(await screen.findByText('3 insumos')).toBeInTheDocument();
  });

  it('shows a skeleton while it loads', () => {
    server.use(...materialsHandlers());
    renderMaterialsPage();

    expect(screen.getAllByRole('status', { name: '' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Carregando…').length).toBeGreaterThan(0);
  });

  it('says so, with the action that fixes it, when there is nothing registered', async () => {
    server.use(...materialsHandlers({ materials: [] }));
    renderMaterialsPage();

    expect(await screen.findByText('Nenhum insumo cadastrado')).toBeInTheDocument();
    expect(
      within(screen.getByText('Nenhum insumo cadastrado').parentElement!).getByRole('button', {
        name: 'Novo insumo',
      }),
    ).toBeInTheDocument();
  });

  it('shows the error with a way to try again, and the support code of a server failure', async () => {
    // The first handler that matches answers, so the failure goes first.
    server.use(
      http.get(`${API}/materials`, () =>
        HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-7788' }), {
          status: 500,
        }),
      ),
      ...materialsHandlers(),
    );
    renderMaterialsPage();

    expect(await screen.findByText('Não foi possível carregar os insumos')).toBeInTheDocument();
    expect(screen.getByText('err-7788')).toBeInTheDocument();
    expect(screen.getByText('Envie este código para o suporte')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Tentar novamente' }).length).toBeGreaterThan(0);
  });
});

describe('the cards', () => {
  it('read the three figures from the inventory summary', async () => {
    server.use(
      ...materialsHandlers({
        summary: {
          materialCount: 24,
          belowMinimumCount: 3,
          totalStockValue: requireDecimalString('1873.20'),
        },
      }),
    );
    renderMaterialsPage();

    expect(await screen.findByText('24')).toBeInTheDocument();
    expect(screen.getByText('Itens cadastrados')).toBeInTheDocument();
    expect(screen.getByText('Abaixo do mínimo')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(`R$${SPACE}1.873,20`, VERBATIM)).toBeInTheDocument();
  });

  it('do not add up the rows: the total is the backend one, even where the rows differ', async () => {
    // The three rows add up to 39,32. The card says what the backend said.
    server.use(
      ...materialsHandlers({
        summary: { ...inventorySummary, totalStockValue: requireDecimalString('1873.20') },
      }),
    );
    renderMaterialsPage();

    await screen.findByText(`R$${SPACE}1.873,20`, VERBATIM);

    expect(screen.queryByText(`R$${SPACE}39,32`, VERBATIM)).not.toBeInTheDocument();
  });

  it('follow the "include discontinued" switch and say which one they show', async () => {
    const user = userEvent.setup();
    const urls: URL[] = [];
    server.use(
      ...materialsHandlers({ materials: [cera, velaAntiga], onRequest: (u) => urls.push(u) }),
    );
    renderMaterialsPage();

    await screen.findByText('Insumos ativos');
    await user.click(screen.getByRole('checkbox', { name: 'Incluir descontinuados' }));

    expect(await screen.findByText('Com os descontinuados')).toBeInTheDocument();
    expect(
      urls.some(
        (url) =>
          url.pathname.endsWith('/inventory-summary') &&
          url.searchParams.get('includeDiscontinued') === 'true',
      ),
    ).toBe(true);
  });

  it('show their own error without taking the list down', async () => {
    server.use(
      http.get(`${API}/materials/inventory-summary`, () =>
        HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'sum-1' }), {
          status: 500,
        }),
      ),
      ...materialsHandlers(),
    );
    renderMaterialsPage();

    expect(
      await screen.findByText('Não foi possível carregar o resumo do estoque'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Cera de soja/ })).toBeInTheDocument();
  });
});

describe('search and filters', () => {
  it('asks the API for the name searched, and shows what it answers', async () => {
    const user = userEvent.setup();
    const urls: URL[] = [];
    server.use(...materialsHandlers({ onRequest: (url) => urls.push(url) }));
    renderMaterialsPage();
    await screen.findByRole('link', { name: /Cera de soja/ });

    await user.type(screen.getByRole('searchbox', { name: 'Buscar insumo' }), 'pavio');

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /Cera de soja/ })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Pavio encerado/ })).toBeInTheDocument();
    expect(
      urls.some((url) => url.pathname === '/materials' && url.searchParams.get('name') === 'pavio'),
    ).toBe(true);
  });

  it('sends one request for a word, not one for each key', async () => {
    const user = userEvent.setup();
    const names: (string | null)[] = [];
    server.use(
      ...materialsHandlers({
        onRequest: (url) => {
          if (url.pathname === '/materials') {
            names.push(url.searchParams.get('name'));
          }
        },
      }),
    );
    renderMaterialsPage();
    await screen.findByRole('link', { name: /Cera de soja/ });

    await user.type(screen.getByRole('searchbox', { name: 'Buscar insumo' }), 'essência');

    // The previous list stays on screen while the new one loads, so the
    // request is what is waited for, not the row.
    await waitFor(() => expect(names).toContain('essência'));
    await screen.findByRole('link', { name: /Essência baunilha/ });

    expect(names).toEqual([null, 'essência']);
  });

  it('leaves discontinued materials out until asked, and then shows them with their seal', async () => {
    const user = userEvent.setup();
    const urls: URL[] = [];
    server.use(
      ...materialsHandlers({ materials: [cera, velaAntiga], onRequest: (u) => urls.push(u) }),
    );
    renderMaterialsPage();
    await screen.findByRole('link', { name: /Cera de soja/ });

    expect(screen.queryByRole('link', { name: /Fragrância antiga/ })).not.toBeInTheDocument();
    expect(
      urls.some(
        (u) => u.pathname === '/materials' && u.searchParams.get('includeDiscontinued') === 'false',
      ),
    ).toBe(true);

    await user.click(screen.getByRole('checkbox', { name: 'Incluir descontinuados' }));

    expect(await screen.findByRole('link', { name: /Fragrância antiga/ })).toBeInTheDocument();
    expect(inRow('Fragrância antiga').getByText('Descontinuado')).toBeInTheDocument();
    expect(
      urls.some(
        (u) => u.pathname === '/materials' && u.searchParams.get('includeDiscontinued') === 'true',
      ),
    ).toBe(true);
  });

  it('narrows to low stock using the flag the API sent', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());
    renderMaterialsPage();
    await screen.findByRole('link', { name: /Cera de soja/ });

    await user.selectOptions(screen.getByLabelText('Filtrar por estoque'), 'low');

    expect(screen.getByRole('link', { name: /Essência baunilha/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Cera de soja/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pavio encerado/ })).not.toBeInTheDocument();
    expect(screen.getByText('1 insumo')).toBeInTheDocument();
  });

  it('says nothing matched, and clears the filters from the empty state', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());
    renderMaterialsPage();
    await screen.findByRole('link', { name: /Cera de soja/ });

    await user.type(screen.getByRole('searchbox', { name: 'Buscar insumo' }), 'inexistente');

    expect(await screen.findByText('Nenhum insumo encontrado')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpar busca e filtro' }));

    expect(await screen.findByRole('link', { name: /Cera de soja/ })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar insumo' })).toHaveValue('');
  });
});

describe('the detail of a material', () => {
  it('opens from the row, through the address, and shows the figures', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());
    renderMaterialsPage();

    await user.click(await screen.findByRole('link', { name: /Cera de soja/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Custo da embalagem')).toBeInTheDocument();
    expect(within(dialog).getByText(`R$${SPACE}28,00`, VERBATIM)).toBeInTheDocument();
    expect(within(dialog).getByText('Valor em estoque')).toBeInTheDocument();
  });

  it('shows the price history with where each change came from, newest first', async () => {
    server.use(...materialsHandlers());
    renderMaterialsPage('/insumos?insumo=mat-cera');

    const dialog = await screen.findByRole('dialog');
    const entries = await within(dialog).findAllByRole('listitem');

    expect(priceHistory).toHaveLength(3);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toHaveTextContent('R$ 28,00 → R$ 30,00');
    expect(entries[0]).toHaveTextContent('Edição manual');
    expect(entries[1]).toHaveTextContent('R$ 24,00 → R$ 28,00');
    expect(entries[1]).toHaveTextContent('Nota fiscal');
    expect(entries[2]).toHaveTextContent('R$ 24,00');
    expect(entries[2]).toHaveTextContent('Cadastro');
  });

  it('opens a discontinued material from a link, which the API answers for', async () => {
    server.use(...materialsHandlers({ materials: [cera, velaAntiga] }));
    renderMaterialsPage('/insumos?insumo=mat-antiga');

    const dialog = await screen.findByRole('dialog');

    expect(await within(dialog).findByText('Descontinuado')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Reativar' })).toBeInTheDocument();
    // A discontinued material takes no new stock.
    expect(within(dialog).queryByRole('button', { name: 'Dar entrada' })).not.toBeInTheDocument();
  });

  it('shows a reserved space for a photo that is missing, never a broken icon', async () => {
    server.use(...materialsHandlers({ materials: [cera] }));
    renderMaterialsPage();

    await screen.findByRole('link', { name: /Cera de soja/ });

    expect(screen.getByRole('img', { name: 'Cera de soja (sem foto)' })).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('shows a message when the material no longer exists', async () => {
    server.use(...materialsHandlers());
    renderMaterialsPage('/insumos?insumo=mat-sumiu');

    expect(await screen.findByText('Não foi possível abrir este insumo')).toBeInTheDocument();
    expect(screen.getByText('Insumo não encontrado.')).toBeInTheDocument();
  });
});

describe('the list on a phone', () => {
  it('turns the table into cards and keeps both actions in reach', async () => {
    setViewportWidth(PHONE_WIDTH);
    server.use(...materialsHandlers());
    renderMaterialsPage();

    await screen.findByRole('link', { name: /Cera de soja/ });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Insumos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo insumo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajustar estoque' })).toBeInTheDocument();
  });

  it('keeps the cards on a tablet too, where the sidebar leaves no room for five columns', async () => {
    setViewportWidth(TABLET_WIDTH);
    server.use(...materialsHandlers());
    renderMaterialsPage();

    await screen.findByRole('link', { name: /Cera de soja/ });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Insumos' })).toBeInTheDocument();
  });

  it('keeps every figure of the row on the card', async () => {
    setViewportWidth(PHONE_WIDTH);
    server.use(...materialsHandlers());
    renderMaterialsPage();

    await screen.findByRole('link', { name: /Cera de soja/ });
    const card = inRow('Cera de soja');

    expect(card.getByText('Estoque atual')).toBeInTheDocument();
    expect(card.getByText(`680${SPACE}g`, VERBATIM)).toBeInTheDocument();
    expect(card.getByText('Custo fracionado')).toBeInTheDocument();
    expect(card.getByText(`R$${SPACE}28,00/kg`, VERBATIM)).toBeInTheDocument();
    expect(card.getByText('Valor em estoque')).toBeInTheDocument();
    expect(card.getByText('Saudável')).toBeInTheDocument();
  });

  it('gives the search, the filter and the switch a 44px target each', async () => {
    setViewportWidth(PHONE_WIDTH);
    server.use(...materialsHandlers());
    renderMaterialsPage();
    await screen.findByRole('link', { name: /Cera de soja/ });

    expect(screen.getByRole('searchbox', { name: 'Buscar insumo' })).toHaveClass('h-11');
    expect(screen.getByLabelText('Filtrar por estoque')).toHaveClass('h-11');
    expect(
      screen.getByRole('checkbox', { name: 'Incluir descontinuados' }).closest('label'),
    ).toHaveClass('min-h-11');
  });

  it('keeps essencia and pavio reachable by the same address', async () => {
    setViewportWidth(PHONE_WIDTH);
    server.use(...materialsHandlers({ materials: [essencia, pavio] }));
    renderMaterialsPage();

    const link = await screen.findByRole('link', { name: /Pavio encerado/ });

    expect(link).toHaveAttribute('href', '/insumos?insumo=mat-pavio');
  });
});

describe('removing the photo of a material', () => {
  it('asks first, says it cannot be undone, and removes it only once confirmed', async () => {
    const user = userEvent.setup();
    const removed: string[] = [];
    server.use(
      http.delete(`${API}/materials/mat-cera/image`, () => {
        removed.push('image');

        return HttpResponse.json({ ...cera, imageUrl: null });
      }),
      ...materialsHandlers({ materials: [{ ...cera, imageUrl: 'https://img.example/cera.png' }] }),
    );
    renderMaterialsPage('/insumos?insumo=mat-cera');
    const dialog = await screen.findByRole('dialog');

    await user.click(await within(dialog).findByRole('button', { name: 'Remover foto' }));

    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText('Remover a foto de Cera de soja?')).toBeInTheDocument();
    expect(within(confirm).getByText(/Não dá para desfazer/)).toBeInTheDocument();
    expect(removed).toEqual([]);

    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(removed).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Remover foto' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remover foto' }),
    );

    expect(await screen.findByText('Foto removida.')).toBeInTheDocument();
    expect(removed).toEqual(['image']);
  });
});
