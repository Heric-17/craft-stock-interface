import { z } from 'zod';

import {
  moneyInputText,
  parseCentsInput,
  parseMoneyInput,
  parseQuantityInput,
  quantityInputText,
  type QuantityInputScale,
} from '@/shared/format';
import type { Money } from '@/shared/money';
import { isConsumptionUnit, Quantity, type ConsumptionUnit } from '@/shared/quantity';

import type { CreateMaterialRequestDto, UpdateMaterialRequestDto } from '../api/material.dto';

import type { Material } from './material';

/**
 * The create and edit form of a material. Every number is a string here, typed
 * the way a person writes it (`1,5`), and is turned into `Money` or `Quantity`
 * once, when the form is submitted — never `valueAsNumber`, which would lose
 * the decimal comma and then the digits.
 *
 * A required field starts empty. Nothing is pre-filled with zero to make the
 * form look finished: a package that "contains 0 g" is a mistake the person
 * has to make on purpose.
 */
export interface MaterialFormValues {
  name: string;
  consumptionUnit: string;
  packageQuantity: string;
  /** Whether `packageQuantity` is typed in the base unit or in kg / L / m. */
  packageScale: QuantityInputScale;
  packageCost: string;
  minimumStockAlert: string;
}

export const EMPTY_MATERIAL_FORM: MaterialFormValues = {
  name: '',
  consumptionUnit: '',
  packageQuantity: '',
  packageScale: 'base',
  packageCost: '',
  minimumStockAlert: '',
};

export function materialFormValuesFrom(material: Material): MaterialFormValues {
  return {
    name: material.name,
    consumptionUnit: material.consumptionUnit,
    packageQuantity: quantityInputText(material.packageQuantity),
    packageScale: 'base',
    packageCost: moneyInputText(material.packageCost),
    minimumStockAlert: quantityInputText(material.minimumStockAlert),
  };
}

/** What a valid form means, with the numbers already `Money` and `Quantity`. */
export interface ParsedMaterialForm {
  name: string;
  consumptionUnit: ConsumptionUnit;
  packageQuantity: Quantity;
  packageCost: Money;
  minimumStockAlert: Quantity;
}

const REQUIRED_PACKAGE_QUANTITY = 'Informe quanto a embalagem contém.';
const UNREADABLE_QUANTITY =
  'Não entendi esse valor. Use números, com vírgula nos decimais e até 3 casas.';
const REQUIRED_PACKAGE_COST = 'Informe o custo da embalagem.';
const UNREADABLE_MONEY = 'Não entendi esse valor. Valores em reais têm no máximo 2 casas decimais.';
const REQUIRED_MINIMUM = 'Informe o estoque mínimo. Digite 0 se não quiser alerta.';

export interface MaterialFormIssue {
  path: keyof MaterialFormValues;
  message: string;
}

export interface MaterialFormReading {
  /** Present only when no field has an issue. */
  parsed: ParsedMaterialForm | null;
  issues: MaterialFormIssue[];
}

/**
 * Reads the whole form, once, and says everything that is wrong with it at the
 * same time: a person who left three fields empty is told about three, not one
 * after the other.
 *
 * The same reading produces the values that are sent. The echo under a field
 * and the request that goes out cannot drift apart because there is no second
 * place that parses the text.
 */
export function readMaterialForm(values: MaterialFormValues): MaterialFormReading {
  const issues: MaterialFormIssue[] = [];
  const name = values.name.trim();
  const unit = isConsumptionUnit(values.consumptionUnit) ? values.consumptionUnit : null;

  if (name === '') {
    issues.push({ path: 'name', message: 'Informe o nome do insumo.' });
  }

  if (unit === null) {
    issues.push({ path: 'consumptionUnit', message: 'Escolha a unidade de consumo.' });
  }

  const packageCost = readCost(values.packageCost, issues);

  // Without a unit a quantity has no meaning, and "1,5" cannot be read.
  if (unit === null) {
    return { parsed: null, issues };
  }

  const packageQuantity = readPackageQuantity(values, unit, issues);
  const minimumStockAlert = readMinimum(values.minimumStockAlert, unit, issues);

  if (
    issues.length > 0 ||
    packageQuantity === null ||
    packageCost === null ||
    minimumStockAlert === null
  ) {
    return { parsed: null, issues };
  }

  return {
    parsed: { name, consumptionUnit: unit, packageQuantity, packageCost, minimumStockAlert },
    issues,
  };
}

function readCost(text: string, issues: MaterialFormIssue[]): Money | null {
  if (text.trim() === '') {
    issues.push({ path: 'packageCost', message: REQUIRED_PACKAGE_COST });

    return null;
  }

  const cost = parseCentsInput(text);

  if (cost === null) {
    issues.push({ path: 'packageCost', message: UNREADABLE_MONEY });
  } else if (cost.isNegative()) {
    issues.push({ path: 'packageCost', message: 'O custo da embalagem não pode ser negativo.' });
  }

  return cost;
}

