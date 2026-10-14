import { z } from 'zod';

import {
  formatBasisPoints,
  moneyInputText,
  parseBasisPointsInput,
  parseCentsInput,
  parseQuantityInput,
  quantityInputText,
  type QuantityInputScale,
} from '@/shared/format';
import { Money } from '@/shared/money';
import { CONSUMPTION_UNITS, Quantity, type ConsumptionUnit } from '@/shared/quantity';

import type {
  CreateCompositeProductRequestDto,
  UpdateCompositeProductRequestDto,
} from '../api/composite-product.dto';

import type { ManualPriceDraft, PricingDraft } from './bom-preview';
import type { CompositeProduct } from './composite-product';

/**
 * The editor's form. Every number is a string, typed the way a person writes
 * it (`1,5`, `33,33`), and is turned into `Money`, `Quantity` or basis points
 * once, when the form is read — never `valueAsNumber`, which would lose the
 * decimal comma and then the digits.
 *
 * The margin is typed as the percentage it is. The whole number of basis
 * points the API carries appears only at the edge, in {@link readMargin} and
 * in `formatBasisPoints`, and nobody is ever asked for `3333`.
 *
 * A required field starts empty. Nothing is pre-filled with zero to make the
 * form look finished: a product with no margin and no fixed cost is a choice
 * the person makes by typing `0`.
 */

/** One line of the bill, as the form holds it. */
export interface BomLineFormValues {
  materialId: string;
  /** Kept with the line so it reads the same wherever the materials list is still loading. */
  materialName: string;
  /** The material's own unit: the quantity is typed in it, and it cannot differ per line. */
  consumptionUnit: ConsumptionUnit;
  quantity: string;
  /** Whether `quantity` is typed in the base unit or in kg / L / m. */
  scale: QuantityInputScale;
}

export interface CompositeProductFormValues {
  name: string;
  description: string;
  fixedOperationalCost: string;
  /** The percentage as typed: `33,33`. */
  profitMargin: string;
  /** Empty means no manual price, not zero. */
  manualPrice: string;
  billOfMaterials: BomLineFormValues[];
}

export const EMPTY_COMPOSITE_PRODUCT_FORM: CompositeProductFormValues = {
  name: '',
  description: '',
  fixedOperationalCost: '',
  profitMargin: '',
  manualPrice: '',
  billOfMaterials: [],
};

export function compositeProductFormValuesFrom(
  product: CompositeProduct,
): CompositeProductFormValues {
  return {
    name: product.name,
    description: product.description ?? '',
    fixedOperationalCost: moneyInputText(product.fixedOperationalCost),
    profitMargin: formatBasisPoints(product.profitMarginBasisPoints),
    manualPrice: product.manualPrice === null ? '' : moneyInputText(product.manualPrice),
    billOfMaterials: product.billOfMaterials.map((item) => ({
      materialId: item.materialId,
      materialName: item.materialName,
      consumptionUnit: item.consumptionUnit,
      quantity: quantityInputText(item.quantity),
      scale: 'base',
    })),
  };
}

/** A line for a material that was just picked: its quantity starts empty, never zero. */
export function newBomLine(material: {
  id: string;
  name: string;
  consumptionUnit: ConsumptionUnit;
}): BomLineFormValues {
  return {
    materialId: material.id,
    materialName: material.name,
    consumptionUnit: material.consumptionUnit,
    quantity: '',
    scale: 'base',
  };
}

// -- Reading one field ------------------------------------------------------
//
// One reader per field, answering `null` for what cannot be read. The form
// issues and the live preview both go through these, so the figure on the
// panel and the request that goes out are made from the same reading.

export function readFixedCost(text: string): Money | null {
  const cost = parseCentsInput(text);

  return cost === null || cost.isNegative() ? null : cost;
}

export function readMargin(text: string): number | null {
  return parseBasisPointsInput(text);
}

export function readManualPrice(text: string): ManualPriceDraft {
  if (text.trim() === '') {
    return { kind: 'none' };
  }

  const price = parseCentsInput(text);

  return price === null || price.isNegative() ? { kind: 'invalid' } : { kind: 'price', price };
}

export function readLineQuantity(line: BomLineFormValues): Quantity | null {
  const quantity = parseQuantityInput(line.quantity, line.consumptionUnit, line.scale);

  return quantity === null || quantity.compare(Quantity.zero(line.consumptionUnit)) <= 0
    ? null
    : quantity;
}

/** What pricing needs from a material to put a cost on a line. */
export interface PricingMaterial {
  packageCost: Money;
  packageQuantity: Quantity;
}

/**
 * The form as the preview reads it: whatever can be read, and `null` for what
 * cannot. A line whose material is not in the list has no price either.
 */
