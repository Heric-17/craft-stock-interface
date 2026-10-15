import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from './pagination';

function renderPagination(props: Partial<Parameters<typeof Pagination>[0]> = {}) {
  const onOffsetChange = vi.fn();

  render(
    <Pagination
      total={57}
      limit={20}
      offset={0}
      onOffsetChange={onOffsetChange}
      label="perdas"
      {...props}
    />,
  );

  return onOffsetChange;
}

describe('pagination', () => {
  it('says where you are in the whole filtered set, from `total`', () => {
    renderPagination({ offset: 20 });

    expect(screen.getByText('21–40 de 57')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Paginação de perdas' })).toBeInTheDocument();
  });

  it('cuts the last page at the total', () => {
    renderPagination({ offset: 40 });

    expect(screen.getByText('41–57 de 57')).toBeInTheDocument();
  });

  it('groups thousands like every other number on screen', () => {
    renderPagination({ total: 1284, offset: 1260 });

    expect(screen.getByText('1.261–1.280 de 1.284')).toBeInTheDocument();
  });

  it('cannot go back from the first page', () => {
    renderPagination({ offset: 0 });

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeEnabled();
  });

  it('cannot go forward from the last page, even when it is exactly full', () => {
    renderPagination({ total: 40, offset: 20 });

    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
  });

  it('moves by a whole page, as an offset', async () => {
    const user = userEvent.setup();
    const onOffsetChange = renderPagination({ offset: 20 });

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await user.click(screen.getByRole('button', { name: 'Anterior' }));

    expect(onOffsetChange).toHaveBeenNthCalledWith(1, 40);
    expect(onOffsetChange).toHaveBeenNthCalledWith(2, 0);
  });

  it('never goes below zero when the offset is not a whole page', async () => {
    const user = userEvent.setup();
    const onOffsetChange = renderPagination({ offset: 5 });

    await user.click(screen.getByRole('button', { name: 'Anterior' }));

    expect(onOffsetChange).toHaveBeenCalledWith(0);
  });

  it('holds both buttons while the next page loads', () => {
    renderPagination({ offset: 20, busy: true });

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
  });

  it('is nothing at all for an empty set', () => {
    renderPagination({ total: 0 });

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
