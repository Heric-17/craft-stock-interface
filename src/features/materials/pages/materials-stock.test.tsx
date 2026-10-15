import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { NON_BREAKING_SPACE } from '@/shared/format';
import { requireDecimalString } from '@/shared/money';
import { apiErrorBody, cera, materialDto, materialsHandlers } from '@/test/fixtures/materials';
import { lossResult } from '@/test/fixtures/stock-losses';
import { renderMaterialsPage } from '@/test/render-materials-page';
import { server } from '@/test/msw/server';
import { VERBATIM } from '@/test/text';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';

const API = env.VITE_API_URL;
const SPACE = NON_BREAKING_SPACE;

type User = ReturnType<typeof userEvent.setup>;

const WRITE_OFF = 'Dar baixa / perda';

/** Opens a material, one of the three actions of its "Estoque" section, and the panel it leads to. */
async function openAction(user: User, action: string, route = '/insumos?insumo=mat-cera') {
  renderMaterialsPage(route);
  const detail = await screen.findByRole('dialog');
  await user.click(await within(detail).findByRole('button', { name: action }));

  const panel = await screen.findByRole('dialog', { name: 'Ajustar estoque' });

  // The panel opens on the act that was asked for.
  expect(within(panel).getByRole('radio', { name: action })).toBeChecked();

  return panel;
}

/** The route an entry and a recount go to, recording what each one sends. */
function stockRoute(bodies: unknown[], answer = cera) {
  return http.post(`${API}/materials/mat-cera/stock-entries`, async ({ request }) => {
    bodies.push(await request.json());

    return HttpResponse.json(answer);
  });
}

/** The route a write-off goes to: a loss, with the balance it leaves. */
function lossRoute(bodies: unknown[], answer = lossResult()) {
  return http.post(`${API}/materials/mat-cera/losses`, async ({ request }) => {
    bodies.push(await request.json());

    return HttpResponse.json(answer, { status: 201 });
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
    expect(within(section).getByRole('button', { name: WRITE_OFF })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Corrigir contagem' })).toBeInTheDocument();
  });

  it('offers none of them for a discontinued material', async () => {
    server.use(
      ...materialsHandlers({ materials: [materialDto({ id: 'mat-antiga', isActive: false })] }),
    );
    renderMaterialsPage('/insumos?insumo=mat-antiga');

    const detail = await screen.findByRole('dialog');
    await within(detail).findByRole('region', { name: 'Estoque' });

    for (const name of ['Dar entrada', WRITE_OFF, 'Corrigir contagem']) {
      expect(within(detail).queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('keeps the three actions in reach on a phone, each a full thumb tall', async () => {
    setViewportWidth(PHONE_WIDTH);
    server.use(...materialsHandlers());
    renderMaterialsPage('/insumos?insumo=mat-cera');

    const detail = await screen.findByRole('dialog');

    for (const name of ['Dar entrada', WRITE_OFF, 'Corrigir contagem']) {
      expect(await within(detail).findByRole('button', { name })).toHaveClass('min-h-16');
    }
  });

  it('gives each act an icon and a tone of its own, so a loss does not look like an entry', async () => {
    server.use(...materialsHandlers());
    renderMaterialsPage('/insumos?insumo=mat-cera');

    const detail = await screen.findByRole('dialog');
    await within(detail).findByRole('button', { name: 'Dar entrada' });
    const tones = ['Dar entrada', WRITE_OFF, 'Corrigir contagem'].map((name) => {
      const button = within(detail).getByRole('button', { name });
      const badge = button.querySelector('span[aria-hidden="true"]');

      expect(badge?.querySelector('svg')).not.toBeNull();

      return badge?.className;
    });

    expect(new Set(tones).size).toBe(3);
  });

  it('lets the page header adjust the stock of any active material', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());
    renderMaterialsPage();
    await screen.findByRole('link', { name: /Cera de soja/ });

    await user.click(screen.getByRole('button', { name: 'Ajustar estoque' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ajustar estoque' });

    expect(await within(dialog).findByLabelText('Insumo')).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: 'Dar entrada' })).toBeChecked();
  });
});

describe('the three acts of the adjustment panel', () => {
  it('shows them as three choices of one group, each named and with its own icon and tone', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());

    const panel = await openAction(user, 'Dar entrada');
    const group = within(panel).getByRole('radiogroup', { name: 'O que você quer fazer' });
    const radios = within(group).getAllByRole('radio');

    expect(radios.map((radio) => radio.textContent)).toEqual([
      'Dar entrada',
      WRITE_OFF,
      'Corrigir contagem',
    ]);
    expect(radios.map((radio) => radio.querySelector('svg'))).not.toContain(null);
    expect(new Set(radios.map((radio) => radio.querySelector('span')?.className)).size).toBe(3);
  });

  it('marks the chosen one and changes the words and the fields with it', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());

    const panel = await openAction(user, 'Dar entrada');
    expect(within(panel).getByLabelText('Quantidade que entrou')).toBeInTheDocument();
    expect(within(panel).queryByLabelText('Motivo da baixa')).not.toBeInTheDocument();

    await user.click(within(panel).getByRole('radio', { name: WRITE_OFF }));

    expect(within(panel).getByRole('radio', { name: WRITE_OFF })).toBeChecked();
    expect(within(panel).getByRole('radio', { name: 'Dar entrada' })).not.toBeChecked();
    expect(within(panel).getByLabelText('Quantidade que saiu')).toBeInTheDocument();
    expect(within(panel).getByLabelText('Motivo da baixa')).toBeInTheDocument();
    expect(within(panel).getByLabelText('Observação (opcional)')).toBeInTheDocument();

    await user.click(within(panel).getByRole('radio', { name: 'Corrigir contagem' }));

    expect(within(panel).getByLabelText('Quantidade contada')).toBeInTheDocument();
    expect(within(panel).queryByLabelText('Motivo da baixa')).not.toBeInTheDocument();
  });

  it('does not carry a quantity typed for one act over to another', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());

    const panel = await openAction(user, 'Dar entrada');
    await user.type(within(panel).getByLabelText('Quantidade que entrou'), '320');
    await user.click(within(panel).getByRole('radio', { name: WRITE_OFF }));

    expect(within(panel).getByLabelText('Quantidade que saiu')).toHaveValue('');
  });
});

