import { z } from 'zod';

import { parseQuantityInput, type QuantityInputScale } from '@/shared/format';
import { Quantity, type ConsumptionUnit } from '@/shared/quantity';

import type { UpdateSaleDetailsRequestDto } from '../api/sale.dto';

import type { Sale } from './sale';

/**
 * The two edits a sale allows while its production is still pending: the
 * customer and payment method, and the quantity of one line. Neither touches a
 * price — a line keeps the fraction it was frozen with — so the total after an
 * edit is the API's answer and nothing is recalculated here.
 */

export interface SaleDetailsFormValues {
  customerName: string;
  customerContact: string;
  paymentMethod: string;
}

export function saleDetailsFormValuesFrom(sale: Sale): SaleDetailsFormValues {
  return {
    customerName: sale.customerName,
    customerContact: sale.customerContact ?? '',
    paymentMethod: sale.paymentMethod,
  };
}

export const saleDetailsSchema = z.object({
  customerName: z.string().trim().min(1, 'Informe o nome do cliente.'),
  customerContact: z.string(),
  paymentMethod: z.string().trim().min(1, 'Informe a forma de pagamento.'),
});

/**
 * Only what changed. A contact that was emptied is cleared with `null`; one
 * that was never there and still is not is left alone.
 */
export function buildDetailsPatch(
  values: SaleDetailsFormValues,
  original: Sale,
): UpdateSaleDetailsRequestDto {
  const patch: UpdateSaleDetailsRequestDto = {};
  const name = values.customerName.trim();
  const method = values.paymentMethod.trim();
  const contact = values.customerContact.trim() === '' ? null : values.customerContact.trim();

  if (name !== original.customerName) {
    patch.customerName = name;
  }

  if (contact !== original.customerContact) {
    patch.customerContact = contact;
  }

  if (method !== original.paymentMethod) {
    patch.paymentMethod = method;
  }

  return patch;
}

export function hasDetailsChanges(patch: UpdateSaleDetailsRequestDto): boolean {
  return Object.keys(patch).length > 0;
}

/** The quantity typed to change a line: greater than zero, or `null` while it cannot be read. */
export function readEditedQuantity(
  text: string,
  unit: ConsumptionUnit,
  scale: QuantityInputScale,
): Quantity | null {
  const quantity = parseQuantityInput(text, unit, scale);

  return quantity === null || quantity.compare(Quantity.zero(unit)) <= 0 ? null : quantity;
}
