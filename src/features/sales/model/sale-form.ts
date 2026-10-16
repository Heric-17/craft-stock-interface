import { z } from 'zod';

import {
  parseBasisPointsInput,
  parseQuantityInput,
  type QuantityInputScale,
} from '@/shared/format';
import { Money } from '@/shared/money';
import { CONSUMPTION_UNITS, Quantity, type ConsumptionUnit } from '@/shared/quantity';

import type { CreateSaleRequestDto } from '../api/sale.dto';

import type { PreviewLine } from './sale-preview';

/**
 * The new-sale form. Every number is a string, typed the way a person writes
 * it (`1,5`, `35`), and becomes a `Quantity` or whole basis points once, when
 * the form is read — never `valueAsNumber`, which would lose the decimal comma.
 *
 * **The margin of a loose material starts empty and stays a choice.** It is
 * required, and zero is accepted only when somebody types `0`: a sale priced
 * at cost by a field that was pre-filled looks, afterwards, exactly like one
 * priced on purpose. A product line has no margin at all — it carries the one
 * of its bill of materials — and the API refuses one sent for it.
 */

export type SaleLineKind = 'PRODUCT' | 'MATERIAL';

export interface SaleLineFormValues {
  kind: SaleLineKind;
  /** The product's or the material's id, according to `kind`. */
  refId: string;
  /** Kept with the line so it reads the same wherever the lists are still loading. */
  name: string;
  /** `UNIT` for a product: it is sold by the piece. A material's own unit otherwise. */
  consumptionUnit: ConsumptionUnit;
  quantity: string;
  /** Whether `quantity` is typed in the base unit or in kg / L / m. */
  scale: QuantityInputScale;
  /** The percentage as typed: `35`. Always empty for a product. */
  margin: string;
}

export interface SaleFormValues {
  customerName: string;
  customerContact: string;
  paymentMethod: string;
  items: SaleLineFormValues[];
}

export const EMPTY_SALE_FORM: SaleFormValues = {
  customerName: '',
  customerContact: '',
  paymentMethod: '',
  items: [],
};

/** A line for a product that was just picked: its quantity starts empty, never one. */
export function newProductLine(product: { id: string; name: string }): SaleLineFormValues {
  return {
    kind: 'PRODUCT',
    refId: product.id,
    name: product.name,
    consumptionUnit: 'UNIT',
    quantity: '',
    scale: 'base',
    margin: '',
  };
}

/** A line for a loose material: quantity and margin both start empty. */
export function newMaterialLine(material: {
  id: string;
  name: string;
  consumptionUnit: ConsumptionUnit;
}): SaleLineFormValues {
  return {
    kind: 'MATERIAL',
    refId: material.id,
    name: material.name,
    consumptionUnit: material.consumptionUnit,
    quantity: '',
    scale: 'base',
    margin: '',
  };
}

// -- Reading one field ------------------------------------------------------

export function readLineQuantity(line: SaleLineFormValues): Quantity | null {
  const quantity = parseQuantityInput(line.quantity, line.consumptionUnit, line.scale);

  return quantity === null || quantity.compare(Quantity.zero(line.consumptionUnit)) <= 0
    ? null
    : quantity;
}

/**
 * The margin typed, as whole basis points. `null` for an empty field, which is
 * *not* zero, and for text that cannot be read.
 */
export function readLineMargin(line: SaleLineFormValues): number | null {
  return line.margin.trim() === '' ? null : parseBasisPointsInput(line.margin);
}

// -- Reading the whole form -------------------------------------------------

const REQUIRED_CUSTOMER = 'Informe o nome do cliente.';
const REQUIRED_PAYMENT_METHOD = 'Informe a forma de pagamento.';
const REQUIRED_ITEMS = 'Adicione pelo menos um item à venda.';
const REQUIRED_QUANTITY = 'Informe a quantidade.';
const REQUIRED_MARGIN = 'Informe a margem. Digite 0 para vender a preço de custo.';
const UNREADABLE_QUANTITY =
  'Não entendi esse valor. Use números, com vírgula nos decimais e até 3 casas.';
const UNREADABLE_MARGIN =
  'Não entendi esse valor. A margem vai de 0 a 999,99, com até 2 casas decimais.';
const NOT_POSITIVE_QUANTITY = 'A quantidade precisa ser maior do que zero.';

export interface SaleFormIssue {
  /** The registered name of the field: `items.0.margin`, as an array. */
  path: (string | number)[];
  message: string;
}

export type ParsedSaleLine =
  | { kind: 'PRODUCT'; id: string; quantity: Quantity }
  | { kind: 'MATERIAL'; id: string; quantity: Quantity; marginBasisPoints: number };

export interface ParsedSaleForm {
  customerName: string;
  customerContact: string | null;
  paymentMethod: string;
  lines: ParsedSaleLine[];
}

export interface SaleFormReading {
  /** Present only when no field has an issue. */
  parsed: ParsedSaleForm | null;
  issues: SaleFormIssue[];
}