export function pricingDraftFrom(
  values: CompositeProductFormValues,
  materials: ReadonlyMap<string, PricingMaterial>,
): PricingDraft {
  return {
    lines: values.billOfMaterials.map((line) => {
      const material = materials.get(line.materialId);

      // A line whose material is not on the list has nothing to be priced by.
      // The placeholders are never read: with no quantity, there is no cost.
      return material === undefined
        ? {
            packageCost: Money.zero(),
            packageQuantity: Quantity.zero(line.consumptionUnit),
            quantity: null,
          }
        : {
            packageCost: material.packageCost,
            packageQuantity: material.packageQuantity,
            quantity: readLineQuantity(line),
          };
    }),
    fixedOperationalCost: readFixedCost(values.fixedOperationalCost),
    profitMarginBasisPoints: readMargin(values.profitMargin),
    manualPrice: readManualPrice(values.manualPrice),
  };
}

// -- Reading the whole form -------------------------------------------------

const REQUIRED_NAME = 'Informe o nome do produto.';
const REQUIRED_FIXED_COST = 'Informe o custo fixo. Digite 0 se não houver.';
const REQUIRED_MARGIN = 'Informe a margem de lucro. Digite 0 para vender a preço de custo.';
const REQUIRED_QUANTITY = 'Informe quanto de insumo cada unidade consome.';
const UNREADABLE_MONEY = 'Não entendi esse valor. Valores em reais têm no máximo 2 casas decimais.';
const UNREADABLE_MARGIN =
  'Não entendi esse valor. A margem vai de 0 a 999,99, com até 2 casas decimais.';
const UNREADABLE_QUANTITY =
  'Não entendi esse valor. Use números, com vírgula nos decimais e até 3 casas.';

export interface CompositeProductFormIssue {
  /** The registered name of the field: `billOfMaterials.0.quantity`, as an array. */
  path: (string | number)[];
  message: string;
}

/** What a valid form means, with the numbers already `Money`, `Quantity` and basis points. */
export interface ParsedCompositeProductForm {
  name: string;
  description: string | null;
  fixedOperationalCost: Money;
  profitMarginBasisPoints: number;
  manualPrice: Money | null;
  lines: { materialId: string; quantity: Quantity }[];
}

export interface CompositeProductFormReading {
  /** Present only when no field has an issue. */
  parsed: ParsedCompositeProductForm | null;
  issues: CompositeProductFormIssue[];
}

/**
 * Reads the whole form, once, and says everything that is wrong with it at the
 * same time: a person who left three fields empty is told about three, not one
 * after the other. Whether the API accepts the product is the API's to say;
 * this only refuses what cannot be read.
 */
export function readCompositeProductForm(
  values: CompositeProductFormValues,
): CompositeProductFormReading {
  const issues: CompositeProductFormIssue[] = [];
  const name = values.name.trim();

  if (name === '') {
    issues.push({ path: ['name'], message: REQUIRED_NAME });
  }

  const fixedOperationalCost = readRequired(
    values.fixedOperationalCost,
    readFixedCost,
    ['fixedOperationalCost'],
    REQUIRED_FIXED_COST,
    UNREADABLE_MONEY,
    issues,
  );
  const profitMarginBasisPoints = readRequired(
    values.profitMargin,
    readMargin,
    ['profitMargin'],
    REQUIRED_MARGIN,
    UNREADABLE_MARGIN,
    issues,
  );

  const manualPrice = readManualPrice(values.manualPrice);

  if (manualPrice.kind === 'invalid') {
    issues.push({ path: ['manualPrice'], message: UNREADABLE_MONEY });
  }

  const lines = values.billOfMaterials.map((line, index) => {
    const quantity = readLineQuantity(line);

    if (quantity === null) {
      issues.push({
        path: ['billOfMaterials', index, 'quantity'],
        message: lineQuantityMessage(line),
      });
    }

    return { materialId: line.materialId, quantity };
  });

  const readLines = lines.filter(
    (line): line is { materialId: string; quantity: Quantity } => line.quantity !== null,
  );

  if (
    issues.length > 0 ||
    fixedOperationalCost === null ||
    profitMarginBasisPoints === null ||
    manualPrice.kind === 'invalid'
  ) {
    return { parsed: null, issues };
  }

  return {
    parsed: {
      name,
      description: values.description.trim() === '' ? null : values.description.trim(),
      fixedOperationalCost,
      profitMarginBasisPoints,
      manualPrice: manualPrice.kind === 'price' ? manualPrice.price : null,
      lines: readLines,
    },
    issues,
  };
}

function readRequired<T>(
  text: string,
  read: (text: string) => T | null,
  path: string[],
  required: string,
  unreadable: string,
  issues: CompositeProductFormIssue[],
): T | null {
  if (text.trim() === '') {
    issues.push({ path, message: required });

    return null;
  }

  const value = read(text);

  if (value === null) {
    issues.push({ path, message: unreadable });
  }

  return value;
}

function lineQuantityMessage(line: BomLineFormValues): string {
  if (line.quantity.trim() === '') {
    return REQUIRED_QUANTITY;
  }

  const typed = parseQuantityInput(line.quantity, line.consumptionUnit, line.scale);

  return typed === null ? UNREADABLE_QUANTITY : 'A quantidade precisa ser maior do que zero.';
}

