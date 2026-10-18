import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { apiErrorBody } from '@/test/fixtures/materials';
import { server } from '@/test/msw/server';
import { renderResetPassword } from '@/test/render-password-recovery';

const API = env.VITE_API_URL;
const TOKEN = 'ab12'.repeat(16);
const LINK = `#token=${TOKEN}`;

interface ResetBody {
  token: string;
  newPassword: string;
}

/** `POST /auth/reset-password`, remembering what it was sent, answering 204 like the API. */
function passwordReset(received: ResetBody[]) {
  return http.post(`${API}/auth/reset-password`, async ({ request }) => {
    received.push((await request.json()) as ResetBody);

    return new HttpResponse(null, { status: 204 });
  });
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  values: { next?: string; confirm?: string } = {},
) {
  const { next = 'uma senha nova longa' } = values;
  const { confirm = next } = values;

  await user.type(await screen.findByLabelText('Nova senha'), next);
  await user.type(screen.getByLabelText('Repita a nova senha'), confirm);
}

describe('choosing the new password', () => {
  it('opens for a visitor with the form, without any request for a session', async () => {
    // No handler is registered: any request would fail the test.
    renderResetPassword(LINK);

    expect(await screen.findByRole('heading', { name: 'Nova senha' })).toBeVisible();
    expect(screen.getByLabelText('Nova senha')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('button', { name: 'Salvar nova senha' })).toBeEnabled();
  });

  it('takes the code out of the address as soon as it has read it', async () => {
    const { router } = renderResetPassword(LINK);

    await screen.findByRole('heading', { name: 'Nova senha' });

    expect(router.state.location.hash).toBe('');
    expect(router.state.location.pathname).toBe('/redefinir-senha');
  });

  it('sends the code from the link with the new password, then goes to the sign-in', async () => {
    const user = userEvent.setup();
    const received: ResetBody[] = [];
    server.use(passwordReset(received));
    const { router } = renderResetPassword(LINK);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(await screen.findByText('Você está na tela de login.')).toBeVisible();
    expect(await screen.findByText('Senha alterada. Entre com a nova senha.')).toBeVisible();
    expect(received).toEqual([{ token: TOKEN, newPassword: 'uma senha nova longa' }]);
    expect(router.state.location.pathname).toBe('/login');
  });

  it('does not call the API when the two passwords differ, and says so on the second field', async () => {
    const user = userEvent.setup();
    const received: ResetBody[] = [];
    server.use(passwordReset(received));
    renderResetPassword(LINK);

    await fillForm(user, { next: 'uma senha nova longa', confirm: 'outra senha longa' });
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(await screen.findByText('As senhas não são iguais.')).toBeVisible();
    expect(received).toEqual([]);
  });

  it('does not call the API with a password under eight characters', async () => {
    const user = userEvent.setup();
    const received: ResetBody[] = [];
    server.use(passwordReset(received));
    renderResetPassword(LINK);

    await fillForm(user, { next: '1234567' });
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(await screen.findByText('A senha precisa ter pelo menos 8 caracteres.')).toBeVisible();
    expect(received).toEqual([]);
  });

  it('replaces the form with the way to ask for another link when the API no longer accepts this one', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/auth/reset-password`, () =>
        HttpResponse.json(apiErrorBody(422, 'INVALID_PASSWORD_RESET_TOKEN'), { status: 422 }),
      ),
    );
    renderResetPassword(LINK);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(
      await screen.findByText(
        'Este link não vale mais. Ele expira em 1 hora e só pode ser usado uma vez. Peça um novo.',
      ),
    ).toBeVisible();
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toHaveAttribute(
      'href',
      '/esqueci-senha',
    );
  });

  it('opens the request for a new link from the page that says the old one is no good', async () => {
    const user = userEvent.setup();
    const { router } = renderResetPassword('');

    await user.click(await screen.findByRole('link', { name: 'Pedir um novo link' }));

    expect(router.state.location.pathname).toBe('/esqueci-senha');
  });

  it('shows the support code, and keeps the form, when the API fails on its side', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/auth/reset-password`, () =>
        HttpResponse.json(
          apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-reset-1' }),
          { status: 500 },
        ),
      ),
    );
    renderResetPassword(LINK);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(await screen.findByText(/err-reset-1/)).toBeVisible();
    expect(screen.getByLabelText('Nova senha')).toHaveValue('uma senha nova longa');
  });

  it('disables the button while the request is on its way, so it cannot be sent twice', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    server.use(
      http.post(`${API}/auth/reset-password`, async () => {
        calls += 1;
        await gate;

        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderResetPassword(LINK);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    const saving = await screen.findByRole('button', { name: 'Salvando…' });

    expect(saving).toBeDisabled();
    await user.click(saving);
    release();

    await screen.findByText('Você está na tela de login.');
    expect(calls).toBe(1);
  });
});

describe('a link that arrives without its code', () => {
  it('does not show a form that could not work, and offers a new link', async () => {
    renderResetPassword('');

    expect(await screen.findByRole('heading', { name: 'Link incompleto' })).toBeVisible();
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Voltar para o login' })).toBeVisible();
  });

  it('treats something that cannot be a code the same way, without calling the API', async () => {
    // No handler is registered: a request would fail the test.
    renderResetPassword('#token=');

    expect(await screen.findByRole('heading', { name: 'Link incompleto' })).toBeVisible();
  });
});
