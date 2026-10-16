import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { NON_BREAKING_SPACE } from '@/shared/format';
import {
  apiErrorBody,
  compositeProductsHandlers,
  velaAposentada,
  velaBaunilha,
} from '@/test/fixtures/composite-products';
import { server } from '@/test/msw/server';
import { renderCompositeProducts } from '@/test/render-composite-products';
import { VERBATIM } from '@/test/text';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';

const API = env.VITE_API_URL;
const SPACE = NON_BREAKING_SPACE;

function rowOf(name: string): HTMLElement {
  const link = screen.getByRole('link', { name: new RegExp(name) });

  return link.closest('tr') ?? link.closest('li') ?? link;
}

describe('the list of composite products', () => {
  it('shows what each product costs, sells for and can be made with, from the API', async () => {
    server.use(...compositeProductsHandlers());
    renderCompositeProducts();

    await screen.findByRole('link', { name: /Vela de baunilha/ });
    const row = within(rowOf('Vela de baunilha'));

    expect(row.getByText(`R$${SPACE}8,35`, VERBATIM)).toBeInTheDocument();
    expect(row.getByText(`R$${SPACE}11,27`, VERBATIM)).toBeInTheDocument();
    expect(row.getByText('35%')).toBeInTheDocument();
    expect(row.getByText('3 unidades')).toBeInTheDocument();
    expect(row.getByText('Gargalo: Essência baunilha')).toBeInTheDocument();
    expect(screen.getByText('2 fichas técnicas')).toBeInTheDocument();
  });

  it('shows the margin as a percentage, never as basis points', async () => {
    server.use(...compositeProductsHandlers());
    renderCompositeProducts();

    await screen.findByRole('link', { name: /Kit presente/ });

    expect(within(rowOf('Kit presente')).getByText('33,33%')).toBeInTheDocument();
    expect(screen.queryByText('3333')).not.toBeInTheDocument();
  });

  it('shows the practiced price only for the product that has a manual one', async () => {
    server.use(...compositeProductsHandlers());
    renderCompositeProducts();

    await screen.findByRole('link', { name: /Kit presente/ });

    expect(
      within(rowOf('Kit presente')).getByText(`Praticado R$${SPACE}60,00`, VERBATIM),
    ).toBeInTheDocument();
    expect(within(rowOf('Vela de baunilha')).queryByText(/Praticado/)).not.toBeInTheDocument();
  });

  it('makes a capacity of zero impossible to miss, and names the material to blame', async () => {
    server.use(...compositeProductsHandlers());
    renderCompositeProducts();

    await screen.findByRole('link', { name: /Kit presente/ });
    const row = within(rowOf('Kit presente'));

    expect(row.getByText('Não dá para produzir')).toBeInTheDocument();
    expect(row.getByText('Gargalo: Cera de soja')).toBeInTheDocument();
    expect(within(rowOf('Vela de baunilha')).queryByText('Não dá para produzir')).toBeNull();
  });

  it('calls the capacity what it is, and shows no status, category or trend', async () => {
    server.use(...compositeProductsHandlers());
    renderCompositeProducts();

    await screen.findByRole('link', { name: /Vela de baunilha/ });

    expect(within(rowOf('Vela de baunilha')).getByText('Dá para produzir')).toBeInTheDocument();
    expect(screen.queryByText(/unidades produzidas/i)).not.toBeInTheDocument();
    for (const invented of ['Status', 'Categoria', 'Publicada', 'Rascunho', 'este mês']) {
      expect(screen.queryByText(new RegExp(invented, 'i'))).not.toBeInTheDocument();
    }
  });

  it('links every row to its editor and offers a new product', async () => {
    server.use(...compositeProductsHandlers());
    renderCompositeProducts();

    const link = await screen.findByRole('link', { name: /Vela de baunilha/ });

    expect(link).toHaveAttribute('href', '/fichas-tecnicas/prod-baunilha');
    expect(screen.getByRole('link', { name: 'Nova ficha técnica' })).toHaveAttribute(
      'href',
      '/fichas-tecnicas/nova',
    );
  });

  it('leaves discontinued products out until asked, and then seals them', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    server.use(
      ...compositeProductsHandlers({
        products: [velaBaunilha, velaAposentada],
        onRequest: (url) => requests.push(url),
      }),
    );
    renderCompositeProducts();

    await screen.findByRole('link', { name: /Vela de baunilha/ });
    expect(screen.queryByRole('link', { name: /Vela aposentada/ })).not.toBeInTheDocument();
    expect(requests[0]?.searchParams.get('includeDiscontinued')).toBe('false');

    await user.click(screen.getByRole('checkbox', { name: 'Incluir descontinuados' }));

    const link = await screen.findByRole('link', { name: /Vela aposentada/ });
    expect(within(link.closest('article')!).getByText('Descontinuado')).toBeInTheDocument();
    expect(requests.at(-1)?.searchParams.get('includeDiscontinued')).toBe('true');
  });

  it('narrows the list by name and says so when nothing matches', async () => {
    const user = userEvent.setup();
    server.use(...compositeProductsHandlers());
    renderCompositeProducts();

    await screen.findByRole('link', { name: /Vela de baunilha/ });
    await user.type(screen.getByRole('searchbox', { name: 'Buscar ficha técnica' }), 'kit');

    expect(screen.queryByRole('link', { name: /Vela de baunilha/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kit presente/ })).toBeInTheDocument();
    expect(screen.getByText('1 ficha técnica')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Buscar ficha técnica' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar ficha técnica' }), 'zzz');

    expect(await screen.findByText('Nenhuma ficha técnica encontrada')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpar busca' }));
    expect(await screen.findByRole('link', { name: /Kit presente/ })).toBeInTheDocument();
  });

  it('says what to do when there is no product yet', async () => {
    server.use(...compositeProductsHandlers({ products: [] }));
    renderCompositeProducts();

    expect(await screen.findByText('Nenhuma ficha técnica cadastrada')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Nova ficha técnica' })).toHaveLength(2);
  });

  it('shows a skeleton while it loads', () => {
    server.use(...compositeProductsHandlers());
    renderCompositeProducts();

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows the support code of an unexpected failure, and tries again on request', async () => {
    const user = userEvent.setup();
    let failing = true;
    server.use(
      http.get(`${API}/composite-products`, () =>
        failing
          ? HttpResponse.json(
              apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-prod-1' }),
              { status: 500 },
            )
          : HttpResponse.json([velaBaunilha]),
      ),
    );
    renderCompositeProducts();

    expect(
      await screen.findByText('Não foi possível carregar as fichas técnicas'),
    ).toBeInTheDocument();
    expect(screen.getByText('err-prod-1')).toBeInTheDocument();
    expect(screen.queryByText('INTERNAL_ERROR')).not.toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('link', { name: /Vela de baunilha/ })).toBeInTheDocument();
  });
});

describe('the list of composite products on a phone', () => {
  it('is a list of cards, with the whole task of reading a product still possible', async () => {
    setViewportWidth(PHONE_WIDTH);
    server.use(...compositeProductsHandlers());
    renderCompositeProducts();

    await screen.findByRole('link', { name: /Kit presente/ });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const cards = screen.getByRole('list', { name: 'Fichas técnicas' });
    const card = within(rowOf('Kit presente'));

    expect(within(cards).getAllByRole('listitem')).toHaveLength(2);
    expect(card.getByText('Custo total')).toBeInTheDocument();
    expect(card.getByText(`R$${SPACE}24,60`, VERBATIM)).toBeInTheDocument();
    expect(card.getByText('Não dá para produzir')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova ficha técnica' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });
});
