import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { apiErrorBody } from '@/test/fixtures/materials';
import { server } from '@/test/msw/server';
import { renderForgotPassword } from '@/test/render-password-recovery';

const API = env.VITE_API_URL;

interface ForgotBody {
  email: string;
}

/** `POST /auth/forgot-password`, remembering what it was sent, answering 204 like the API. */
function linkRequested(received: ForgotBody[]) {
  return http.post(`${API}/auth/forgot-password`, async ({ request }) => {
    received.push((await request.json()) as ForgotBody);

    return new HttpResponse(null, { status: 204 });
  });
}

describe('asking for the link', () => {
  it('opens for a visitor, with no request for a session or a user', async () => {
    // No handler is registered: any request would fail the test.
    renderForgotPassword();

    expect(await screen.findByRole('heading', { name: 'Esqueci minha senha' })).toBeVisible();
    expect(screen.getByLabelText('E-mail')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Enviar link' })).toBeEnabled();
  });

  it('asks the phone for the e-mail keyboard', async () => {
    renderForgotPassword();

    const email = await screen.findByLabelText('E-mail');

    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('inputmode', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');
  });

  it('sends the e-mail, trimmed, and says that a link was sent if there is an account', async () => {
    const user = userEvent.setup();
    const received: ForgotBody[] = [];
    server.use(linkRequested(received));
    renderForgotPassword();

    await user.type(await screen.findByLabelText('E-mail'), '  ana@exemplo.com.br ');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    const status = await screen.findByRole('status');

    expect(status).toHaveTextContent(
      'Se existir uma conta com ana@exemplo.com.br, enviamos um link para criar uma nova senha.',
    );
    expect(received).toEqual([{ email: 'ana@exemplo.com.br' }]);
    expect(screen.getByText(/O link vale por 1 hora e só pode ser usado uma vez/)).toBeVisible();
  });

  /**
   * The API answers 204 whether or not the address has an account, and the screen
   * says "if there is one" either way: it cannot be used to list who has access.
   */
  it('says exactly the same for an address that has no account', async () => {
    const user = userEvent.setup();
    server.use(linkRequested([]));
    renderForgotPassword();

    await user.type(await screen.findByLabelText('E-mail'), 'ninguem@exemplo.com.br');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Se existir uma conta com ninguem@exemplo.com.br, enviamos um link',
    );
  });

  it('does not call the API for something that is not an address', async () => {
    const user = userEvent.setup();
    const received: ForgotBody[] = [];
    server.use(linkRequested(received));
    renderForgotPassword();

    await user.type(await screen.findByLabelText('E-mail'), 'ana@');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(
      await screen.findByText('Informe um e-mail válido, como nome@empresa.com.br.'),
    ).toBeVisible();
    expect(received).toEqual([]);
  });

  it('brings the form back with the address already typed when the person asks again', async () => {
    const user = userEvent.setup();
    server.use(linkRequested([]));
    renderForgotPassword();

    await user.type(await screen.findByLabelText('E-mail'), 'ana@exemplo.com.br');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    await user.click(await screen.findByRole('button', { name: 'Pedir outro link' }));

    expect(await screen.findByLabelText('E-mail')).toHaveValue('ana@exemplo.com.br');
  });

  it('shows the support code, and keeps the form, when the API fails on its side', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/auth/forgot-password`, () =>
        HttpResponse.json(
          apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-forgot-1' }),
          { status: 500 },
        ),
      ),
    );
    renderForgotPassword();

    await user.type(await screen.findByLabelText('E-mail'), 'ana@exemplo.com.br');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(await screen.findByText(/err-forgot-1/)).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@exemplo.com.br');
  });

  it('disables the button while the request is on its way, so it cannot be sent twice', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    server.use(
      http.post(`${API}/auth/forgot-password`, async () => {
        calls += 1;
        await gate;

        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderForgotPassword();

    await user.type(await screen.findByLabelText('E-mail'), 'ana@exemplo.com.br');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    const sending = await screen.findByRole('button', { name: 'Enviando…' });

    expect(sending).toBeDisabled();
    await user.click(sending);
    release();

    await screen.findByRole('status');
    expect(calls).toBe(1);
  });

  it('leads back to the sign-in from the form and from the confirmation', async () => {
    const user = userEvent.setup();
    server.use(linkRequested([]));
    const { router } = renderForgotPassword();

    expect(await screen.findByRole('link', { name: 'Voltar para o login' })).toHaveAttribute(
      'href',
      '/login',
    );

    await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com.br');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));
    await user.click(await screen.findByRole('link', { name: 'Voltar para o login' }));

    expect(router.state.location.pathname).toBe('/login');
    expect(await screen.findByText('Você está na tela de login.')).toBeVisible();
  });
});

describe('asking for the link past the limit', () => {
  it('says there were too many requests and when to try again, not a generic failure', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/auth/forgot-password`, () =>
        HttpResponse.json(
          {
            statusCode: 429,
            code: 'RATE_LIMIT_EXCEEDED',
            error: 'RateLimitExceededError',
            message: 'Too many requests. Try again later.',
            details: { retryAfterSeconds: 3600, retryAt: '2026-10-18T17:40:12.000Z' },
          },
          { status: 429 },
        ),
      ),
    );
    renderForgotPassword();

    await user.type(await screen.findByLabelText('E-mail'), 'ana@exemplo.com.br');
    await user.click(screen.getByRole('button', { name: 'Enviar link' }));

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('Houve tentativas demais. Tente novamente em 1');
    expect(alert).toHaveTextContent('hora');
    expect(alert).not.toHaveTextContent(/Algo deu errado|Too many/);
    // It did not move on to "link sent": nothing was sent.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
