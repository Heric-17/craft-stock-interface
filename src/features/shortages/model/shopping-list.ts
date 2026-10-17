import type { Material } from '@/features/materials';
import { Money } from '@/shared/money';
import { Quantity, type ConsumptionUnit } from '@/shared/quantity';

import type { ShoppingListDto, ShoppingListLineDto } from '../api/shopping-list.dto';

/**
 * A line of the shopping list as the screen reads it: `Money` and `Quantity`,
 * never the decimal string and the `number` the wire carries.
 *
 * Everything on it is the API's answer, carried through untouched. The packages
 * to buy, the estimate of the line and the total of the list are worked out on
 * the server, from the package the material is bought in, and are never worked
 * out again here: a second implementation of `ceil(shortage / package)` is a
 * second place for the two to disagree on a number somebody pays.
 *
 * Two of those answers are **null on purpose** and stay null: a material
 * without a usable package has no count of packages and no estimate. Null is
 * "unknown", and the screen says so — it is never turned into zero.
 */
export interface ShoppingListLine {
  materialId: string;
  name: string;
  unit: ConsumptionUnit;
  needed: Quantity;
  stock: Quantity;
  /** What is missing, in the material's unit. Zero when the stock covers the need. */
  shortage: Quantity;
  /** Whole closed packages; `null` when the package data does not allow the count. */
  packagesToBuy: number | null;
  /** `null` — not zero — when the line cannot be estimated. */
  estimatedCost: Money | null;
  estimateIssue: 'MISSING_PACKAGE_DATA' | null;
}

export interface ShoppingList {
  lines: ShoppingListLine[];
  /** A floor, not the total, while `unestimatedLineCount` is above zero. */
  estimatedTotal: Money;
  unestimatedLineCount: number;
}

export function toShoppingListLine(dto: ShoppingListLineDto): ShoppingListLine {
  const unit = dto.consumptionUnit;

  return {
    materialId: dto.materialId,
    name: dto.materialName,
    unit,
    needed: Quantity.fromApi(dto.needed, unit),
    stock: Quantity.fromApi(dto.stockQuantity, unit),
    shortage: Quantity.fromApi(dto.shortage, unit),
    packagesToBuy: dto.packagesToBuy,
    estimatedCost: dto.estimatedCost === null ? null : Money.parse(dto.estimatedCost),
    estimateIssue: dto.estimateIssue,
  };
}

export function toShoppingList(dto: ShoppingListDto): ShoppingList {
  return {
    lines: dto.lines.map(toShoppingListLine),
    estimatedTotal: Money.parse(dto.estimatedTotal),
    unestimatedLineCount: dto.unestimatedLineCount,
  };
}

/** What the material list adds to a line: how it looks, and what one package of it is. */
export interface MaterialPackages {
  imageUrl: string | null;
  packageQuantity: Quantity;
}

export function toMaterialPackages(
  materials: readonly Pick<Material, 'id' | 'imageUrl' | 'packageQuantity'>[],
): ReadonlyMap<string, MaterialPackages> {
  return new Map(
    materials.map((material) => [
      material.id,
      { imageUrl: material.imageUrl, packageQuantity: material.packageQuantity },
    ]),
  );
}

/** Whether the stock does not cover the need, which is what the API's `shortage` says. */
export function needsPurchase(line: Pick<ShoppingListLine, 'shortage'>): boolean {
  return !line.shortage.isZero() && !line.shortage.isNegative();
}

/** Whether the line could not be estimated: it is missing something, and the API did not know the cost. */
export function isUnestimated(line: Pick<ShoppingListLine, 'estimateIssue'>): boolean {
  return line.estimateIssue !== null;
}

/** The filter "apenas faltantes": only the lines that still have to be bought. */
export function onlyMissing(lines: readonly ShoppingListLine[]): ShoppingListLine[] {
  return lines.filter(needsPurchase);
}

/**
 * What the person ticked, as exceptions to the default. A line that has to be
 * bought is ticked until it is unticked, and one that does not is never ticked:
 * there is nothing to put on the list for it. Keeping only the exceptions means
 * a list that is read again, with a different set of lines, still has a
 * sensible tick on every one of them.
 */
export type LineMarks = ReadonlyMap<string, boolean>;

export function isLineMarked(
  line: Pick<ShoppingListLine, 'materialId' | 'shortage'>,
  marks: LineMarks,
): boolean {
  return needsPurchase(line) && (marks.get(line.materialId) ?? true);
}

export function toggleLineMark(
  marks: LineMarks,
  line: Pick<ShoppingListLine, 'materialId' | 'shortage'>,
): LineMarks {
  return new Map(marks).set(line.materialId, !isLineMarked(line, marks));
}

/**
 * The sales the list is built from: every sale with production pending until the
 * person chooses, and from then on only what they chose. A choice made earlier
 * that includes a sale which is no longer pending — it was assembled in the
 * meantime — loses that sale instead of asking the API about it.
 */
export function resolveSaleSelection(
  available: readonly string[],
  chosen: ReadonlySet<string> | null,
): string[] {
  return chosen === null ? [...available] : available.filter((id) => chosen.has(id));
}
