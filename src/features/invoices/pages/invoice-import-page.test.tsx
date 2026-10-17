import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { env } from '@/shared/config/env';
import { fakeReader, resetFakeReader } from '@/test/fake-qr-reader';
import { apiErrorBody, capturaImportada, invoicesHandlers } from '@/test/fixtures/invoices';
import { installFakeCamera } from '@/test/media';
import { server } from '@/test/msw/server';
import { renderInvoices } from '@/test/render-invoices';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';

vi.mock('@zxing/browser', async () => (await import('@/test/fake-qr-reader')).zxingModule);

const API = env.VITE_API_URL;
const ADDRESS = 'https://www.nfce.fazenda.sp.gov.br/qrcode?p=3524|2|1|1|abc';
const FIELD = 'Endereço do QR Code';

async function typeAddress(user: ReturnType<typeof userEvent.setup>, text = ADDRESS) {
  await user.type(screen.getByLabelText(FIELD), text);
}

describe('sending the address', () => {
  it('sends what was typed and goes to the second step of the note that came back', async () => {
    const user = userEvent.setup();
    const sent: string[] = [];
    server.use(...invoicesHandlers({ onImport: (url) => sent.push(url) }));
    renderInvoices();

    await typeAddress(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('Tela da classificação da compra compra-1111')).toBeVisible();
    expect(sent).toEqual([ADDRESS]);
    expect(
      await screen.findByText('Nota de Casa das Essências importada. Falta classificar os itens.'),
    ).toBeInTheDocument();
  });

  it('refuses an address that is not https before asking the API anything', async () => {
    const user = userEvent.setup();
    const sent: string[] = [];
    server.use(...invoicesHandlers({ onImport: (url) => sent.push(url) }));
    renderInvoices();

    await typeAddress(user, 'nota do mercado');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('O endereço precisa começar com https://')).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it('asks for the address when the field is empty', async () => {
    const user = userEvent.setup();
    server.use(...invoicesHandlers());
    renderInvoices();

    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(
      await screen.findByText('Cole o endereço que está no QR Code da nota.'),
    ).toBeInTheDocument();
  });

  it('does not send twice while the first is still being read', async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.post(`${API}/invoices/imports`, async () => {
        calls += 1;
        await delay(150);

        return HttpResponse.json({ purchaseId: 'compra-9', merchantName: null }, { status: 201 });
      }),
      ...invoicesHandlers(),
    );
    renderInvoices();

    await typeAddress(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    // The wait is the import, and the screen says so instead of looking frozen.
    const sending = await screen.findByRole('button', { name: 'Buscando a nota…' });
    expect(sending).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Colar URL' })).toBeDisabled();
    expect(screen.getByText(/Lendo a nota no portal da SEFAZ/)).toBeInTheDocument();
    await user.click(sending);

    expect(await screen.findByText('Tela da classificação da compra compra-9')).toBeVisible();
    expect(calls).toBe(1);
    expect(await screen.findByText('Nota importada. Falta classificar os itens.')).toBeVisible();
  });
});

