import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { CatalogCard } from './catalog-card';
import { CatalogGrid } from './catalog-grid';
import { CatalogPickerSheet, type CatalogOption } from './catalog-picker-sheet';

const FACTS = [
  { label: 'Preço', value: 'R$ 10,00', emphasis: true },
  { label: 'Estoque', value: '3 un' },
];

describe('CatalogCard', () => {
  it('is a link to where it goes, with the name as the one link and the figures beside it', () => {
    render(
      <MemoryRouter>
        <CatalogCard
          name="Vela de baunilha"
          imageUrl="https://img.example/vela.png"
          facts={FACTS}
          href="/fichas-tecnicas/vela"
          badges={<span>Selo</span>}
          footer="Atualizada hoje"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Vela de baunilha' })).toHaveAttribute(
      'href',
      '/fichas-tecnicas/vela',
    );
    expect(screen.getByRole('img', { name: 'Vela de baunilha' })).toHaveAttribute(
      'src',
      'https://img.example/vela.png',
    );
    expect(screen.getByText('Preço')).toBeInTheDocument();
    expect(screen.getByText('R$ 10,00')).toBeInTheDocument();
    expect(screen.getByText('Selo')).toBeInTheDocument();
    expect(screen.getByText('Atualizada hoje')).toBeInTheDocument();
  });

  it('is a button for what it does, and says so when it has no photo, never a broken image', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<CatalogCard name="Cera" imageUrl={null} facts={FACTS} onClick={onClick} />);

    expect(screen.getByRole('img', { name: 'Cera (sem foto)' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cera' }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('CatalogGrid', () => {
  it('is one named list with an item per card', () => {
    render(
      <CatalogGrid
        label="Fichas"
        items={['a', 'b', 'c']}
        getKey={(item) => item}
        renderItem={(item) => <p>{item}</p>}
      />,
    );

    const list = screen.getByRole('list', { name: 'Fichas' });

    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  });
});

describe('CatalogPickerSheet', () => {
  const OPTIONS: CatalogOption[] = [
    { id: '1', name: 'Essência baunilha', imageUrl: null, group: 'M', facts: FACTS },
    { id: '2', name: 'Cera de soja', imageUrl: null, group: 'M', facts: FACTS },
    { id: '3', name: 'Vela de baunilha', imageUrl: null, group: 'P', facts: FACTS },
  ];

  function renderPicker(onPick = vi.fn()) {
    render(
      <CatalogPickerSheet
        open
        onOpenChange={() => undefined}
        title="Adicionar"
        description="Escolha."
        searchLabel="Buscar"
        searchPlaceholder="Buscar…"
        listLabel="Opções"
        options={OPTIONS}
        groups={[
          { id: 'P', label: 'Produtos' },
          { id: 'M', label: 'Insumos' },
        ]}
        nothingToPick={{ title: 'Nada', description: 'Nada a escolher.' }}
        noun={{ one: 'item', many: 'itens' }}
        onPick={onPick}
      />,
    );

    return onPick;
  }

  it('opens on the first tab, counts each tab, and picks with a click on a card', async () => {
    const user = userEvent.setup();
    const onPick = renderPicker();

    const tabs = within(screen.getByRole('radiogroup', { name: 'Tipo de item' }));
    expect(tabs.getByRole('radio', { name: 'Produtos (1)' })).toBeChecked();
    expect(tabs.getByRole('radio', { name: 'Insumos (2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vela de baunilha' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cera de soja' })).not.toBeInTheDocument();

    await user.click(tabs.getByRole('radio', { name: 'Insumos (2)' }));
    await user.click(screen.getByRole('button', { name: 'Cera de soja' }));

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: '2', group: 'M' }));
  });

  it('searches inside the open tab, ignoring accents and case', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('radio', { name: 'Insumos (2)' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'ESSENCIA');

    expect(screen.getByRole('button', { name: 'Essência baunilha' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cera de soja' })).not.toBeInTheDocument();
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });
});
