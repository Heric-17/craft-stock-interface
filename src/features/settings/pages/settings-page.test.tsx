import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { marina } from '@/test/auth';
import { apiErrorBody } from '@/test/fixtures/materials';
import { server } from '@/test/msw/server';
import { renderSettings } from '@/test/render-settings';

const API = env.VITE_API_URL;

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

/** `POST /auth/change-password`, remembering what it was sent, answering 204 like the API. */
function passwordChanged(received: ChangePasswordBody[]) {
  return http.post(`${API}/auth/change-password`, async ({ request }) => {
    received.push((await request.json()) as ChangePasswordBody);

    return new HttpResponse(null, { status: 204 });
  });
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  values: { current?: string; next?: string; confirm?: string } = {},
) {
  const { current = 'a senha de hoje', next = 'uma senha nova longa' } = values;
  const { confirm = next } = values;

  await user.type(screen.getByLabelText('Senha atual'), current);
  await user.type(screen.getByLabelText('Nova senha'), next);
  await user.type(screen.getByLabelText('Repita a nova senha'), confirm);
}

/** The block of the screen with this title: a titled section is found by its heading. */
async function sectionOf(title: string) {
  const heading = await screen.findByRole('heading', { name: title });
  const section = heading.closest('section');

  if (section === null) {
    throw new Error(`The heading "${title}" is not inside a section.`);
  }

  return within(section);
}

describe('the account', () => {
  it('shows who is signed in from the session, without asking the API', async () => {
    // No handler is registered: a request for the user would fail the test.
    renderSettings();

    const account = await sectionOf('Sua conta');

    expect(account.getByText(marina.name)).toBeVisible();
    expect(account.getByText(marina.email)).toBeVisible();
  });

  it('says which build this is and which API it talks to', async () => {
    renderSettings();

    const about = await sectionOf('Sobre');

    expect(about.getByText(env.VITE_API_URL)).toBeVisible();
    expect(about.getByText(env.VITE_COMPANY_NAME)).toBeVisible();
    // The version is the one in package.json, put in by the build.
    expect(about.getByText(/^\d+\.\d+\.\d+/)).toBeVisible();
  });

  it('no longer offers to register another person: one login serves the whole installation', async () => {
    renderSettings();

    await sectionOf('Sua conta');

    expect(screen.queryByRole('heading', { name: 'Cadastrar usuário' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
  });
});

describe('changing the password', () => {
  it('warns, before anything is sent, that the other devices will be signed out', async () => {
    renderSettings();

    const section = await sectionOf('Alterar senha');

    expect(
      section.getByText(/continua conectado neste aparelho e é desconectado dos outros/),
    ).toBeVisible();
  });

  it('sends both passwords as typed, tells the person it worked and clears the form', async () => {
    const user = userEvent.setup();
    const received: ChangePasswordBody[] = [];
    server.use(passwordChanged(received));
    renderSettings();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(
      await screen.findByText('Senha alterada. Nos outros aparelhos, será preciso entrar de novo.'),
    ).toBeVisible();
    expect(received).toEqual([
      { currentPassword: 'a senha de hoje', newPassword: 'uma senha nova longa' },
    ]);
    expect(screen.getByLabelText('Senha atual')).toHaveValue('');
    expect(screen.getByLabelText('Nova senha')).toHaveValue('');
    expect(screen.getByLabelText('Repita a nova senha')).toHaveValue('');
  });

  it('puts a wrong current password on that field, focuses it and keeps the rest typed', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/auth/change-password`, () =>
        HttpResponse.json(apiErrorBody(422, 'INVALID_CURRENT_PASSWORD'), { status: 422 }),
      ),
    );
    renderSettings();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    const current = screen.getByLabelText('Senha atual');

    expect(await screen.findByText('A senha atual não confere.')).toBeVisible();
    expect(current).toHaveAttribute('aria-invalid', 'true');
    expect(current).toHaveFocus();
    expect(screen.getByLabelText('Nova senha')).toHaveValue('uma senha nova longa');
    expect(screen.getByRole('button', { name: 'Alterar senha' })).toBeEnabled();
  });

  it('lets the person correct the current password and change it', async () => {
    const user = userEvent.setup();
    const received: ChangePasswordBody[] = [];
    let attempts = 0;
    server.use(
      http.post(`${API}/auth/change-password`, async ({ request }) => {
        attempts += 1;

        if (attempts === 1) {
          return HttpResponse.json(apiErrorBody(422, 'INVALID_CURRENT_PASSWORD'), { status: 422 });
        }

        received.push((await request.json()) as ChangePasswordBody);

        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderSettings();

    await fillForm(user, { current: 'senha errada' });
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));
    await screen.findByText('A senha atual não confere.');

    await user.clear(screen.getByLabelText('Senha atual'));
    await user.type(screen.getByLabelText('Senha atual'), 'a senha de hoje');
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(await screen.findByText(/Senha alterada\./)).toBeVisible();
    expect(received[0]?.currentPassword).toBe('a senha de hoje');
  });

  it('does not call the API when the two new passwords differ, and says so on the second field', async () => {
    const user = userEvent.setup();
    const received: ChangePasswordBody[] = [];
    server.use(passwordChanged(received));
    renderSettings();

    await fillForm(user, { next: 'uma senha nova longa', confirm: 'outra senha nova longa' });
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(await screen.findByText('As senhas não são iguais.')).toBeVisible();
    expect(received).toEqual([]);
  });

  it('does not call the API with a new password under eight characters', async () => {
    const user = userEvent.setup();
    const received: ChangePasswordBody[] = [];
    server.use(passwordChanged(received));
    renderSettings();

    await fillForm(user, { next: '1234567' });
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(await screen.findByText('A senha precisa ter pelo menos 8 caracteres.')).toBeVisible();
    expect(received).toEqual([]);
  });

  it('does not call the API when the new password is the current one', async () => {
    const user = userEvent.setup();
    const received: ChangePasswordBody[] = [];
    server.use(passwordChanged(received));
    renderSettings();

    await fillForm(user, { current: 'a mesma senha', next: 'a mesma senha' });
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(await screen.findByText('A nova senha precisa ser diferente da atual.')).toBeVisible();
    expect(received).toEqual([]);
  });

  it('marks the field the API named when it refuses the shape of one', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/auth/change-password`, () =>
        HttpResponse.json(
          apiErrorBody(400, 'VALIDATION_FAILED', [
            { path: 'newPassword', constraints: { minLength: 'newPassword is too short' } },
          ]),
          { status: 400 },
        ),
      ),
    );
    renderSettings();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(await screen.findByText('Confira este campo.')).toBeVisible();
    expect(screen.getByLabelText('Nova senha')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the support code, not the form, when the API fails on its side', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/auth/change-password`, () =>
        HttpResponse.json(
          apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-password-1' }),
          { status: 500 },
        ),
      ),
    );
    renderSettings();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(await screen.findByText(/err-password-1/)).toBeVisible();
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
      http.post(`${API}/auth/change-password`, async () => {
        calls += 1;
        await gate;

        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderSettings();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    const sending = await screen.findByRole('button', { name: 'Alterando…' });

    expect(sending).toBeDisabled();
    await user.click(sending);
    release();

    expect(await screen.findByText(/Senha alterada\./)).toBeVisible();
    expect(calls).toBe(1);
  });
});
