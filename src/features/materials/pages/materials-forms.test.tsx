import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { NON_BREAKING_SPACE } from '@/shared/format';
import { requireDecimalString } from '@/shared/money';
import { apiErrorBody, cera, materialDto, materialsHandlers } from '@/test/fixtures/materials';
import { server } from '@/test/msw/server';
import { VERBATIM } from '@/test/text';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';

import { renderMaterialsPage } from '@/test/render-materials-page';

const API = env.VITE_API_URL;
const SPACE = NON_BREAKING_SPACE;

/** Records the JSON body of each request a route receives. */
function recorder() {
  const bodies: unknown[] = [];

  return {
    bodies,
    async record(request: Request) {
      bodies.push(await request.json());
    },
  };
}

async function openNewMaterial(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('link', { name: /Cera de soja/ });
  await user.click(screen.getByRole('button', { name: 'Novo insumo' }));

  return screen.findByRole('dialog');
}

async function fillNewMaterial(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  values: { name: string; unit: string; quantity: string; cost: string; minimum: string },
) {
  const form = within(dialog);

  await user.type(form.getByLabelText('Nome'), values.name);
  await user.selectOptions(form.getByLabelText('Unidade de consumo'), values.unit);
  await user.type(form.getByLabelText('Quanto a embalagem contém'), values.quantity);
  await user.type(form.getByLabelText('Custo da embalagem'), values.cost);
  await user.type(form.getByLabelText('Estoque mínimo'), values.minimum);
}

