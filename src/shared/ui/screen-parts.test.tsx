import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Boxes } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './confirm-dialog';
import { EmptyState } from './empty-state';
import { LoadingSkeleton } from './loading-skeleton';
import { PageHeader } from './page-header';
import { StatCard } from './stat-card';
import { StatusBadge } from './status-badge';

describe('PageHeader', () => {
  it('shows eyebrow, title, description and actions', () => {
    render(
      <PageHeader
        eyebrow="Estoque"
        title="Insumos"
        description="Acompanhe tudo o que entra e sai da sua produção."
        actions={<button type="button">Novo insumo</button>}
      />,
    );

    expect(screen.getByText('Estoque')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Insumos', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Acompanhe tudo o que entra e sai da sua produção.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Novo insumo' })).toBeInTheDocument();
  });

  it('needs only a title', () => {
    render(<PageHeader title="Vendas" />);

    expect(screen.getByRole('heading', { name: 'Vendas' })).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('shows the label, the finished value and the caption', () => {
    render(<StatCard label="Abaixo do mínimo" value="3" caption="Requer atenção" icon={Boxes} />);

    expect(screen.getByText('Abaixo do mínimo')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Requer atenção')).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('carries its meaning in the word, not in the colour', () => {
    render(<StatusBadge tone="warning">Estoque baixo</StatusBadge>);

    expect(screen.getByText('Estoque baixo')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('says what is missing and offers the way out', () => {
    render(
      <EmptyState
        icon={Boxes}
        title="Nenhum insumo cadastrado"
        description="Cadastre o primeiro para começar."
        action={<button type="button">Novo insumo</button>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Nenhum insumo cadastrado' })).toBeInTheDocument();
    expect(screen.getByText('Cadastre o primeiro para começar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo insumo' })).toBeInTheDocument();
  });
});

describe('LoadingSkeleton', () => {
  it.each(['table', 'cards', 'form'] as const)(
    'announces loading once for the %s variant, and hides the pieces',
    (variant) => {
      const { container } = render(<LoadingSkeleton variant={variant} />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-busy', 'true');
      expect(within(status).getByText('Carregando…')).toBeInTheDocument();
      // Every drawn piece is hidden from assistive technology.
      expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
      for (const piece of container.querySelectorAll('[data-slot="skeleton"]')) {
        expect(piece.closest('[aria-hidden="true"]')).not.toBeNull();
      }
    },
  );

  it('draws as many items as asked', () => {
    const { container } = render(<LoadingSkeleton variant="cards" count={2} />);

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2 * 3);
  });
});

describe('ConfirmDialog', () => {
  function Harness({ onConfirm, pending = false }: { onConfirm: () => void; pending?: boolean }) {
    const [open, setOpen] = useState(true);

    return (
      <>
        <span>{open ? 'aberto' : 'fechado'}</span>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Marcar como montado?"
          description="O estoque dos insumos será debitado."
          confirmLabel="Marcar como montado"
          pending={pending}
          onConfirm={onConfirm}
        />
      </>
    );
  }

  it('says what will happen, and asks', () => {
    render(<Harness onConfirm={vi.fn()} />);

    const dialog = screen.getByRole('alertdialog', { name: 'Marcar como montado?' });
    expect(within(dialog).getByText('O estoque dos insumos será debitado.')).toBeInTheDocument();
  });

  it('does not close itself on confirm: the caller closes it when the mutation succeeds', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Marcar como montado' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('aberto')).toBeInTheDocument();
  });

  it('closes on cancel and on Escape without confirming', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const { unmount } = render(<Harness onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    unmount();

    render(<Harness onConfirm={onConfirm} />);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('blocks a second confirmation while the request is in flight, and cannot be dismissed', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} pending />);

    expect(screen.getByRole('button', { name: 'Aguarde…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    await user.keyboard('{Escape}');

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