/**
 * Zod owns the shape (everything is text) and carries the reading's issues to
 * the fields they name.
 */
export const compositeProductFormSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    fixedOperationalCost: z.string(),
    profitMargin: z.string(),
    manualPrice: z.string(),
    billOfMaterials: z.array(
      z.object({
        materialId: z.string(),
        materialName: z.string(),
        consumptionUnit: z.enum(CONSUMPTION_UNITS),
        quantity: z.string(),
        scale: z.enum(['base', 'major']),
      }),
    ),
  })
  .superRefine((values, ctx) => {
    for (const issue of readCompositeProductForm(values).issues) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  });

// -- What goes to the API ---------------------------------------------------

/**
 * A new product. An empty description is left out, and so is an absent manual
 * price: an optional field that was left empty is absent, not a zero and not an
 * empty string.
 */
export function buildCreateRequest(
  form: ParsedCompositeProductForm,
): CreateCompositeProductRequestDto {
  return {
    name: form.name,
    ...(form.description === null ? {} : { description: form.description }),
    fixedOperationalCost: form.fixedOperationalCost.toCentsString(),
    profitMarginBasisPoints: form.profitMarginBasisPoints,
    ...(form.manualPrice === null ? {} : { manualPrice: form.manualPrice.toCentsString() }),
    billOfMaterials: form.lines.map((line) => ({
      materialId: line.materialId,
      quantity: line.quantity.toApiNumber(),
    })),
  };
}

/** Whether the lines typed are not the lines the product has, by material and by quantity. */
export function billOfMaterialsChanged(
  lines: ParsedCompositeProductForm['lines'],
  original: CompositeProduct,
): boolean {
  if (lines.length !== original.billOfMaterials.length) {
    return true;
  }

  const saved = new Map(original.billOfMaterials.map((item) => [item.materialId, item.quantity]));

  return lines.some((line) => {
    const before = saved.get(line.materialId);

    return before === undefined || before.compare(line.quantity) !== 0;
  });
}

/**
 * What to send to turn `original` into the edited form: the changed fields and
 * nothing else.
 *
 * The bill of materials is the one that matters. `billOfMaterials` replaces the
 * whole bill, and the API refuses it while any line points at a discontinued
 * material — so a product that only had its name changed must not send the bill
 * back, or a line that has been fine all along would turn into an error.
 */
export function buildUpdate(
  form: ParsedCompositeProductForm,
  original: CompositeProduct,
): UpdateCompositeProductRequestDto {
  const patch: UpdateCompositeProductRequestDto = {};

  if (form.name !== original.name) {
    patch.name = form.name;
  }

  if (form.description !== original.description) {
    patch.description = form.description;
  }

  if (!form.fixedOperationalCost.equals(original.fixedOperationalCost)) {
    patch.fixedOperationalCost = form.fixedOperationalCost.toCentsString();
  }

  if (form.profitMarginBasisPoints !== original.profitMarginBasisPoints) {
    patch.profitMarginBasisPoints = form.profitMarginBasisPoints;
  }

  if (!sameManualPrice(form.manualPrice, original.manualPrice)) {
    patch.manualPrice = form.manualPrice === null ? null : form.manualPrice.toCentsString();
  }

  if (billOfMaterialsChanged(form.lines, original)) {
    patch.billOfMaterials = form.lines.map((line) => ({
      materialId: line.materialId,
      quantity: line.quantity.toApiNumber(),
    }));
  }

  return patch;
}

export function hasChanges(patch: UpdateCompositeProductRequestDto): boolean {
  return Object.keys(patch).length > 0;
}

function sameManualPrice(a: Money | null, b: Money | null): boolean {
  return a === null || b === null ? a === b : a.equals(b);
}

// -- What the panel needs to know about the form -----------------------------

/** The text of a line, with what makes it a different line: the material and how much. */
function lineKey(line: BomLineFormValues): string {
  return `${line.materialId}|${line.quantity.trim()}|${line.scale}`;
}

/** Whether the lines typed are the lines of `saved`, as typed. Order does not matter. */
export function sameBillOfMaterials(
  a: CompositeProductFormValues,
  b: CompositeProductFormValues,
): boolean {
  const left = a.billOfMaterials.map(lineKey).sort();
  const right = b.billOfMaterials.map(lineKey).sort();

  return left.length === right.length && left.every((key, index) => key === right[index]);
}

/**
 * Whether anything that moves a price differs from `saved`: the lines, the
 * fixed cost, the margin and the manual price. Decides whether the panel shows
 * the API's figures or a preview — a form where only the name changed still
 * has the figures the API gave.
 */
export function pricingFieldsDiffer(
  current: CompositeProductFormValues,
  saved: CompositeProductFormValues,
): boolean {
  return (
    current.fixedOperationalCost.trim() !== saved.fixedOperationalCost.trim() ||
    current.profitMargin.trim() !== saved.profitMargin.trim() ||
    current.manualPrice.trim() !== saved.manualPrice.trim() ||
    !sameBillOfMaterials(current, saved)
  );
}
