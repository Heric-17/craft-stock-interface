import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { NON_BREAKING_SPACE } from '@/shared/format';
import { apiErrorBody, cera, materialDto, materialsHandlers } from '@/test/fixtures/materials';
import { renderMaterialsPage } from '@/test/render-materials-page';
import { server } from '@/test/msw/server';
import { VERBATIM } from '@/test/text';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';

const API = env.VITE_API_URL;
const SPACE = NON_BREAKING_SPACE;

type User = ReturnType<typeof userEvent.setup>;

const DIALOG_NAME: Record<string, RegExp> = {
  'Dar entrada': /Dar entrada no estoque/,
  'Dar baixa': /Dar baixa no estoque/,
  'Corrigir contagem': /Corrigir contagem do estoque/,
};

/** Opens a material and one of the three actions of its "Estoque" section. */
async function openAction(user: User, action: string, route = '/insumos?insumo=mat-cera') {
  renderMaterialsPage(route);
  const detail = await screen.findByRole('dialog');
  await user.click(await within(detail).findByRole('button', { name: action }));

  return screen.findByRole('dialog', { name: DIALOG_NAME[action]! });
}

/** The route all three go to, recording what each one sends. */
function stockRoute(bodies: unknown[], answer = cera) {
  return http.post(`${API}/materials/mat-cera/stock-entries`, async ({ request }) => {
    bodies.push(await request.json());

    return HttpResponse.json(answer);
  });
}

