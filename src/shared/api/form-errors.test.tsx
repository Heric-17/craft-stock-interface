import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { env } from '@/shared/config/env';
import { TextField } from '@/shared/ui/text-field';
import { server } from '@/test/msw/server';
import { probeRequest } from '@/test/probe-request';

import { applyApiErrorToForm } from './form-errors';

const API = env.VITE_API_URL;

interface ProductForm {
  name: string;
  billOfMaterials: { quantity: string }[];
}

/**
 * A form shaped like the ficha técnica: a name, and a list of items each with a
 * quantity — the nested path the API reports is `billOfMaterials.0.quantity`.
 */
function ProductFormUnderTest({ onUnexpected }: { onUnexpected?: (handled: boolean) => void }) {
  const { register, handleSubmit, setError, formState } = useForm<ProductForm>({
    defaultValues: { name: '', billOfMaterials: [{ quantity: '' }, { quantity: '' }] },
  });

  const submit = handleSubmit(async () => {
    try {
      await probeRequest('/composite-products', { method: 'POST', body: {}, public: true });
    } catch (error) {
      const handled = applyApiErrorToForm(error, setError);
      onUnexpected?.(handled);
    }
  });

  return (
    <form onSubmit={(event) => void submit(event)}>
      <TextField label="Nome" error={formState.errors.name?.message} {...register('name')} />
      <TextField
        label="Quantidade do item 1"
        error={formState.errors.billOfMaterials?.[0]?.quantity?.message}
        {...register('billOfMaterials.0.quantity')}
      />
      <TextField
        label="Quantidade do item 2"
        error={formState.errors.billOfMaterials?.[1]?.quantity?.message}
        {...register('billOfMaterials.1.quantity')}
      />
      {formState.errors.root?.api?.message === undefined ? null : (
        <p role="alert">{formState.errors.root.api.message}</p>
      )}
      <button type="submit">Salvar</button>
    </form>
  );
}

function answerWith(status: number, body: Record<string, unknown>) {
  server.use(http.post(`${API}/composite-products`, () => HttpResponse.json(body, { status })));
}

describe('applyApiErrorToForm', () => {
  it('puts a nested violation on the field the path names, and on no other', async () => {
    answerWith(400, {
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      error: 'ValidationFailedError',
      message: 'Validation failed',
      details: [{ path: 'billOfMaterials.1.quantity', constraints: ['quantity must be positive'] }],
    });
    const user = userEvent.setup();
    render(<ProductFormUnderTest />);

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await vi.waitFor(() =>
      expect(screen.getByLabelText('Quantidade do item 2')).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(screen.getByLabelText('Quantidade do item 1')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Nome')).not.toHaveAttribute('aria-invalid');
  });

  it('marks every field the API names, and says what to do on the form as a whole', async () => {
    answerWith(400, {
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      error: 'ValidationFailedError',
      message: 'Validation failed',
      details: [
        { path: 'name', constraints: ['name should not be empty'] },
        { path: 'billOfMaterials.0.quantity', constraints: ['quantity must be positive'] },
      ],
    });
    const user = userEvent.setup();
    render(<ProductFormUnderTest />);

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Confira os campos destacados');
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Quantidade do item 1')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a sentence in Portuguese under the field, never the API English', async () => {
    answerWith(400, {
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      error: 'ValidationFailedError',
      message: 'Validation failed',
      details: [{ path: 'name', constraints: ['name should not be empty'] }],
    });
    const user = userEvent.setup();
    render(<ProductFormUnderTest />);

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Confira este campo.');
    expect(screen.queryByText(/should not be empty/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Validation failed/i)).not.toBeInTheDocument();
  });

  it('keeps a violation reported as a bare sentence as the form-level message', async () => {
    answerWith(400, {
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      error: 'ValidationFailedError',
      message: 'Validation failed',
      details: ['something is wrong'],
    });
    const user = userEvent.setup();
    render(<ProductFormUnderTest />);

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Confira os campos destacados');
    expect(screen.queryByText(/something is wrong/)).not.toBeInTheDocument();
  });

  it('takes a domain refusal as the form-level message from the map keyed by code', async () => {
    answerWith(422, {
      statusCode: 422,
      code: 'UNKNOWN_MATERIAL_REFERENCE',
      error: 'UnknownMaterialReferenceError',
      message: 'Material x does not exist.',
    });
    const user = userEvent.setup();
    render(<ProductFormUnderTest />);

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A ficha técnica aponta para um insumo que não existe.',
    );
  });

  it('leaves an unexpected failure to the caller, since it has nothing to do with what was typed', async () => {
    answerWith(500, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      error: 'InternalServerError',
      message: 'Internal server error',
      errorId: 'err-1',
    });
    let handled: boolean | undefined;
    const user = userEvent.setup();
    render(
      <ProductFormUnderTest
        onUnexpected={(value) => {
          handled = value;
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await vi.waitFor(() => expect(handled).toBe(false));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
