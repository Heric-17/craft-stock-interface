import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { NON_BREAKING_SPACE, readMoneyField, readQuantityField } from '@/shared/format';
import type { Money } from '@/shared/money';
import type { Quantity } from '@/shared/quantity';

import { VERBATIM } from '@/test/text';

import { MoneyField } from './money-field';
import { QuantityField } from './quantity-field';

/** A field the way a screen uses it: the text lives in the parent, as a string. */
function GramsField({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);

  return <QuantityField label="Quantidade" unit="GRAM" value={value} onChange={setValue} />;
}

/** The echo's text, matched character for character: the unit is joined by a non-breaking space. */
function reading(text: string) {
  return screen.getByText(text, VERBATIM);
}

function echo() {
  return document.querySelector('[aria-live="polite"]')!;
}

describe('QuantityField echo', () => {
  it('reads 1.500 in grams as 1,5 g: a lone dot is a decimal point, and the echo says so', async () => {
    const user = userEvent.setup();
    render(<GramsField />);

    await user.type(screen.getByLabelText('Quantidade'), '1.500');

    expect(echo().textContent).toBe(`Entendido como 1,5${NON_BREAKING_SPACE}g`);
    expect(reading(`1,5${NON_BREAKING_SPACE}g`)).toBeInTheDocument();
  });

  it('reads 0,145 as 0,145 g', async () => {
    const user = userEvent.setup();
    render(<GramsField />);

    await user.type(screen.getByLabelText('Quantidade'), '0,145');

    expect(reading(`0,145${NON_BREAKING_SPACE}g`)).toBeInTheDocument();
  });

  it('reads 1500 as 1,5 kg: from a thousand the display moves to the larger unit', async () => {
    const user = userEvent.setup();
    render(<GramsField />);

    await user.type(screen.getByLabelText('Quantidade'), '1500');

    expect(reading(`1,5${NON_BREAKING_SPACE}kg`)).toBeInTheDocument();
  });

  it('keeps grouping when a comma settles the reading, and never rounds the echo: 1.500,5 is 1.500,5 g', async () => {
    const user = userEvent.setup();
    render(<GramsField />);

    await user.type(screen.getByLabelText('Quantidade'), '1.500,5');

    // 1,5005 kg would round to 1,501 kg, a gram more than was typed: the echo stays in grams.
    expect(reading(`1.500,5${NON_BREAKING_SPACE}g`)).toBeInTheDocument();
  });

  it.each(['abc', '1,2,3', '1e3', ',5', '1,', '--1'])(
    'shows no echo for the invalid %p',
    async (text) => {
      const user = userEvent.setup();
      render(<GramsField />);

      await user.type(screen.getByLabelText('Quantidade'), text);

      expect(echo()).toBeEmptyDOMElement();
      expect(screen.queryByText(/entendido como/i)).not.toBeInTheDocument();
    },
  );

  it('shows no echo while the field is empty, and drops it when the text is cleared', async () => {
    const user = userEvent.setup();
    render(<GramsField />);
    const input = screen.getByLabelText('Quantidade');

    expect(echo()).toBeEmptyDOMElement();

    await user.type(input, '250');
    expect(reading(`250${NON_BREAKING_SPACE}g`)).toBeInTheDocument();

    await user.clear(input);
    expect(echo()).toBeEmptyDOMElement();
  });

  it('ties the echo to the field for assistive technology', async () => {
    const user = userEvent.setup();
    render(<GramsField />);
    const input = screen.getByLabelText('Quantidade');

    expect(input).not.toHaveAttribute('aria-describedby');

    await user.type(input, '12');

    expect(input).toHaveAccessibleDescription(`Entendido como 12${NON_BREAKING_SPACE}g`);
  });

  it('is a text field with a decimal keypad, never type=number', () => {
    render(<GramsField />);
    const input = screen.getByLabelText('Quantidade');

    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });

  it('puts the unit in the field and reads a kg field as the larger unit', async () => {
    const user = userEvent.setup();
    function KilosField() {
      const [value, setValue] = useState('');

      return (
        <QuantityField label="Peso" unit="GRAM" scale="major" value={value} onChange={setValue} />
      );
    }
    render(<KilosField />);

    await user.type(screen.getByLabelText('Peso'), '1,5');

    // 1,5 typed in a kg field is 1500 g, shown as the 1,5 kg the person meant.
    expect(reading(`1,5${NON_BREAKING_SPACE}kg`)).toBeInTheDocument();
    expect(screen.getByText('kg')).toBeInTheDocument();
  });

  it('shows the error the form gives it, beside the echo', () => {
    const { rerender } = render(
      <QuantityField label="Quantidade" unit="GRAM" value="" onChange={vi.fn()} />,
    );

    rerender(
      <QuantityField
        label="Quantidade"
        unit="GRAM"
        value="5"
        onChange={vi.fn()}
        error="Informe uma quantidade maior que zero."
      />,
    );

    const input = screen.getByLabelText('Quantidade');
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription(
      `Entendido como 5${NON_BREAKING_SPACE}g Informe uma quantidade maior que zero.`,
    );
  });
});