function quantityIssue(line: SaleLineFormValues): string {
  if (line.quantity.trim() === '') {
    return REQUIRED_QUANTITY;
  }

  return parseQuantityInput(line.quantity, line.consumptionUnit, line.scale) === null
    ? UNREADABLE_QUANTITY
    : NOT_POSITIVE_QUANTITY;
}

/**
 * Reads the whole form once and says everything that is wrong with it at the
 * same time. Whether the API accepts the sale is the API's to say; this only
 * refuses what cannot be read, and what is required.
 */
export function readSaleForm(values: SaleFormValues): SaleFormReading {
  const issues: SaleFormIssue[] = [];
  const customerName = values.customerName.trim();
  const paymentMethod = values.paymentMethod.trim();

  if (customerName === '') {
    issues.push({ path: ['customerName'], message: REQUIRED_CUSTOMER });
  }

  if (paymentMethod === '') {
    issues.push({ path: ['paymentMethod'], message: REQUIRED_PAYMENT_METHOD });
  }

  if (values.items.length === 0) {
    issues.push({ path: ['items'], message: REQUIRED_ITEMS });
  }

  const lines: ParsedSaleLine[] = [];

  values.items.forEach((line, index) => {
    const quantity = readLineQuantity(line);

    if (quantity === null) {
      issues.push({ path: ['items', index, 'quantity'], message: quantityIssue(line) });
    }

    if (line.kind === 'PRODUCT') {
      if (quantity !== null) {
        lines.push({ kind: 'PRODUCT', id: line.refId, quantity });
      }

      return;
    }

    const marginBasisPoints = readLineMargin(line);

    if (marginBasisPoints === null) {
      issues.push({
        path: ['items', index, 'margin'],
        message: line.margin.trim() === '' ? REQUIRED_MARGIN : UNREADABLE_MARGIN,
      });
    }

    if (quantity !== null && marginBasisPoints !== null) {
      lines.push({ kind: 'MATERIAL', id: line.refId, quantity, marginBasisPoints });
    }
  });

  if (issues.length > 0) {
    return { parsed: null, issues };
  }

  const contact = values.customerContact.trim();

  return {
    parsed: {
      customerName,
      customerContact: contact === '' ? null : contact,
      paymentMethod,
      lines,
    },
    issues,
  };
}

/** Zod owns the shape (everything is text) and carries the reading's issues to the fields they name. */
export const saleFormSchema = z
  .object({
    customerName: z.string(),
    customerContact: z.string(),
    paymentMethod: z.string(),
    items: z.array(
      z.object({
        kind: z.enum(['PRODUCT', 'MATERIAL']),
        refId: z.string(),
        name: z.string(),
        consumptionUnit: z.enum(CONSUMPTION_UNITS),
        quantity: z.string(),
        scale: z.enum(['base', 'major']),
        margin: z.string(),
      }),
    ),
  })
  .superRefine((values, ctx) => {
    for (const issue of readSaleForm(values).issues) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  });

// -- What goes to the API ---------------------------------------------------

/**
 * A new sale. An empty contact is left out: an optional field that was left
 * empty is absent, not an empty string. The margin goes only on a loose
 * material, and goes even when it is zero.
 */
export function buildCreateSaleRequest(form: ParsedSaleForm): CreateSaleRequestDto {
  return {
    customerName: form.customerName,
    ...(form.customerContact === null ? {} : { customerContact: form.customerContact }),
    paymentMethod: form.paymentMethod,
    items: form.lines.map((line) =>
      line.kind === 'PRODUCT'
        ? { compositeProductId: line.id, quantity: line.quantity.toApiNumber() }
        : {
            materialId: line.id,
            quantity: line.quantity.toApiNumber(),
            marginBasisPoints: line.marginBasisPoints,
          },
    ),
  };
}

// -- The preview the form shows ----------------------------------------------

export interface PreviewProduct {
  finalPrice: Money;
}

export interface PreviewMaterial {
  packageCost: Money;
  packageQuantity: Quantity;
}

/**
 * The form as the preview reads it: whatever can be read, `null` for what
 * cannot. A line whose product or material is not on the list yet has nothing
 * to be priced by, and no quantity is the same as no price.
 */
export function previewLinesFrom(
  values: SaleFormValues,
  products: ReadonlyMap<string, PreviewProduct>,
  materials: ReadonlyMap<string, PreviewMaterial>,
): PreviewLine[] {
  return values.items.map((line): PreviewLine => {
    if (line.kind === 'PRODUCT') {
      const product = products.get(line.refId);

      return product === undefined
        ? { kind: 'PRODUCT', finalPrice: Money.zero(), quantity: null }
        : { kind: 'PRODUCT', finalPrice: product.finalPrice, quantity: readLineQuantity(line) };
    }

    const material = materials.get(line.refId);

    return material === undefined
      ? {
          kind: 'MATERIAL',
          packageCost: Money.zero(),
          packageQuantity: Quantity.zero(line.consumptionUnit),
          marginBasisPoints: null,
          quantity: null,
        }
      : {
          kind: 'MATERIAL',
          packageCost: material.packageCost,
          packageQuantity: material.packageQuantity,
          marginBasisPoints: readLineMargin(line),
          quantity: readLineQuantity(line),
        };
  });
}