describe('a write-off', () => {
  async function fillWriteOff(
    user: User,
    panel: HTMLElement,
    values: { quantity: string; reason?: string; observation?: string },
  ) {
    const form = within(panel);
    await user.type(form.getByLabelText('Quantidade que saiu'), values.quantity);

    if (values.reason !== undefined) {
      await user.selectOptions(form.getByLabelText('Motivo da baixa'), values.reason);
    }

    if (values.observation !== undefined) {
      await user.type(form.getByLabelText('Observação (opcional)'), values.observation);
    }
  }

  it('is a loss: it goes to losses, with the quantity taken, positive, and its reason', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(lossRoute(bodies), ...materialsHandlers());

    const panel = await openAction(user, WRITE_OFF);
    expect(
      within(panel).getByText(/Fica no histórico de perdas, com o motivo/),
    ).toBeInTheDocument();
    expect(within(panel).queryByText(/O motivo não fica registrado/)).not.toBeInTheDocument();

    await fillWriteOff(user, panel, {
      quantity: '80',
      reason: 'BREAKAGE',
      observation: 'caiu da prateleira',
    });
    await user.click(within(panel).getByRole('button', { name: 'Registrar baixa' }));

    expect(
      await screen.findByText(
        `Baixa registrada em Cera de soja. Estoque agora: 600${SPACE}g. Valor perdido: R$${SPACE}2,24.`,
        VERBATIM,
      ),
    ).toBeInTheDocument();
    expect(bodies).toEqual([
      { quantity: 80, reason: 'BREAKAGE', observation: 'caiu da prateleira' },
    ]);
  });

  it('says what the loss was worth, as the API derived it: 5 of 10 biscuits at R$ 1,00 leave R$ 5,00', async () => {
    const user = userEvent.setup();
    server.use(
      lossRoute(
        [],
        lossResult({
          quantity: 5,
          value: requireDecimalString('5.00'),
          costBasisAmount: requireDecimalString('1.00'),
          costBasisQuantity: 1,
          stockQuantityAfter: 5,
        }),
      ),
      ...materialsHandlers(),
    );

    const panel = await openAction(user, WRITE_OFF);
    await fillWriteOff(user, panel, { quantity: '5', reason: 'BREAKAGE' });
    await user.click(within(panel).getByRole('button', { name: 'Registrar baixa' }));

    expect(
      await screen.findByText(
        `Baixa registrada em Cera de soja. Estoque agora: 5${SPACE}g. Valor perdido: R$${SPACE}5,00.`,
        VERBATIM,
      ),
    ).toBeInTheDocument();
  });

  it('never goes to stock-entries, which refuses a negative increment', async () => {
    const user = userEvent.setup();
    let entries = 0;
    server.use(
      http.post(`${API}/materials/mat-cera/stock-entries`, () => {
        entries += 1;

        return HttpResponse.json(cera);
      }),
      lossRoute([]),
      ...materialsHandlers(),
    );

    const panel = await openAction(user, WRITE_OFF);
    await fillWriteOff(user, panel, { quantity: '80', reason: 'LOST' });
    await user.click(within(panel).getByRole('button', { name: 'Registrar baixa' }));

    await screen.findByText(/Baixa registrada/);
    expect(entries).toBe(0);
  });

  it('shows the balance it will leave before it is confirmed, as a preview', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());

    const panel = await openAction(user, WRITE_OFF);
    await fillWriteOff(user, panel, { quantity: '80' });

    expect(within(panel).getByText(/Prévia: saldo depois da baixa/)).toBeInTheDocument();
    expect(within(panel).getByText(`600${SPACE}g`, VERBATIM)).toBeInTheDocument();
  });

  it('leaves the observation out of the request when there is none', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(lossRoute(bodies), ...materialsHandlers());

    const panel = await openAction(user, WRITE_OFF);
    await fillWriteOff(user, panel, { quantity: '80', reason: 'EXPIRED' });
    await user.click(within(panel).getByRole('button', { name: 'Registrar baixa' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ quantity: 80, reason: 'EXPIRED' });
  });

  it('offers exactly the five reasons of the closed list, and none is chosen for you', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());

    const panel = await openAction(user, WRITE_OFF);
    const reasons = within(panel).getByLabelText('Motivo da baixa');

    expect(reasons).toHaveValue('');
    expect(
      within(reasons)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Escolha o motivo', 'Quebrou', 'Venceu', 'Estragou', 'Perdido', 'Outro']);
  });

  it('asks for a reason instead of sending without one', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(lossRoute(bodies), ...materialsHandlers());

    const panel = await openAction(user, WRITE_OFF);
    await fillWriteOff(user, panel, { quantity: '80' });
    await user.click(within(panel).getByRole('button', { name: 'Registrar baixa' }));

    expect(await within(panel).findByText('Escolha o motivo da baixa.')).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('counts the observation against its limit of 500 characters', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());

    const panel = await openAction(user, WRITE_OFF);
    const note = within(panel).getByLabelText('Observação (opcional)');

    expect(note).toHaveAttribute('maxlength', '500');
    await user.type(note, 'caiu');
    expect(within(panel).getByText('4/500')).toBeInTheDocument();
  });

  it('converts kilos: 0,5 kg leaves as 500 g, and the preview agrees with the echo', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(lossRoute(bodies), ...materialsHandlers());

    const panel = await openAction(user, WRITE_OFF);
    await user.type(within(panel).getByLabelText('Quantidade que saiu'), '0,5');
    await user.click(within(panel).getByRole('button', { name: 'kg' }));

    expect(within(panel).getByText(`500${SPACE}g`, VERBATIM)).toBeInTheDocument();
    expect(within(panel).getByText(`180${SPACE}g`, VERBATIM)).toBeInTheDocument();

    await user.selectOptions(within(panel).getByLabelText('Motivo da baixa'), 'SPOILAGE');
    await user.click(within(panel).getByRole('button', { name: 'Registrar baixa' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ quantity: 500 });
  });

  it('can take everything, down to zero', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      lossRoute(bodies, lossResult({ quantity: 680, stockQuantityAfter: 0 })),
      ...materialsHandlers(),
    );

    const panel = await openAction(user, WRITE_OFF);
    await fillWriteOff(user, panel, { quantity: '680', reason: 'OTHER' });

    expect(within(panel).getByText(`0${SPACE}g`, VERBATIM)).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Registrar baixa' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ quantity: 680 });
  });

  it('asks for a quantity above zero instead of sending nothing', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(lossRoute(bodies), ...materialsHandlers());

    const panel = await openAction(user, WRITE_OFF);
    await fillWriteOff(user, panel, { quantity: '0', reason: 'LOST' });
    await user.click(within(panel).getByRole('button', { name: 'Registrar baixa' }));

    expect(
      await within(panel).findByText('A baixa precisa ser maior do que zero.'),
    ).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });
});