describe('the stock section of a material', () => {
  it('offers the three acts side by side, each with its own name, beside the current stock', async () => {
    server.use(...materialsHandlers());
    renderMaterialsPage('/insumos?insumo=mat-cera');

    const detail = await screen.findByRole('dialog');
    const section = await within(detail).findByRole('region', { name: 'Estoque' });

    expect(within(section).getByText(`680${SPACE}g`, VERBATIM)).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Dar entrada' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Dar baixa' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Corrigir contagem' })).toBeInTheDocument();
  });

  it('offers none of them for a discontinued material', async () => {
    server.use(
      ...materialsHandlers({ materials: [materialDto({ id: 'mat-antiga', isActive: false })] }),
    );
    renderMaterialsPage('/insumos?insumo=mat-antiga');

    const detail = await screen.findByRole('dialog');
    await within(detail).findByRole('region', { name: 'Estoque' });

    for (const name of ['Dar entrada', 'Dar baixa', 'Corrigir contagem']) {
      expect(within(detail).queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('keeps the three actions in reach on a phone, each a full thumb tall', async () => {
    setViewportWidth(PHONE_WIDTH);
    server.use(...materialsHandlers());
    renderMaterialsPage('/insumos?insumo=mat-cera');

    const detail = await screen.findByRole('dialog');

    for (const name of ['Dar entrada', 'Dar baixa', 'Corrigir contagem']) {
      expect(await within(detail).findByRole('button', { name })).toHaveClass('min-h-16');
    }
  });

  it('lets the page header give an entry to any active material', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());
    renderMaterialsPage();
    await screen.findByRole('link', { name: /Cera de soja/ });

    await user.click(screen.getByRole('button', { name: 'Dar entrada' }));
    const dialog = await screen.findByRole('dialog', { name: 'Dar entrada no estoque' });

    expect(await within(dialog).findByLabelText('Insumo')).toBeInTheDocument();
  });
});

describe('a write-off', () => {
  it('takes from the stock: it is sent as a negative increment, and the preview says what is left', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(stockRoute(bodies, materialDto({ stockQuantity: 600 })), ...materialsHandlers());

    const dialog = await openAction(user, 'Dar baixa');
    expect(within(dialog).getByText(/O motivo não fica registrado/)).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Quantidade que saiu'), '80');

    expect(within(dialog).getByText(/Prévia: o estoque ficará com/)).toBeInTheDocument();
    expect(within(dialog).getByText(`600${SPACE}g`, VERBATIM)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Registrar baixa' }));

    expect(
      await screen.findByText(
        `Baixa registrada em Cera de soja. Estoque agora: 600${SPACE}g.`,
        VERBATIM,
      ),
    ).toBeInTheDocument();
    expect(bodies).toEqual([{ source: 'MANUAL', relativeIncrement: -80 }]);
  });

  it('converts kilos: 0,5 kg leaves as 500 g', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(stockRoute(bodies), ...materialsHandlers());

    const dialog = await openAction(user, 'Dar baixa');
    await user.type(within(dialog).getByLabelText('Quantidade que saiu'), '0,5');
    await user.click(within(dialog).getByRole('button', { name: 'kg' }));

    // The echo says what will be sent: half a kilo is 500 g, and the preview agrees.
    expect(within(dialog).getByText(`500${SPACE}g`, VERBATIM)).toBeInTheDocument();
    expect(within(dialog).getByText(`180${SPACE}g`, VERBATIM)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Registrar baixa' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ source: 'MANUAL', relativeIncrement: -500 });
  });

  it('is refused before it is sent when it is larger than the stock, and says how much there is', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(stockRoute(bodies), ...materialsHandlers());

    const dialog = await openAction(user, 'Dar baixa');
    await user.type(within(dialog).getByLabelText('Quantidade que saiu'), '700');

    const warning = `Não dá para dar baixa em mais do que há em estoque (680${SPACE}g).`;
    expect(await within(dialog).findByText(warning, VERBATIM)).toBeInTheDocument();
    expect(within(dialog).queryByText(/Prévia/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Registrar baixa' }));

    expect((await within(dialog).findAllByText(warning, VERBATIM)).length).toBeGreaterThan(0);
    expect(bodies).toEqual([]);
  });

  it('can take everything, down to zero', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(stockRoute(bodies, materialDto({ stockQuantity: 0 })), ...materialsHandlers());

    const dialog = await openAction(user, 'Dar baixa');
    await user.type(within(dialog).getByLabelText('Quantidade que saiu'), '680');

    expect(within(dialog).getByText(`0${SPACE}g`, VERBATIM)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Registrar baixa' }));

    await waitFor(() => expect(bodies).toEqual([{ source: 'MANUAL', relativeIncrement: -680 }]));
  });

  it('asks for a quantity above zero instead of sending nothing', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(stockRoute(bodies), ...materialsHandlers());

    const dialog = await openAction(user, 'Dar baixa');
    await user.type(within(dialog).getByLabelText('Quantidade que saiu'), '0');
    await user.click(within(dialog).getByRole('button', { name: 'Registrar baixa' }));

    expect(
      await within(dialog).findByText('A baixa precisa ser maior do que zero.'),
    ).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('still shows the API refusal in the form if the stock changed under it', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/materials/mat-cera/stock-entries`, () =>
        HttpResponse.json(apiErrorBody(422, 'INVALID_MATERIAL'), { status: 422 }),
      ),
      ...materialsHandlers(),
    );

    const dialog = await openAction(user, 'Dar baixa');
    await user.type(within(dialog).getByLabelText('Quantidade que saiu'), '80');
    await user.click(within(dialog).getByRole('button', { name: 'Registrar baixa' }));

    expect(
      await within(dialog).findByText('Os dados do insumo não são válidos.'),
    ).toBeInTheDocument();
  });
});

describe('a recount', () => {
  it('sets the stock to what was counted: it is sent as the absolute quantity', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(stockRoute(bodies, materialDto({ stockQuantity: 12 })), ...materialsHandlers());

    const dialog = await openAction(user, 'Corrigir contagem');
    expect(within(dialog).getByText(/exatamente o que você contou/)).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Quantidade contada'), '12');

    expect(within(dialog).getByText(/Prévia: o estoque ficará com/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Salvar contagem' }));

    expect(
      await screen.findByText(
        `Contagem de Cera de soja corrigida. Estoque agora: 12${SPACE}g.`,
        VERBATIM,
      ),
    ).toBeInTheDocument();
    expect(bodies).toEqual([{ source: 'MANUAL', absoluteQuantity: 12 }]);
  });

  it('accepts a count of zero when it is typed, and sends zero', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(stockRoute(bodies, materialDto({ stockQuantity: 0 })), ...materialsHandlers());

    const dialog = await openAction(user, 'Corrigir contagem');
    await user.type(within(dialog).getByLabelText('Quantidade contada'), '0');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar contagem' }));

    await waitFor(() => expect(bodies).toEqual([{ source: 'MANUAL', absoluteQuantity: 0 }]));
  });

  it('does not turn an empty field into a zero count', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(stockRoute(bodies), ...materialsHandlers());

    const dialog = await openAction(user, 'Corrigir contagem');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar contagem' }));

    expect(await within(dialog).findByText('Informe a quantidade.')).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });
});

describe('an entry', () => {
  it('adds to the stock and previews the sum', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(stockRoute(bodies, materialDto({ stockQuantity: 1000 })), ...materialsHandlers());

    const dialog = await openAction(user, 'Dar entrada');
    await user.type(within(dialog).getByLabelText('Quantidade que entrou'), '320');

    expect(within(dialog).getByText(`1${SPACE}kg`, VERBATIM)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Registrar entrada' }));

    await waitFor(() => expect(bodies).toEqual([{ source: 'MANUAL', relativeIncrement: 320 }]));
  });
});