describe('when the API refuses', () => {
  it('says the note was already imported, and leads to the purchase the API names', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/invoices/imports`, () =>
        HttpResponse.json(
          apiErrorBody(409, 'DUPLICATE_INVOICE', {
            accessKey: '35241012345678000123650010000012341000012345',
            existingPurchaseId: 'compra-ja-existe',
          }),
          { status: 409 },
        ),
      ),
      // A queue with nothing failing in it, so the only failure on screen is the form's own.
      ...invoicesHandlers({ invoices: [capturaImportada] }),
    );
    renderInvoices();

    await typeAddress(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('Esta nota já foi importada.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Abrir a nota importada/ });
    expect(link).toHaveAttribute('href', '/importar-nota/classificar/compra-ja-existe');
    // Not an invitation to try again, and not a failure to report.
    expect(screen.queryByRole('button', { name: 'Copiar código' })).not.toBeInTheDocument();

    await user.click(link);

    expect(
      await screen.findByText('Tela da classificação da compra compra-ja-existe'),
    ).toBeVisible();
  });

  it('says the portal did not answer, that the note was kept, and has no code to report', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/invoices/imports`, () =>
        HttpResponse.json(
          apiErrorBody(503, 'INVOICE_SOURCE_UNAVAILABLE', undefined, { errorId: 'err-portal' }),
          { status: 503 },
        ),
      ),
      ...invoicesHandlers(),
    );
    renderInvoices();

    await typeAddress(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(
      await screen.findByText(
        'O portal da SEFAZ não respondeu. A nota ficou na fila e pode ser tentada de novo.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('err-portal')).not.toBeInTheDocument();
    expect(screen.queryByText('INVOICE_SOURCE_UNAVAILABLE')).not.toBeInTheDocument();
    // The form is usable again, with the address still in it.
    expect(screen.getByLabelText(FIELD)).toHaveValue(ADDRESS);
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  it('says the support has to act when the portal changed, with the code to send', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/invoices/imports`, () =>
        HttpResponse.json(
          apiErrorBody(502, 'INVOICE_STRUCTURE_CHANGED', undefined, { errorId: 'err-estrutura-7' }),
          { status: 502 },
        ),
      ),
      ...invoicesHandlers({ invoices: [capturaImportada] }),
    );
    renderInvoices();

    await typeAddress(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText(/o suporte precisa ajustar o sistema/)).toBeInTheDocument();
    expect(screen.getByText('Envie este código para o suporte')).toBeInTheDocument();
    expect(screen.getByText('err-estrutura-7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar código' })).toBeInTheDocument();
    expect(screen.queryByText('INVOICE_STRUCTURE_CHANGED')).not.toBeInTheDocument();
  });

  it('marks the address field when the API rejects the address itself', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/invoices/imports`, () =>
        HttpResponse.json(
          apiErrorBody(400, 'VALIDATION_FAILED', [
            { path: 'url', constraints: ['url must be a URL address'] },
          ]),
          { status: 400 },
        ),
      ),
      ...invoicesHandlers(),
    );
    renderInvoices();

    await typeAddress(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('Confira este campo.')).toBeInTheDocument();
    expect(screen.queryByText(/must be a URL/)).not.toBeInTheDocument();
  });

  it('shows the note that was left in the queue by the failed attempt, where there was none', async () => {
    const user = userEvent.setup();
    // A queue that starts empty and grows the way the API's does: the failed capture is kept.
    const queue: { status: string }[] = [];
    server.use(
      http.get(`${API}/invoices/pending`, ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        const items = queue.filter((invoice) => invoice.status === status);

        return HttpResponse.json({ items, total: items.length, limit: 100, offset: 0 });
      }),
      http.post(`${API}/invoices/imports`, () => {
        queue.push({
          id: 'cap-nova',
          url: ADDRESS,
          status: 'UNSTABLE',
          attemptCount: 3,
          lastAttemptAt: '2026-10-12T12:06:00.000Z',
          purchaseId: null,
          lastError: 'The NFC-e source did not answer.',
          createdAt: '2026-10-12T12:05:00.000Z',
        } as (typeof queue)[number]);

        return HttpResponse.json(apiErrorBody(503, 'INVOICE_SOURCE_UNAVAILABLE'), { status: 503 });
      }),
      ...invoicesHandlers({ invoices: [], purchases: [] }),
    );
    renderInvoices();
    expect(await screen.findByText('Nenhuma nota importada ainda')).toBeInTheDocument();
    // Nothing is waiting, so the section is not on the screen at all.
    expect(screen.queryByText('Notas aguardando leitura')).not.toBeInTheDocument();

    await typeAddress(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    const waiting = await screen.findByRole('list', { name: 'Notas aguardando leitura' });
    expect(within(waiting).getByText('Portal instável')).toBeInTheDocument();
    expect(within(waiting).getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});

describe('pasting the address', () => {
  it('fills the field with what was copied, trimmed, and leaves the sending to the person', async () => {
    const user = userEvent.setup();
    const sent: string[] = [];
    server.use(...invoicesHandlers({ onImport: (url) => sent.push(url) }));
    renderInvoices();
    await navigator.clipboard.writeText(`  ${ADDRESS}\n`);

    await user.click(screen.getByRole('button', { name: 'Colar URL' }));

    await waitFor(() => {
      expect(screen.getByLabelText(FIELD)).toHaveValue(ADDRESS);
    });
    expect(sent).toEqual([]);
  });

  it('falls back to pasting by hand when the browser does not let the page read the clipboard', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'readText').mockRejectedValue(
      new DOMException('Blocked.', 'NotAllowedError'),
    );
    server.use(...invoicesHandlers());
    renderInvoices();

    await user.click(screen.getByRole('button', { name: 'Colar URL' }));

    expect(await screen.findByText(/Toque no campo e cole o endereço por lá/)).toBeInTheDocument();
    // The field is ready to be pasted into.
    expect(screen.getByLabelText(FIELD)).toHaveFocus();

    await user.paste(ADDRESS);

    expect(screen.getByLabelText(FIELD)).toHaveValue(ADDRESS);
  });

  it('says there is nothing to paste when the clipboard is empty', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('   ');
    server.use(...invoicesHandlers());
    renderInvoices();

    await user.click(screen.getByRole('button', { name: 'Colar URL' }));

    expect(await screen.findByText(/Não há nada copiado/)).toBeInTheDocument();
  });
});