describe('registering a material', () => {
  it('sends the material with no stock, and says it was registered', async () => {
    const user = userEvent.setup();
    const created = recorder();
    server.use(
      http.post(`${API}/materials`, async ({ request }) => {
        await created.record(request);

        return HttpResponse.json(materialDto({ id: 'mat-novo', name: 'Cera de coco' }), {
          status: 201,
        });
      }),
      ...materialsHandlers(),
    );
    renderMaterialsPage();

    const dialog = await openNewMaterial(user);
    await fillNewMaterial(user, dialog, {
      name: 'Cera de coco',
      unit: 'GRAM',
      quantity: '1000',
      cost: '32,50',
      minimum: '200',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Insumo cadastrado.')).toBeInTheDocument();
    expect(created.bodies).toEqual([
      {
        name: 'Cera de coco',
        packageCost: '32.50',
        packageQuantity: 1000,
        consumptionUnit: 'GRAM',
        stockQuantity: 0,
        minimumStockAlert: 200,
      },
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('turns kilos into grams: 1,5 kg is sent as 1500, and the echo says so before saving', async () => {
    const user = userEvent.setup();
    const created = recorder();
    server.use(
      http.post(`${API}/materials`, async ({ request }) => {
        await created.record(request);

        return HttpResponse.json(cera, { status: 201 });
      }),
      ...materialsHandlers(),
    );
    renderMaterialsPage();

    const dialog = await openNewMaterial(user);
    const form = within(dialog);
    await user.type(form.getByLabelText('Nome'), 'Cera');
    await user.selectOptions(form.getByLabelText('Unidade de consumo'), 'GRAM');
    await user.type(form.getByLabelText('Quanto a embalagem contém'), '1,5');
    await user.click(form.getByRole('button', { name: 'kg' }));

    expect(form.getByText(`1,5${SPACE}kg`, VERBATIM)).toBeInTheDocument();

    await user.type(form.getByLabelText('Custo da embalagem'), '30');
    await user.type(form.getByLabelText('Estoque mínimo'), '0');
    await user.click(form.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(created.bodies).toHaveLength(1));
    expect(created.bodies[0]).toMatchObject({ packageQuantity: 1500, minimumStockAlert: 0 });
  });

  it('shows, under each money and quantity field, what it understood', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());
    renderMaterialsPage();

    const dialog = await openNewMaterial(user);
    const form = within(dialog);
    await user.selectOptions(form.getByLabelText('Unidade de consumo'), 'GRAM');
    await user.type(form.getByLabelText('Quanto a embalagem contém'), '1.500');
    await user.type(form.getByLabelText('Custo da embalagem'), '1.284,7');

    // A lone dot in a quantity field is a decimal point, and the echo says so.
    expect(form.getByText(`1,5${SPACE}g`, VERBATIM)).toBeInTheDocument();
    expect(form.getByText(`R$${SPACE}1.284,70`, VERBATIM)).toBeInTheDocument();
  });

  it('asks for every empty required field instead of sending zeros', async () => {
    const user = userEvent.setup();
    let posted = false;
    server.use(
      http.post(`${API}/materials`, () => {
        posted = true;

        return HttpResponse.json(cera, { status: 201 });
      }),
      ...materialsHandlers(),
    );
    renderMaterialsPage();

    const dialog = await openNewMaterial(user);
    await user.selectOptions(within(dialog).getByLabelText('Unidade de consumo'), 'GRAM');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Informe o nome do insumo.')).toBeInTheDocument();
    expect(within(dialog).getByText('Informe quanto a embalagem contém.')).toBeInTheDocument();
    expect(within(dialog).getByText('Informe o custo da embalagem.')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Informe o estoque mínimo. Digite 0 se não quiser alerta.'),
    ).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it('asks which unit before anything else, with no unit pre-chosen', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());
    renderMaterialsPage();

    const dialog = await openNewMaterial(user);

    expect(within(dialog).getByLabelText('Unidade de consumo')).toHaveValue('');
    expect(within(dialog).queryByLabelText('Quanto a embalagem contém')).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Escolha a unidade de consumo.')).toBeInTheDocument();
  });

  it('puts the error of a field the API refused on that field', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/materials`, () =>
        HttpResponse.json(
          apiErrorBody(400, 'VALIDATION_FAILED', [
            { path: 'name', constraints: ['name must be longer than or equal to 1 characters'] },
          ]),
          { status: 400 },
        ),
      ),
      ...materialsHandlers(),
    );
    renderMaterialsPage();

    const dialog = await openNewMaterial(user);
    await fillNewMaterial(user, dialog, {
      name: 'Cera',
      unit: 'GRAM',
      quantity: '1000',
      cost: '30',
      minimum: '0',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Confira este campo.')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Confira os campos destacados e tente de novo.'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/must be/)).not.toBeInTheDocument();
  });
});

describe('the photo of a new material', () => {
  const photo = new File(['bytes'], 'cera.jpg', { type: 'image/jpeg' });

  async function registerWithPhoto(user: ReturnType<typeof userEvent.setup>) {
    const dialog = await openNewMaterial(user);
    await fillNewMaterial(user, dialog, {
      name: 'Cera de coco',
      unit: 'GRAM',
      quantity: '1000',
      cost: '32,50',
      minimum: '200',
    });
    await user.upload(within(dialog).getByLabelText('Escolher foto'), photo);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    return dialog;
  }

  it('is a second call, after the material exists', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    server.use(
      http.post(`${API}/materials`, () => {
        order.push('create');

        return HttpResponse.json(materialDto({ id: 'mat-novo' }), { status: 201 });
      }),
      http.post(`${API}/materials/mat-novo/image`, () => {
        order.push('image');

        return HttpResponse.json(materialDto({ id: 'mat-novo' }));
      }),
      ...materialsHandlers(),
    );
    renderMaterialsPage();
    await screen.findByRole('link', { name: /Cera de soja/ });

    await registerWithPhoto(user);

    expect(await screen.findByText('Insumo cadastrado com foto.')).toBeInTheDocument();
    expect(order).toEqual(['create', 'image']);
  });

  it('keeps the material when the upload fails, says so, and lets the person try again', async () => {
    const user = userEvent.setup();
    let creates = 0;
    let uploads = 0;
    server.use(
      http.post(`${API}/materials`, () => {
        creates += 1;

        return HttpResponse.json(materialDto({ id: 'mat-novo', name: 'Cera de coco' }), {
          status: 201,
        });
      }),
      http.post(`${API}/materials/mat-novo/image`, () => {
        uploads += 1;

        return uploads === 1
          ? HttpResponse.json(apiErrorBody(503, 'IMAGE_UPLOAD_FAILED'), { status: 503 })
          : HttpResponse.json(materialDto({ id: 'mat-novo' }));
      }),
      ...materialsHandlers(),
    );
    renderMaterialsPage();
    await screen.findByRole('link', { name: /Cera de soja/ });

    const dialog = await registerWithPhoto(user);

    // The registration is there, and nothing was undone.
    expect(
      await within(dialog).findByText(/foi cadastrado, mas a foto não foi enviada/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Cera de coco')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Não foi possível enviar a imagem agora. Tente novamente.'),
    ).toBeInTheDocument();
    expect(creates).toBe(1);

    await user.click(within(dialog).getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Foto enviada.')).toBeInTheDocument();
    expect(uploads).toBe(2);
    // It tried the photo again. It did not register the material again.
    expect(creates).toBe(1);
  });

  it('lets the person finish without the photo, and the material stays', async () => {
    const user = userEvent.setup();
    let creates = 0;
    server.use(
      http.post(`${API}/materials`, () => {
        creates += 1;

        return HttpResponse.json(materialDto({ id: 'mat-novo' }), { status: 201 });
      }),
      http.post(`${API}/materials/mat-novo/image`, () =>
        HttpResponse.json(apiErrorBody(503, 'IMAGE_UPLOAD_FAILED'), { status: 503 }),
      ),
      ...materialsHandlers(),
    );
    renderMaterialsPage();
    await screen.findByRole('link', { name: /Cera de soja/ });

    const dialog = await registerWithPhoto(user);
    await user.click(await within(dialog).findByRole('button', { name: 'Concluir sem foto' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(creates).toBe(1);
  });

  it('says what was sent and what is accepted when the format is refused', async () => {
    const user = userEvent.setup({ applyAccept: false });
    server.use(
      http.post(`${API}/materials`, () =>
        HttpResponse.json(materialDto({ id: 'mat-novo' }), { status: 201 }),
      ),
      http.post(`${API}/materials/mat-novo/image`, () =>
        HttpResponse.json(
          apiErrorBody(422, 'UNSUPPORTED_IMAGE_MIME_TYPE', {
            mimeType: 'image/heic',
            supported: ['image/jpeg', 'image/png', 'image/webp'],
          }),
          { status: 422 },
        ),
      ),
      ...materialsHandlers(),
    );
    renderMaterialsPage();
    await screen.findByRole('link', { name: /Cera de soja/ });

    const dialog = await openNewMaterial(user);
    await fillNewMaterial(user, dialog, {
      name: 'Cera de coco',
      unit: 'GRAM',
      quantity: '1000',
      cost: '32,50',
      minimum: '200',
    });
    await user.upload(
      within(dialog).getByLabelText('Escolher foto'),
      new File(['x'], 'foto.heic', { type: 'image/heic' }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Formato de imagem não aceito.')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Você enviou um arquivo HEIC. Os formatos aceitos são JPEG, PNG e WebP.',
      ),
    ).toBeInTheDocument();
  });

  it('says the same when the photo is changed from the detail of a material', async () => {
    const user = userEvent.setup({ applyAccept: false });
    server.use(
      http.post(`${API}/materials/mat-cera/image`, () =>
        HttpResponse.json(
          apiErrorBody(422, 'UNSUPPORTED_IMAGE_MIME_TYPE', {
            mimeType: 'application/pdf',
            supported: ['image/jpeg', 'image/png', 'image/webp'],
          }),
          { status: 422 },
        ),
      ),
      ...materialsHandlers(),
    );
    renderMaterialsPage('/insumos?insumo=mat-cera');

    const dialog = await screen.findByRole('dialog');
    await user.upload(
      await within(dialog).findByLabelText('Adicionar foto'),
      new File(['x'], 'ficha.pdf', { type: 'application/pdf' }),
    );

    expect(await screen.findByText('Formato de imagem não aceito.')).toBeInTheDocument();
    expect(
      screen.getByText('Você enviou um arquivo PDF. Os formatos aceitos são JPEG, PNG e WebP.'),
    ).toBeInTheDocument();
  });
});

describe('editing a material', () => {
  async function openEdit(user: ReturnType<typeof userEvent.setup>, id = 'mat-cera') {
    renderMaterialsPage(`/insumos?insumo=${id}`);
    const detail = await screen.findByRole('dialog');
    await user.click(await within(detail).findByRole('button', { name: 'Editar' }));

    return screen.findByRole('dialog', { name: /Editar/ });
  }

  it('fills the form with the stored values', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());

    const dialog = await openEdit(user);
    const form = within(dialog);

    expect(form.getByLabelText('Nome')).toHaveValue('Cera de soja');
    expect(form.getByLabelText('Quanto a embalagem contém')).toHaveValue('1000');
    expect(form.getByLabelText('Custo da embalagem')).toHaveValue('28,00');
    expect(form.getByLabelText('Estoque mínimo')).toHaveValue('300');
  });

  it('locks the unit with the reason written beside it while there is stock', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());

    const dialog = await openEdit(user);

    expect(within(dialog).getByLabelText('Unidade de consumo')).toBeDisabled();
    expect(
      within(dialog).getByText(
        `Há 680${SPACE}g em estoque deste insumo. Zere o estoque para poder trocar a unidade.`,
        VERBATIM,
      ),
    ).toBeInTheDocument();
  });

  it('leaves the unit free for a material with no stock', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers({ materials: [materialDto({ stockQuantity: 0 })] }));

    const dialog = await openEdit(user);

    expect(within(dialog).getByLabelText('Unidade de consumo')).toBeEnabled();
  });

  it('learns from the API that a bill of materials holds the unit, and writes that reason', async () => {
    const user = userEvent.setup();
    let patched = false;
    server.use(
      http.patch(`${API}/materials/mat-cera/consumption-unit`, () =>
        HttpResponse.json(
          apiErrorBody(422, 'CONSUMPTION_UNIT_LOCKED', {
            materialId: 'mat-cera',
            reason: 'BOM_REFERENCES',
            stockQuantity: 0,
            bomItemReferences: 2,
          }),
          { status: 422 },
        ),
      ),
      http.patch(`${API}/materials/mat-cera`, () => {
        patched = true;

        return HttpResponse.json(cera);
      }),
      ...materialsHandlers({ materials: [materialDto({ stockQuantity: 0 })] }),
    );

    const dialog = await openEdit(user);
    const form = within(dialog);
    await user.selectOptions(form.getByLabelText('Unidade de consumo'), 'MILLILITER');
    await user.click(form.getByRole('button', { name: 'Salvar' }));

    expect(
      await form.findByText(
        '2 fichas técnicas usam este insumo nesta unidade. Remova essas linhas para poder trocá-la.',
      ),
    ).toBeInTheDocument();
    expect(form.getByLabelText('Unidade de consumo')).toBeDisabled();
    // The unit goes back to what it was, and nothing else was saved behind it.
    expect(form.getByLabelText('Unidade de consumo')).toHaveValue('GRAM');
    expect(patched).toBe(false);
  });

  it('writes a different reason when the API says it is the stock', async () => {
    const user = userEvent.setup();
    server.use(
      http.patch(`${API}/materials/mat-cera/consumption-unit`, () =>
        HttpResponse.json(
          apiErrorBody(422, 'CONSUMPTION_UNIT_LOCKED', {
            materialId: 'mat-cera',
            reason: 'STOCK_ON_HAND',
            stockQuantity: 250,
            bomItemReferences: 0,
          }),
          { status: 422 },
        ),
      ),
      ...materialsHandlers({ materials: [materialDto({ stockQuantity: 0 })] }),
    );

    const dialog = await openEdit(user);
    const form = within(dialog);
    await user.selectOptions(form.getByLabelText('Unidade de consumo'), 'MILLILITER');
    await user.click(form.getByRole('button', { name: 'Salvar' }));

    expect(
      await form.findByText(
        `Há 250${SPACE}g em estoque deste insumo. Zere o estoque para poder trocar a unidade.`,
        VERBATIM,
      ),
    ).toBeInTheDocument();
  });

  it('warns that a new package cost reprices every product, only once the cost changed', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());

    const dialog = await openEdit(user);
    const form = within(dialog);
    const warning = /todo produto que usa este insumo muda de custo na hora/;

    expect(form.queryByText(warning)).not.toBeInTheDocument();

    await user.clear(form.getByLabelText('Custo da embalagem'));
    await user.type(form.getByLabelText('Custo da embalagem'), '31');

    expect(form.getByText(warning)).toBeInTheDocument();
    expect(form.getByText(/fica registrada no histórico de preço/)).toBeInTheDocument();
  });

  it('sends only what changed', async () => {
    const user = userEvent.setup();
    const patched = recorder();
    server.use(
      http.patch(`${API}/materials/mat-cera`, async ({ request }) => {
        await patched.record(request);

        return HttpResponse.json(cera);
      }),
      ...materialsHandlers(),
    );

    const dialog = await openEdit(user);
    const form = within(dialog);
    await user.clear(form.getByLabelText('Custo da embalagem'));
    await user.type(form.getByLabelText('Custo da embalagem'), '31,50');
    await user.click(form.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Insumo atualizado.')).toBeInTheDocument();
    expect(patched.bodies).toEqual([{ packageCost: '31.50' }]);
  });

  it('closes without asking the API anything when nothing changed', async () => {
    const user = userEvent.setup();
    let patched = false;
    server.use(
      http.patch(`${API}/materials/mat-cera`, () => {
        patched = true;

        return HttpResponse.json(cera);
      }),
      ...materialsHandlers(),
    );

    const dialog = await openEdit(user);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /Editar/ })).not.toBeInTheDocument(),
    );
    expect(patched).toBe(false);
  });
});

describe('giving stock entry', () => {
  it('picks the material, converts kilos to grams and shows the stock the API answers', async () => {
    const user = userEvent.setup();
    const entries = recorder();
    server.use(
      http.post(`${API}/materials/mat-cera/stock-entries`, async ({ request }) => {
        await entries.record(request);

        return HttpResponse.json(
          materialDto({ stockQuantity: 2180, stockValue: requireDecimalString('61.04') }),
        );
      }),
      ...materialsHandlers(),
    );
    renderMaterialsPage();
    await screen.findByRole('link', { name: /Cera de soja/ });

    await user.click(screen.getByRole('button', { name: 'Ajustar estoque' }));
    const dialog = await screen.findByRole('dialog');
    const form = within(dialog);
    await user.selectOptions(await form.findByLabelText('Insumo'), 'mat-cera');

    expect(form.getByText(`680${SPACE}g`, VERBATIM)).toBeInTheDocument();

    await user.type(form.getByLabelText('Quantidade que entrou'), '1,5');
    await user.click(form.getByRole('button', { name: 'kg' }));

    expect(form.getByText(`1,5${SPACE}kg`, VERBATIM)).toBeInTheDocument();

    await user.click(form.getByRole('button', { name: 'Registrar entrada' }));

    expect(
      await screen.findByText(
        `Entrada registrada em Cera de soja. Estoque agora: 2,18${SPACE}kg.`,
        VERBATIM,
      ),
    ).toBeInTheDocument();
    expect(entries.bodies).toEqual([{ source: 'MANUAL', relativeIncrement: 1500 }]);
  });

  it('offers only active materials to receive stock', async () => {
    const user = userEvent.setup();
    server.use(
      ...materialsHandlers({
        materials: [
          cera,
          materialDto({ id: 'mat-antiga', name: 'Fragrância antiga', isActive: false }),
        ],
      }),
    );
    renderMaterialsPage();
    await screen.findByRole('link', { name: /Cera de soja/ });

    await user.click(screen.getByRole('button', { name: 'Ajustar estoque' }));
    const select = await within(await screen.findByRole('dialog')).findByLabelText('Insumo');

    expect(within(select).getByRole('option', { name: 'Cera de soja' })).toBeInTheDocument();
    expect(
      within(select).queryByRole('option', { name: 'Fragrância antiga' }),
    ).not.toBeInTheDocument();
  });

  it('opens from a material with it already chosen, in its own unit', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());
    renderMaterialsPage('/insumos?insumo=mat-cera');

    const detail = await screen.findByRole('dialog');
    await user.click(await within(detail).findByRole('button', { name: 'Dar entrada' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ajustar estoque' });

    expect(within(dialog).queryByLabelText('Insumo')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Cera de soja')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Quantidade que entrou')).toBeInTheDocument();
  });

  it('asks for the quantity instead of sending a zero', async () => {
    const user = userEvent.setup();
    let posted = false;
    server.use(
      http.post(`${API}/materials/mat-cera/stock-entries`, () => {
        posted = true;

        return HttpResponse.json(cera);
      }),
      ...materialsHandlers(),
    );
    renderMaterialsPage('/insumos?insumo=mat-cera');

    const detail = await screen.findByRole('dialog');
    await user.click(await within(detail).findByRole('button', { name: 'Dar entrada' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ajustar estoque' });
    await user.click(within(dialog).getByRole('button', { name: 'Registrar entrada' }));

    expect(await within(dialog).findByText('Informe a quantidade.')).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it('refuses an entry of zero', async () => {
    const user = userEvent.setup();
    server.use(...materialsHandlers());
    renderMaterialsPage('/insumos?insumo=mat-cera');

    const detail = await screen.findByRole('dialog');
    await user.click(await within(detail).findByRole('button', { name: 'Dar entrada' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ajustar estoque' });
    await user.type(within(dialog).getByLabelText('Quantidade que entrou'), '0');
    await user.click(within(dialog).getByRole('button', { name: 'Registrar entrada' }));

    expect(
      await within(dialog).findByText('A entrada precisa ser maior do que zero.'),
    ).toBeInTheDocument();
  });
});

describe('the forms on a phone', () => {
  it('opens the decimal keypad on every field of value and quantity', async () => {
    setViewportWidth(PHONE_WIDTH);
    const user = userEvent.setup();
    server.use(...materialsHandlers());
    renderMaterialsPage();

    const dialog = await openNewMaterial(user);
    await user.selectOptions(within(dialog).getByLabelText('Unidade de consumo'), 'GRAM');

    for (const label of ['Quanto a embalagem contém', 'Custo da embalagem', 'Estoque mínimo']) {
      const field = within(dialog).getByLabelText(label);

      expect(field).toHaveAttribute('inputmode', 'decimal');
      // `type="number"` would break the decimal comma.
      expect(field).toHaveAttribute('type', 'text');
    }
  });

  it('does not raise the keyboard by itself: focus lands on the panel, not on the first field', async () => {
    setViewportWidth(PHONE_WIDTH);
    const user = userEvent.setup();
    server.use(...materialsHandlers());
    renderMaterialsPage();

    const dialog = await openNewMaterial(user);

    await waitFor(() => expect(dialog).toHaveFocus());
    expect(within(dialog).getByLabelText('Nome')).not.toHaveFocus();
  });

  it('keeps the save button inside the panel, in the footer that does not scroll away', async () => {
    setViewportWidth(PHONE_WIDTH);
    const user = userEvent.setup();
    server.use(...materialsHandlers());
    renderMaterialsPage();

    const dialog = await openNewMaterial(user);
    const save = within(dialog).getByRole('button', { name: 'Salvar' });

    expect(save).toBeInTheDocument();
    expect(save).toHaveClass('h-11');
    // The body scrolls on its own; the footer is a sibling of it, not a child.
    expect(save.parentElement).not.toHaveClass('overflow-y-auto');
  });

  it('has the stock entry fields on the decimal keypad too', async () => {
    setViewportWidth(PHONE_WIDTH);
    const user = userEvent.setup();
    server.use(...materialsHandlers());
    renderMaterialsPage('/insumos?insumo=mat-cera');

    const detail = await screen.findByRole('dialog');
    await user.click(await within(detail).findByRole('button', { name: 'Dar entrada' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ajustar estoque' });

    expect(within(dialog).getByLabelText('Quantidade que entrou')).toHaveAttribute(
      'inputmode',
      'decimal',
    );
  });
});

describe('discontinuing, reactivating and deleting', () => {
  it('asks before discontinuing and then does it', async () => {
    const user = userEvent.setup();
    let discontinued = 0;
    server.use(
      http.post(`${API}/materials/mat-cera/discontinue`, () => {
        discontinued += 1;

        return HttpResponse.json(materialDto({ isActive: false }));
      }),
      ...materialsHandlers(),
    );
    renderMaterialsPage('/insumos?insumo=mat-cera');

    const detail = await screen.findByRole('dialog');
    await user.click(await within(detail).findByRole('button', { name: 'Descontinuar' }));
    const confirm = await screen.findByRole('alertdialog');

    expect(discontinued).toBe(0);
    expect(within(confirm).getByText(/continua no histórico/)).toBeInTheDocument();

    await user.click(within(confirm).getByRole('button', { name: 'Descontinuar' }));

    expect(await screen.findByText('Cera de soja foi descontinuado.')).toBeInTheDocument();
    expect(discontinued).toBe(1);
  });

  it('reactivates a discontinued material straight away', async () => {
    const user = userEvent.setup();
    let reactivated = 0;
    server.use(
      http.post(`${API}/materials/mat-antiga/reactivate`, () => {
        reactivated += 1;

        return HttpResponse.json(materialDto({ id: 'mat-antiga', name: 'Fragrância antiga' }));
      }),
      ...materialsHandlers({
        materials: [materialDto({ id: 'mat-antiga', name: 'Fragrância antiga', isActive: false })],
      }),
    );
    renderMaterialsPage('/insumos?insumo=mat-antiga');

    const detail = await screen.findByRole('dialog');
    await user.click(await within(detail).findByRole('button', { name: 'Reativar' }));

    expect(await screen.findByText('Fragrância antiga voltou a ficar ativo.')).toBeInTheDocument();
    expect(reactivated).toBe(1);
  });

  it('deletes a material that nothing refers to', async () => {
    const user = userEvent.setup();
    let deleted = 0;
    server.use(
      http.delete(`${API}/materials/mat-cera`, () => {
        deleted += 1;

        return new HttpResponse(null, { status: 204 });
      }),
      ...materialsHandlers(),
    );
    renderMaterialsPage('/insumos?insumo=mat-cera');

    const detail = await screen.findByRole('dialog');
    await user.click(await within(detail).findByRole('button', { name: 'Excluir' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
    );

    expect(await screen.findByText('Cera de soja foi excluído.')).toBeInTheDocument();
    expect(deleted).toBe(1);
  });

  describe('when the material is in use', () => {
    const IN_USE = {
      entityName: 'Material',
      entityId: 'mat-cera',
      saleItems: 3,
      bomItems: 2,
      purchaseItems: 0,
      stockMovements: 0,
      stockLosses: 0,
      total: 5,
    };

    async function tryToDelete(user: ReturnType<typeof userEvent.setup>) {
      renderMaterialsPage('/insumos?insumo=mat-cera');

      const detail = await screen.findByRole('dialog');
      await user.click(await within(detail).findByRole('button', { name: 'Excluir' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
      );
    }

    it('says how many records refer to it, read from the details, and offers to discontinue', async () => {
      const user = userEvent.setup();
      server.use(
        http.delete(`${API}/materials/mat-cera`, () =>
          HttpResponse.json(apiErrorBody(422, 'ENTITY_IN_USE', IN_USE), { status: 422 }),
        ),
        ...materialsHandlers(),
      );

      await tryToDelete(user);

      const dialog = await screen.findByRole('alertdialog', {
        name: 'Não dá para excluir este insumo',
      });
      expect(
        within(dialog).getByText('Em uso em 3 vendas e 2 fichas técnicas.'),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole('button', { name: 'Descontinuar em vez de excluir' }),
      ).toBeInTheDocument();
      // Nothing from the English message, and no field name.
      expect(within(dialog).queryByText(/referenced|entity/i)).not.toBeInTheDocument();
    });

    it('counts all four kinds of reference', async () => {
      const user = userEvent.setup();
      server.use(
        http.delete(`${API}/materials/mat-cera`, () =>
          HttpResponse.json(
            apiErrorBody(422, 'ENTITY_IN_USE', {
              ...IN_USE,
              saleItems: 1,
              bomItems: 4,
              purchaseItems: 2,
              stockMovements: 7,
              stockLosses: 0,
              total: 14,
            }),
            { status: 422 },
          ),
        ),
        ...materialsHandlers(),
      );

      await tryToDelete(user);

      expect(
        await screen.findByText(
          'Em uso em 1 venda, 4 fichas técnicas, 2 compras e 7 movimentações de estoque.',
        ),
      ).toBeInTheDocument();
    });

    it('counts the registered stock losses too, in the sentence and in the total', async () => {
      const user = userEvent.setup();
      server.use(
        http.delete(`${API}/materials/mat-cera`, () =>
          HttpResponse.json(
            apiErrorBody(422, 'ENTITY_IN_USE', {
              ...IN_USE,
              saleItems: 3,
              bomItems: 2,
              stockLosses: 4,
              total: 9,
            }),
            { status: 422 },
          ),
        ),
        ...materialsHandlers(),
      );

      await tryToDelete(user);

      const dialog = await screen.findByRole('alertdialog', {
        name: 'Não dá para excluir este insumo',
      });
      expect(
        within(dialog).getByText('Em uso em 3 vendas, 2 fichas técnicas e 4 perdas registradas.'),
      ).toBeInTheDocument();
      // Losses are history, so the way out is the same: discontinue.
      expect(
        within(dialog).getByRole('button', { name: 'Descontinuar em vez de excluir' }),
      ).toBeInTheDocument();
    });

    it('is blocked by registered losses alone, with nothing else pointing at the material', async () => {
      const user = userEvent.setup();
      server.use(
        http.delete(`${API}/materials/mat-cera`, () =>
          HttpResponse.json(
            apiErrorBody(422, 'ENTITY_IN_USE', {
              ...IN_USE,
              saleItems: 0,
              bomItems: 0,
              stockLosses: 1,
              total: 1,
            }),
            { status: 422 },
          ),
        ),
        ...materialsHandlers(),
      );

      await tryToDelete(user);

      expect(await screen.findByText('Em uso em 1 perda registrada.')).toBeInTheDocument();
    });

    it('discontinues instead when that is what the person chooses', async () => {
      const user = userEvent.setup();
      let discontinued = 0;
      server.use(
        http.delete(`${API}/materials/mat-cera`, () =>
          HttpResponse.json(apiErrorBody(422, 'ENTITY_IN_USE', IN_USE), { status: 422 }),
        ),
        http.post(`${API}/materials/mat-cera/discontinue`, () => {
          discontinued += 1;

          return HttpResponse.json(materialDto({ isActive: false }));
        }),
        ...materialsHandlers(),
      );

      await tryToDelete(user);
      await user.click(
        await screen.findByRole('button', { name: 'Descontinuar em vez de excluir' }),
      );

      expect(await screen.findByText('Cera de soja foi descontinuado.')).toBeInTheDocument();
      expect(discontinued).toBe(1);
    });

    it('does not offer anything but a message for any other failure', async () => {
      const user = userEvent.setup();
      server.use(
        http.delete(`${API}/materials/mat-cera`, () =>
          HttpResponse.json(apiErrorBody(422, 'MATERIAL_NOT_FOUND'), { status: 422 }),
        ),
        ...materialsHandlers(),
      );

      await tryToDelete(user);

      expect(await screen.findByText('Insumo não encontrado.')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Descontinuar em vez de excluir' }),
      ).not.toBeInTheDocument();
    });
  });
});