describe('a write-off larger than the stock', () => {
  it('never leaves the screen: the button is off and the balance is on display instead', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(lossRoute(bodies), ...materialsHandlers());

    const panel = await openAction(user, WRITE_OFF);
    await user.type(within(panel).getByLabelText('Quantidade que saiu'), '700');
    await user.selectOptions(within(panel).getByLabelText('Motivo da baixa'), 'BREAKAGE');

    expect(
      await within(panel).findByText(`Você tem apenas 680${SPACE}g em estoque.`, VERBATIM),
    ).toBeInTheDocument();
    expect(within(panel).queryByText(/Prévia/)).not.toBeInTheDocument();

    const submit = within(panel).getByRole('button', { name: 'Registrar baixa' });
    expect(submit).toBeDisabled();

    await user.click(submit);
    expect(bodies).toEqual([]);
  });

  it('is judged in the base unit even when it is typed in kilos', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());

    const panel = await openAction(user, WRITE_OFF);
    await user.type(within(panel).getByLabelText('Quantidade que saiu'), '0,7');
    await user.click(within(panel).getByRole('button', { name: 'kg' }));

    expect(within(panel).getByRole('button', { name: 'Registrar baixa' })).toBeDisabled();
    expect(
      within(panel).getByText(`Você tem apenas 680${SPACE}g em estoque.`, VERBATIM),
    ).toBeInTheDocument();
  });

  it('turns the button back on as soon as the quantity fits', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());

    const panel = await openAction(user, WRITE_OFF);
    const quantity = within(panel).getByLabelText('Quantidade que saiu');
    await user.type(quantity, '700');
    expect(within(panel).getByRole('button', { name: 'Registrar baixa' })).toBeDisabled();

    await user.clear(quantity);
    await user.type(quantity, '680');

    expect(within(panel).getByRole('button', { name: 'Registrar baixa' })).toBeEnabled();
  });

  it('is not what blocks an entry, which may be any size', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());

    const panel = await openAction(user, 'Dar entrada');
    await user.type(within(panel).getByLabelText('Quantidade que entrou'), '100000');

    expect(within(panel).getByRole('button', { name: 'Registrar entrada' })).toBeEnabled();
  });

  it('still shows the API refusal, with the balance from its details, when the stock changed under the screen', async () => {
    const user = userEvent.setup();
    // The screen read 680 g. Meanwhile, in another tab, the stock went down to 300 g.
    const materials = [cera];
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/materials/mat-cera/losses`, async ({ request }) => {
        bodies.push(await request.json());
        materials[0] = materialDto({ stockQuantity: 300 });

        return HttpResponse.json(
          apiErrorBody(422, 'INSUFFICIENT_STOCK', {
            materialId: 'mat-cera',
            stockQuantity: 300,
            requestedQuantity: 400,
          }),
          { status: 422 },
        );
      }),
      ...materialsHandlers({ materials }),
    );

    const panel = await openAction(user, WRITE_OFF);
    await user.type(within(panel).getByLabelText('Quantidade que saiu'), '400');
    await user.selectOptions(within(panel).getByLabelText('Motivo da baixa'), 'BREAKAGE');
    // 400 fits in what the screen knows, 680: nothing stops it here.
    expect(within(panel).getByRole('button', { name: 'Registrar baixa' })).toBeEnabled();
    await user.click(within(panel).getByRole('button', { name: 'Registrar baixa' }));

    // The figure is the API's — 300 — and not the 680 the screen had.
    expect(
      await within(panel).findByText(`Você tem apenas 300${SPACE}g em estoque.`, VERBATIM),
    ).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
    // The panel stays open, with what was typed, and reads the new balance.
    expect(within(panel).getByLabelText('Quantidade que saiu')).toHaveValue('400');
    await waitFor(() =>
      expect(within(panel).getByText(`300${SPACE}g`, VERBATIM)).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(within(panel).getByRole('button', { name: 'Registrar baixa' })).toBeDisabled(),
    );
    // Neither the code nor the English message reaches the screen.
    expect(document.body.textContent).not.toMatch(/INSUFFICIENT_STOCK|has only/);
  });

  it('writes the refusal in the unit of the material, from the API’s own number', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/materials/mat-cera/losses`, () =>
        HttpResponse.json(
          apiErrorBody(422, 'INSUFFICIENT_STOCK', {
            materialId: 'mat-cera',
            stockQuantity: 1500,
            requestedQuantity: 1600,
          }),
          { status: 422 },
        ),
      ),
      ...materialsHandlers(),
    );

    const panel = await openAction(user, WRITE_OFF);
    await user.type(within(panel).getByLabelText('Quantidade que saiu'), '100');
    await user.selectOptions(within(panel).getByLabelText('Motivo da baixa'), 'LOST');
    await user.click(within(panel).getByRole('button', { name: 'Registrar baixa' }));

    expect(
      await within(panel).findByText(`Você tem apenas 1,5${SPACE}kg em estoque.`, VERBATIM),
    ).toBeInTheDocument();
  });
});

