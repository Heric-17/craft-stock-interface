import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NON_BREAKING_SPACE } from '@/shared/format';
import {
  ACTIVITY_NOW,
  activityHandlers,
  apiErrorBody,
  auditEntryDto,
  perdaDeCera,
} from '@/test/fixtures/activity';
import { materialsHandlers } from '@/test/fixtures/materials';
import { server } from '@/test/msw/server';
import { renderActivity } from '@/test/render-activity';
import { VERBATIM } from '@/test/text';

const SPACE = NON_BREAKING_SPACE;

beforeEach(() => {
  // The day headings read today's date. Only the date is frozen: timers stay real,
  // so the network still answers.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(ACTIVITY_NOW));
  server.use(...materialsHandlers());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the activity feed', () => {
  it('groups the entries by day, newest first, under a heading for each', async () => {
    server.use(...activityHandlers());
    renderActivity();

    const today = within(await screen.findByRole('region', { name: 'Hoje' }));
    const yesterday = within(screen.getByRole('region', { name: 'Ontem' }));
    const lastYear = within(screen.getByRole('region', { name: '30 dez 2025' }));

    expect(today.getAllByRole('listitem')).toHaveLength(1);
    expect(yesterday.getAllByRole('listitem')).toHaveLength(2);
    expect(lastYear.getAllByRole('listitem')).toHaveLength(1);
    expect(today.getByText('14:32')).toBeVisible();

    // The headings come in the order of the feed.
    const headings = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);
    expect(headings).toEqual(['Hoje', 'Ontem', '30 dez 2025']);
  });

  it('writes the sentence from the structured entry, with the figures as money', async () => {
    server.use(...activityHandlers());
    renderActivity();

    expect(
      await screen.findByText(
        `Você alterou o custo da embalagem de Cera de soja de R$${SPACE}22,90 para R$${SPACE}24,50`,
        VERBATIM,
      ),
    ).toBeVisible();
  });

  it('says "Você" only for what the signed-in person did', async () => {
    server.use(...activityHandlers());
    renderActivity();

    expect(
      await screen.findByText(
        'Outra pessoa alterou o pagamento da venda de Maria de Pendente para Pago',
      ),
    ).toBeVisible();
    expect(screen.getByText(/^O sistema cadastrou o produto Vela de baunilha$/)).toBeVisible();
    expect(screen.getByText(/^Você alterou o custo da embalagem/)).toBeVisible();
  });

  it('names the material and the unit of a stock loss, which the trail leaves to the screen', async () => {
    server.use(...activityHandlers());
    renderActivity();

    expect(
      await screen.findByText(
        `Você registrou uma perda de 100${SPACE}g de Cera de soja (quebrou)`,
        VERBATIM,
      ),
    ).toBeVisible();
  });

  it('shows the lines of what changed under a sentence that names several fields', async () => {
    server.use(
      ...activityHandlers({
        entries: [
          auditEntryDto({
            entityType: 'Material',
            operation: 'UPDATE',
            changes: {
              packageCost: { old: '28', new: '30' },
              stockQuantity: { old: '680', new: '1500' },
            },
          }),
        ],
      }),
    );
    renderActivity();

    expect(
      await screen.findByText('Você alterou o custo da embalagem e o estoque de Cera de soja'),
    ).toBeVisible();
    expect(
      screen.getByText(`Custo da embalagem: de R$${SPACE}28,00 para R$${SPACE}30,00`, VERBATIM),
    ).toBeVisible();
    expect(screen.getByText(`Estoque: de 680${SPACE}g para 1,5${SPACE}kg`, VERBATIM)).toBeVisible();
  });

  it('never shows a name of the API, a storage key or a sentence of the backend', async () => {
    server.use(
      ...activityHandlers({
        entries: [
          auditEntryDto({
            entityType: 'Material',
            operation: 'UPDATE',
            changes: {
              imageKey: { old: null, new: '9d4e6f10-3a2b-4c5d-8e7f-0123456789ab.webp' },
              brandNewColumn: { old: 'a', new: 'b' },
            },
          }),
          auditEntryDto({
            entityType: 'SupplierContract',
            operation: 'UPDATE',
            entityLabel: null,
          }),
        ],
      }),
    );
    renderActivity();

    expect(await screen.findByText('Você adicionou a foto de Cera de soja')).toBeVisible();
    expect(screen.getByText('Você alterou um registro')).toBeVisible();

    const page = document.body.textContent ?? '';

    for (const raw of [
      'imageKey',
      'brandNewColumn',
      '9d4e6f10',
      'SupplierContract',
      'packageCost',
    ]) {
      expect(page).not.toContain(raw);
    }
  });

  it('counts the feed from the total of the API and asks only for the parameters it accepts', async () => {
    const urls: URL[] = [];
    server.use(...activityHandlers({ onRequest: (url) => urls.push(url) }));
    renderActivity();

    expect(await screen.findByText('4 atividades')).toBeVisible();
    expect(urls[0]?.searchParams.get('limit')).toBe('20');
    expect(urls[0]?.searchParams.get('offset')).toBe('0');
    expect([...(urls[0]?.searchParams.keys() ?? [])].sort()).toEqual(['limit', 'offset']);
  });

  it('goes to the next page and shows the heading of a day again where it continues', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 25 }, (_, index) =>
      auditEntryDto({
        entityType: 'Sale',
        operation: 'DELETE',
        entityLabel: `Cliente ${index + 1}`,
        occurredAt: '2026-10-12T10:00:00-03:00',
      }),
    );
    const urls: URL[] = [];
    server.use(...activityHandlers({ entries: many, onRequest: (url) => urls.push(url) }));
    renderActivity();

    expect(await screen.findByText('1–20 de 25')).toBeVisible();
    expect(screen.getByText('Você excluiu a venda de Cliente 1')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /Próxima/ }));

    expect(await screen.findByText('21–25 de 25')).toBeVisible();
    expect(screen.getByText('Você excluiu a venda de Cliente 21')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Hoje' })).toBeVisible();
    expect(urls.at(-1)?.searchParams.get('offset')).toBe('20');
  });

  it('says there is nothing yet, and what will show up here', async () => {
    server.use(...activityHandlers({ entries: [] }));
    renderActivity();

    expect(await screen.findByRole('heading', { name: 'Nada por aqui ainda' })).toBeVisible();
  });

  it('shows the support code when the feed fails, and loads again on request', async () => {
    const user = userEvent.setup();
    server.use(
      ...activityHandlers({
        failure: {
          status: 500,
          body: apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-activity-1' }),
        },
      }),
    );
    renderActivity();

    expect(
      await screen.findByRole('heading', { name: 'Não foi possível carregar as atividades' }),
    ).toBeVisible();
    expect(screen.getByText('err-activity-1')).toBeVisible();

    server.resetHandlers();
    server.use(...materialsHandlers(), ...activityHandlers());
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('region', { name: 'Hoje' })).toBeVisible();
  });

  it('keeps the sentences honest while the materials are not there: no unit, no figure', async () => {
    server.use(
      ...activityHandlers({ entries: [perdaDeCera] }),
      ...materialsHandlers({ materials: [] }),
    );
    renderActivity();

    expect(await screen.findByText('Você registrou uma perda de estoque (quebrou)')).toBeVisible();
  });
});
