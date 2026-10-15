import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { PeriodSelection } from '@/shared/format';

import { PeriodField } from './period-field';

/** The field with the state a screen would give it, reporting every selection it makes. */
function Harness({
  initial,
  onSelect,
}: {
  initial: PeriodSelection;
  onSelect: (selection: PeriodSelection) => void;
}) {
  const [value, setValue] = useState(initial);

  return (
    <PeriodField
      value={value}
      onChange={(next) => {
        setValue(next);
        onSelect(next);
      }}
    />
  );
}

describe('the period field', () => {
  it('offers the presets and a custom period', () => {
    render(<Harness initial={{ kind: 'preset', preset: 'THIS_MONTH' }} onSelect={vi.fn()} />);

    const options = screen.getAllByRole('option').map((option) => option.textContent);

    expect(options).toEqual(['Este mês', 'Últimos 6 meses', 'Últimos 12 meses', 'Personalizado']);
    expect(screen.getByLabelText('Período')).toHaveValue('THIS_MONTH');
  });

  it('reports the preset that was chosen, as the choice and never as an instant', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness initial={{ kind: 'preset', preset: 'THIS_MONTH' }} onSelect={onSelect} />);

    await user.selectOptions(screen.getByLabelText('Período'), 'LAST_6_MONTHS');

    expect(onSelect).toHaveBeenCalledWith({ kind: 'preset', preset: 'LAST_6_MONTHS' });
  });

  it('shows no date fields for a preset', () => {
    render(<Harness initial={{ kind: 'preset', preset: 'THIS_MONTH' }} onSelect={vi.fn()} />);

    expect(screen.queryByLabelText('De')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Até')).not.toBeInTheDocument();
  });

  it('opens two empty days for a custom period, never filled in for the person', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ kind: 'preset', preset: 'THIS_MONTH' }} onSelect={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Período'), 'CUSTOM');

    expect(screen.getByLabelText('De')).toHaveValue('');
    expect(screen.getByLabelText('Até')).toHaveValue('');
    expect(screen.getByLabelText('De')).toHaveAttribute('type', 'date');
  });

  it('reports the two days as typed', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness initial={{ kind: 'custom' }} onSelect={onSelect} />);

    await user.type(screen.getByLabelText('De'), '2026-01-01');
    await user.type(screen.getByLabelText('Até'), '2026-01-31');

    expect(onSelect).toHaveBeenLastCalledWith({
      kind: 'custom',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
  });

  it('says so, on the field, when the end comes before the start', () => {
    render(
      <Harness
        initial={{ kind: 'custom', startDate: '2026-02-01', endDate: '2026-01-31' }}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('A data final vem antes da inicial.');
    expect(screen.getByLabelText('De')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Até')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not complain about a period that is still being typed', () => {
    render(<Harness initial={{ kind: 'custom', startDate: '2026-02-01' }} onSelect={vi.fn()} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('goes back to a preset and drops the days', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{ kind: 'custom', startDate: '2026-01-01', endDate: '2026-01-31' }}
        onSelect={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Período'), 'THIS_MONTH');

    expect(screen.queryByLabelText('De')).not.toBeInTheDocument();
  });
});