function readPackageQuantity(
  values: MaterialFormValues,
  unit: ConsumptionUnit,
  issues: MaterialFormIssue[],
): Quantity | null {
  if (values.packageQuantity.trim() === '') {
    issues.push({ path: 'packageQuantity', message: REQUIRED_PACKAGE_QUANTITY });

    return null;
  }

  const quantity = parseQuantityInput(values.packageQuantity, unit, values.packageScale);

  if (quantity === null) {
    issues.push({ path: 'packageQuantity', message: UNREADABLE_QUANTITY });
  } else if (quantity.compare(Quantity.zero(unit)) <= 0) {
    issues.push({
      path: 'packageQuantity',
      message: 'A embalagem precisa conter mais do que zero.',
    });
  }

  return quantity;
}

function readMinimum(
  text: string,
  unit: ConsumptionUnit,
  issues: MaterialFormIssue[],
): Quantity | null {
  if (text.trim() === '') {
    issues.push({ path: 'minimumStockAlert', message: REQUIRED_MINIMUM });

    return null;
  }

  const quantity = parseQuantityInput(text, unit);

  if (quantity === null) {
    issues.push({ path: 'minimumStockAlert', message: UNREADABLE_QUANTITY });
  } else if (quantity.isNegative()) {
    issues.push({ path: 'minimumStockAlert', message: 'O estoque mínimo não pode ser negativo.' });
  }

  return quantity;
}

/**
 * Zod owns the shape (everything is text) and carries the reading's issues to
 * the fields they name. Whether the API accepts the material is the API's to
 * say; this only refuses what cannot be read.
 */
export const materialFormSchema = z
  .object({
    name: z.string(),
    consumptionUnit: z.string(),
    packageQuantity: z.string(),
    packageScale: z.enum(['base', 'major']),
    packageCost: z.string(),
    minimumStockAlert: z.string(),
  })
  .superRefine((values, ctx) => {
    for (const issue of readMaterialForm(values).issues) {
      ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
    }
  });

/**
 * A new material starts with no stock: the stock enters through "Dar entrada",
 * which is how every other quantity gets in. The API wants `stockQuantity` in
 * the body, and an empty optional field must not turn into a number the person
 * never typed — so the form does not offer one, and this sends the honest
 * zero of a material that was just registered.
 */
export function buildCreateRequest(form: ParsedMaterialForm): CreateMaterialRequestDto {
  return {
    name: form.name,
    packageCost: form.packageCost.toCentsString(),
    packageQuantity: form.packageQuantity.toApiNumber(),
    consumptionUnit: form.consumptionUnit,
    stockQuantity: Quantity.zero(form.consumptionUnit).toApiNumber(),
    minimumStockAlert: form.minimumStockAlert.toApiNumber(),
  };
}

export interface MaterialUpdate {
  /** Set when the consumption unit changed: it has its own route and goes first. */
  consumptionUnit: ConsumptionUnit | null;
  /** Only the fields that changed. Empty when nothing did. */
  patch: UpdateMaterialRequestDto;
}

function sameQuantity(a: Quantity, b: Quantity): boolean {
  return a.unit === b.unit && a.compare(b) === 0;
}

/**
 * What to send to turn `original` into the edited form: the changed fields and
 * nothing else. An untouched package cost is not sent back — it is not a "new"
 * price, and the backend writes a price-history line for every cost it
 * receives that differs.
 *
 * When the unit changes, the package quantity is sent in the new unit even if
 * its digits did not change: the same `1000` means a different thing.
 */
export function buildUpdate(form: ParsedMaterialForm, original: Material): MaterialUpdate {
  const unitChanged = form.consumptionUnit !== original.consumptionUnit;
  const patch: UpdateMaterialRequestDto = {};

  if (form.name !== original.name) {
    patch.name = form.name;
  }

  if (!form.packageCost.equals(original.packageCost)) {
    patch.packageCost = form.packageCost.toCentsString();
  }

  if (unitChanged || !sameQuantity(form.packageQuantity, original.packageQuantity)) {
    patch.packageQuantity = form.packageQuantity.toApiNumber();
  }

  if (unitChanged || !sameQuantity(form.minimumStockAlert, original.minimumStockAlert)) {
    patch.minimumStockAlert = form.minimumStockAlert.toApiNumber();
  }

  return { consumptionUnit: unitChanged ? form.consumptionUnit : null, patch };
}

export function hasChanges(update: MaterialUpdate): boolean {
  return update.consumptionUnit !== null || Object.keys(update.patch).length > 0;
}

/**
 * Whether the package cost typed differs from the one stored. Drives the
 * warning under the field: a new cost reprices every product that uses the
 * material, at once, and nothing else on the form does that.
 */
export function packageCostChanged(text: string, original: Material): boolean {
  const typed = parseMoneyInput(text);

  return typed !== null && !typed.equals(original.packageCost);
}