describe('the value sent is the value the echo showed', () => {
  interface FormValues {
    amount: string;
    price: string;
  }

  interface Submitted {
    quantity: Quantity | null;
    money: Money | null;
  }

  /** The way a real form wires it: RHF holds the text, the submit reads it once. */
  function Form({ onSubmit }: { onSubmit: (submitted: Submitted) => void }) {
    const { control, handleSubmit } = useForm<FormValues>({
      defaultValues: { amount: '', price: '' },
    });

    const submit = handleSubmit((values) =>
      onSubmit({
        quantity: readQuantityField(values.amount, 'GRAM')?.value ?? null,
        money: readMoneyField(values.price)?.value ?? null,
      }),
    );

    return (
      <form onSubmit={(event) => void submit(event)}>
        <Controller
          name="amount"
          control={control}
          render={({ field }) => <QuantityField {...field} label="Quantidade" unit="GRAM" />}
        />
        <Controller
          name="price"
          control={control}
          render={({ field }) => <MoneyField {...field} label="Preço" />}
        />
        <button type="submit">Salvar</button>
      </form>
    );
  }

  it.each([
    ['1.500', 1.5, `1,5${NON_BREAKING_SPACE}g`],
    ['0,145', 0.145, `0,145${NON_BREAKING_SPACE}g`],
    ['1500', 1500, `1,5${NON_BREAKING_SPACE}kg`],
    ['2,5', 2.5, `2,5${NON_BREAKING_SPACE}g`],
    ['1.234.567', 1_234_567, `1.234,567${NON_BREAKING_SPACE}kg`],
  ])('sends what the echo showed for %p', async (typed, expectedNumber, expectedEcho) => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(submitted: Submitted) => void>();
    render(<Form onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Quantidade'), typed);
    const shown = screen.getByText(/g$/, {
      selector: '[aria-live="polite"] span.font-bold',
    }).textContent;
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(shown).toBe(expectedEcho);
    const sent = onSubmit.mock.calls[0]![0].quantity!;
    // The payload number is read back through the same formatter the echo uses.
    expect(sent.toApiNumber()).toBe(expectedNumber);
    expect(readQuantityField(typed, 'GRAM')?.display).toBe(shown);
  });

  it('sends the cents the money echo showed', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(submitted: Submitted) => void>();
    render(<Form onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Preço'), '1.284,7');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(reading(`R$${NON_BREAKING_SPACE}1.284,70`)).toBeInTheDocument();
    expect(onSubmit.mock.calls[0]![0].money?.toCentsString()).toBe('1284.70');
  });

  it('sends nothing for a field with no echo', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(submitted: Submitted) => void>();
    render(<Form onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Quantidade'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit.mock.calls[0]![0]).toEqual({ quantity: null, money: null });
  });
});

describe('MoneyField echo', () => {
  function PriceField({ initial = '' }: { initial?: string }) {
    const [value, setValue] = useState(initial);

    return <MoneyField label="Preço" value={value} onChange={setValue} />;
  }

  it('reads 1.284 as R$ 1.284,00: an amount has no third decimal place, so it is grouping', async () => {
    const user = userEvent.setup();
    render(<PriceField />);

    await user.type(screen.getByLabelText('Preço'), '1.284');

    expect(reading(`R$${NON_BREAKING_SPACE}1.284,00`)).toBeInTheDocument();
  });

  it('reads 28,5 as R$ 28,50', async () => {
    const user = userEvent.setup();
    render(<PriceField />);

    await user.type(screen.getByLabelText('Preço'), '28,5');

    expect(reading(`R$${NON_BREAKING_SPACE}28,50`)).toBeInTheDocument();
  });

  it('shows no echo for a third decimal place: it is refused, not rounded behind the typed digits', async () => {
    const user = userEvent.setup();
    render(<PriceField />);

    await user.type(screen.getByLabelText('Preço'), '1,005');

    expect(screen.queryByText(/entendido como/i)).not.toBeInTheDocument();
  });

  it('shows no echo for an empty or invalid field', async () => {
    const user = userEvent.setup();
    render(<PriceField />);

    expect(echo()).toBeEmptyDOMElement();
    await user.type(screen.getByLabelText('Preço'), 'dez');
    expect(echo()).toBeEmptyDOMElement();
  });

  it('is a decimal-keypad text field', () => {
    render(<PriceField />);

    expect(screen.getByLabelText('Preço')).toHaveAttribute('inputmode', 'decimal');
    expect(screen.getByLabelText('Preço')).toHaveAttribute('type', 'text');
  });
});