describe('a recount', () => {
  it('sets the stock to what was counted: it is sent as the absolute quantity', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(stockRoute(bodies, materialDto({ stockQuantity: 12 })), ...materialsHandlers());

    const panel = await openAction(user, 'Corrigir contagem');
    expect(within(panel).getByText(/exatamente o que você contou/)).toBeInTheDocument();

    await user.type(within(panel).getByLabelText('Quantidade contada'), '12');

    expect(within(panel).getByText(/Prévia: o estoque ficará com/)).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Salvar contagem' }));

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

    const panel = await openAction(user, 'Corrigir contagem');
    await user.type(within(panel).getByLabelText('Quantidade contada'), '0');
    await user.click(within(panel).getByRole('button', { name: 'Salvar contagem' }));

    await waitFor(() => expect(bodies).toEqual([{ source: 'MANUAL', absoluteQuantity: 0 }]));
  });

  it('does not turn an empty field into a zero count', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(stockRoute(bodies), ...materialsHandlers());

    const panel = await openAction(user, 'Corrigir contagem');
    await user.click(within(panel).getByRole('button', { name: 'Salvar contagem' }));

    expect(await within(panel).findByText('Informe a quantidade.')).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('is not limited by the stock: a count may be larger or smaller', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());

    const panel = await openAction(user, 'Corrigir contagem');
    await user.type(within(panel).getByLabelText('Quantidade contada'), '5000');

    expect(within(panel).getByRole('button', { name: 'Salvar contagem' })).toBeEnabled();
  });
});

describe('an entry', () => {
  it('adds to the stock and previews the sum', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(stockRoute(bodies, materialDto({ stockQuantity: 1000 })), ...materialsHandlers());

    const panel = await openAction(user, 'Dar entrada');
    await user.type(within(panel).getByLabelText('Quantidade que entrou'), '320');

    expect(within(panel).getByText(`1${SPACE}kg`, VERBATIM)).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Registrar entrada' }));

    await waitFor(() => expect(bodies).toEqual([{ source: 'MANUAL', relativeIncrement: 320 }]));
  });
});