describe('scanning', () => {
  it('has no scan button on a device without a camera API', async () => {
    server.use(...invoicesHandlers());
    renderInvoices();

    await screen.findByRole('list', { name: 'Notas recentes' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.queryByRole('button', { name: 'Escanear QR Code' })).not.toBeInTheDocument();
    // Pasting stays.
    expect(screen.getByRole('button', { name: 'Colar URL' })).toBeInTheDocument();
  });

  it('has no scan button when the browser lists devices and none is a camera', async () => {
    installFakeCamera({ devices: [{ kind: 'audioinput' }] });
    server.use(...invoicesHandlers());
    renderInvoices();

    await screen.findByRole('list', { name: 'Notas recentes' });
    // Give the detection time to answer: it is a promise, and a late button is the failure.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.queryByRole('button', { name: 'Escanear QR Code' })).not.toBeInTheDocument();
  });

  it('reads the code, sends the address it held and goes to the second step', async () => {
    const user = userEvent.setup();
    resetFakeReader();
    installFakeCamera();
    const sent: string[] = [];
    server.use(...invoicesHandlers({ onImport: (url) => sent.push(url) }));
    renderInvoices();

    await user.click(await screen.findByRole('button', { name: 'Escanear QR Code' }));
    await screen.findByText('Procurando o QR Code…');
    fakeReader.read?.(`  ${ADDRESS}  `);

    expect(await screen.findByText('Tela da classificação da compra compra-1111')).toBeVisible();
    expect(sent).toEqual([ADDRESS]);
  });

  it('puts what it read in the field and explains it when it is not an https address, without sending', async () => {
    const user = userEvent.setup();
    resetFakeReader();
    installFakeCamera();
    const sent: string[] = [];
    server.use(...invoicesHandlers({ onImport: (url) => sent.push(url) }));
    renderInvoices();

    await user.click(await screen.findByRole('button', { name: 'Escanear QR Code' }));
    await screen.findByText('Procurando o QR Code…');
    fakeReader.read?.('WIFI:S:casa;T:WPA;P:segredo;;');

    expect(await screen.findByText('O endereço precisa começar com https://')).toBeInTheDocument();
    expect(screen.getByLabelText(FIELD)).toHaveValue('WIFI:S:casa;T:WPA;P:segredo;;');
    expect(sent).toEqual([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('makes scanning the first and largest action on a phone, with the address under it', async () => {
    setViewportWidth(PHONE_WIDTH);
    installFakeCamera();
    server.use(...invoicesHandlers());
    renderInvoices();

    const scan = await screen.findByRole('button', { name: 'Escanear QR Code' });
    const field = screen.getByLabelText(FIELD);

    expect(scan.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(scan).toHaveClass('h-14', 'w-full');
    expect(screen.getByRole('button', { name: 'Colar URL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
  });

  it('puts the address first on a computer, with scanning beside it', async () => {
    installFakeCamera();
    server.use(...invoicesHandlers());
    renderInvoices();

    const scan = await screen.findByRole('button', { name: 'Escanear QR Code' });
    const field = screen.getByLabelText(FIELD);

    expect(field.compareDocumentPosition(scan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(scan).not.toHaveClass('h-14');
  });
});

describe('the explanation of the two steps', () => {
  it('says the note scanned on the phone can be finished on the computer', () => {
    server.use(...invoicesHandlers());
    renderInvoices();

    expect(screen.getByText('Passo 1 de 2')).toBeInTheDocument();
    expect(
      screen.getByText(/Uma nota escaneada no celular pode ser concluída no computador/),
    ).toBeInTheDocument();
  });
});
