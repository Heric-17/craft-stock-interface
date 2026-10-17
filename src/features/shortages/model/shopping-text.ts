import { formatMoney, formatQuantity } from '@/shared/format';
import type { Money } from '@/shared/money';

import { countText, packagesCountText, salesCountText } from './labels';
import {
  isLineMarked,
  needsPurchase,
  type LineMarks,
  type MaterialPackages,
  type ShoppingList,
  type ShoppingListLine,
} from './shopping-list';

/**
 * The API's estimate for the list, when it applies to what the person ticked.
 *
 * The estimate is the server's, for **every** line that has to be bought. It is
 * the right number to print only when every one of those lines is ticked;
 * with some of them left out it would count things that are not on the list,
 * and adding the ticked lines up here instead would be an estimate worked out
 * on this side. So with a partial tick there is no total, and each line keeps
 * its own estimate.
 */
export interface ShoppingTotal {
  amount: Money;
  unestimatedLineCount: number;
}

export function totalFor(list: ShoppingList, marks: LineMarks): ShoppingTotal | null {
  const everythingTicked = list.lines.every(
    (line) => !needsPurchase(line) || isLineMarked(line, marks),
  );

  return everythingTicked
    ? { amount: list.estimatedTotal, unestimatedLineCount: list.unestimatedLineCount }
    : null;
}

export interface ShoppingTextInput {
  /** The ticked lines, in the order the screen shows them. */
  lines: readonly ShoppingListLine[];
  packages: ReadonlyMap<string, MaterialPackages>;
  saleCount: number;
  total: ShoppingTotal | null;
}

/** "2 embalagens de 1 kg"; without the size when the material list has not said it. */
export function packagesPhrase(
  packagesToBuy: number,
  packageSize: MaterialPackages | undefined,
): string {
  const count = packagesCountText(packagesToBuy);

  return packageSize === undefined
    ? count
    : `${count} de ${formatQuantity(packageSize.packageQuantity)}`;
}

function lineText(line: ShoppingListLine, packages: ReadonlyMap<string, MaterialPackages>): string {
  const missing = `falta ${formatQuantity(line.shortage)}`;
  const what =
    line.packagesToBuy === null
      ? `${missing} (sem dados da embalagem)`
      : `${packagesPhrase(line.packagesToBuy, packages.get(line.materialId))} (${missing})`;
  // Unknown is said as unknown. A line without an estimate never prints a price.
  const cost =
    line.estimatedCost === null ? 'sem estimativa de custo' : formatMoney(line.estimatedCost);

  return `- ${line.name}: ${what} — ${cost}`;
}

/**
 * The shopping list as plain text, the same text that is copied, shared and
 * printed: one line per ticked material with how many packages to buy and what
 * the API estimated for them. It is built on the spot and never saved anywhere.
 */
export function buildShoppingText({
  lines,
  packages,
  saleCount,
  total,
}: ShoppingTextInput): string {
  const parts = [
    'Lista de compras',
    `Baseada em ${salesCountText(saleCount)}.`,
    '',
    ...lines.map((line) => lineText(line, packages)),
  ];

  if (total !== null) {
    const note =
      total.unestimatedLineCount > 0
        ? ` (não inclui ${countText(total.unestimatedLineCount, 'insumo', 'insumos')} sem estimativa)`
        : '';

    parts.push('', `Total estimado: ${formatMoney(total.amount)}${note}`);
  }

  return parts.join('\n');
}
