import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { PHONE_WIDTH, setViewportWidth, TABLET_WIDTH } from '@/test/viewport';

import { DataTable, type DataTableColumn } from './data-table';

interface Row {
  id: string;
  name: string;
  stock: string;
  status: string;
  note: string;
}

const rows: Row[] = [
  { id: 'a1', name: 'Cera de soja', stock: '680 g', status: 'Saudável', note: 'interno' },
  { id: 'b2', name: 'Essência baunilha', stock: '18 ml', status: 'Estoque baixo', note: 'interno' },
];

const columns: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Insumo', role: 'primary', cell: (row) => row.name },
  { id: 'stock', header: 'Estoque atual', cell: (row) => row.stock },
  { id: 'status', header: 'Situação', cell: (row) => row.status },
  { id: 'note', header: 'Anotação', role: 'desktop-only', cell: (row) => row.note },
];

function renderTable(withLinks = true) {
  return render(
    <MemoryRouter>
      <DataTable
        caption="Insumos cadastrados"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        getRowHref={withLinks ? (row) => `/insumos/${row.id}` : undefined}
      />
    </MemoryRouter>,
  );
}

describe('DataTable on a desktop', () => {
  it('renders a table with a header for every column and a row for every item', () => {
    renderTable();

    const table = screen.getByRole('table', { name: 'Insumos cadastrados' });
    const headers = within(table).getAllByRole('columnheader');

    expect(headers.map((header) => header.textContent)).toEqual([
      'Insumo',
      'Estoque atual',
      'Situação',
      'Anotação',
      'Abrir',
    ]);
    // The header row plus one per item.
    expect(within(table).getAllByRole('row')).toHaveLength(rows.length + 1);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('links the whole row through its primary cell', () => {
    renderTable();

    expect(screen.getByRole('link', { name: 'Cera de soja' })).toHaveAttribute(
      'href',
      '/insumos/a1',
    );
    expect(screen.getAllByRole('link')).toHaveLength(rows.length);
  });

  it('draws a plain row, with no link, when the table is not navigable', () => {
    renderTable(false);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Cera de soja')).toBeInTheDocument();
  });
});

describe('DataTable on a narrow screen', () => {
  it('renders cards instead of a table', () => {
    setViewportWidth(PHONE_WIDTH);
    renderTable();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Insumos cadastrados' });

    expect(within(list).getAllByRole('listitem')).toHaveLength(rows.length);
  });

  it('puts each value under its own label inside the card', () => {
    setViewportWidth(PHONE_WIDTH);
    renderTable();

    const [first] = screen.getAllByRole('listitem');
    const card = within(first!);

    expect(card.getByRole('link', { name: 'Cera de soja' })).toHaveAttribute('href', '/insumos/a1');
    expect(card.getByText('Estoque atual')).toBeInTheDocument();
    expect(card.getByText('680 g')).toBeInTheDocument();
    expect(card.getByText('Situação')).toBeInTheDocument();
    expect(card.getByText('Saudável')).toBeInTheDocument();
  });

  it('leaves the desktop-only columns out of the card', () => {
    setViewportWidth(PHONE_WIDTH);
    renderTable();

    expect(screen.queryByText('Anotação')).not.toBeInTheDocument();
    expect(screen.queryByText('interno')).not.toBeInTheDocument();
  });

  it('is cards just below the breakpoint and a table at it', () => {
    setViewportWidth(TABLET_WIDTH - 1);
    const { unmount } = renderTable();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    unmount();

    setViewportWidth(TABLET_WIDTH);
    renderTable();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('switches shape when the window is resized, without remounting the screen', () => {
    setViewportWidth(PHONE_WIDTH);
    renderTable();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    setViewportWidth(1280);

    return screen.findByRole('table');
  });
});
