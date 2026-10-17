import {
  moneyInputText,
  parseQuantityInput,
  quantityInputText,
  type QuantityInputScale,
} from '@/shared/format';
import { isConsumptionUnit, Quantity, type ConsumptionUnit } from '@/shared/quantity';

import type { ClassificationRequestDto, ClassifiedItemRequestDto } from '../api/invoice.dto';

import {
  discountModeAvailability,
  type DiscountAllocationMode,
  type DiscountModeAvailability,
} from './discount-mode';
import { readManualAllocation, type ManualReading } from './manual-allocation';
import type { PurchaseDetail } from './purchase-detail';

/**
 * What the person has decided about the lines of a note so far, held on the
 * screen until the classification is concluded.
 *
 * It is a draft and not a series of saves because the API's classification is
 * not idempotent: every request that carries a line as stock gives that stock
 * entry again. Saving as the person ticks boxes would enter the stock once per
 * tick. So nothing is sent until the end, and then everything goes in a single
 * request, which the API either applies whole or not at all.
 */

/** Whether a stock line points at a material that already exists or asks for a new one. */
export type StockTarget = 'EXISTING' | 'NEW';

export interface LineDraft {
  itemId: string;
  isCompanyExpense: boolean;
  isStockMaterial: boolean;
  target: StockTarget;
  /** The existing material, when {@link target} is `EXISTING`. */
  materialId: string | null;
  /** The new material, when {@link target} is `NEW`. */
  newMaterialName: string;
  /** A `ConsumptionUnit`, or `''` while none is chosen. */
  newMaterialUnit: string;
  /** How much one package holds, as typed. */
  packageQuantity: string;
  packageScale: QuantityInputScale;
}

export interface ClassificationDraft {
  lines: LineDraft[];
  /** `null` while no way of spreading the discount is chosen. */
  mode: DiscountAllocationMode | null;
  /** What was typed per line for `MANUAL`, keyed by line id. */
  manual: Record<string, string>;
}

/**
 * The draft a note opens with: what the API already has for each line, and the
 * way its discount is spread now.
 *
 * With the attribution pending no mode is chosen — the one the API holds was
 * invalidated by an edit and is not an answer — so the person has to choose
 * again, which is what clears the pending state.
 */
export function initialDraft(purchase: PurchaseDetail): ClassificationDraft {
  const keepMode = purchase.requiresDiscountAllocationChoice && !purchase.allocationPending;
  const manual: Record<string, string> = {};

  if (keepMode && purchase.discountAllocationMode === 'MANUAL') {
    for (const line of purchase.lines) {
      if (!line.allocatedDiscount.isZero()) {
        manual[line.id] = moneyInputText(line.allocatedDiscount);
      }
    }
  }

  return {
    lines: purchase.lines.map((line) => ({
      itemId: line.id,
      isCompanyExpense: line.isCompanyExpense,
      isStockMaterial: line.isStockMaterial,
      target: 'EXISTING',
      materialId: line.materialId,
      newMaterialName: '',
      newMaterialUnit: '',
      packageQuantity: '',
      packageScale: 'base',
    })),
    mode: keepMode ? purchase.discountAllocationMode : null,
    manual,
  };
}

function mapLine(
  draft: ClassificationDraft,
  itemId: string,
  change: (line: LineDraft) => LineDraft,
): ClassificationDraft {
  return {
    ...draft,
    lines: draft.lines.map((line) => (line.itemId === itemId ? change(line) : line)),
  };
}

/**
 * A stock material is always a company expense, and the reverse is not true: so
 * a line that stops being a company expense stops being a stock material with
 * it. Ticking the expense box back does not bring the stock back.
 */
export function setCompanyExpense(
  draft: ClassificationDraft,
  itemId: string,
  checked: boolean,
): ClassificationDraft {
  return mapLine(draft, itemId, (line) => ({
    ...line,
    isCompanyExpense: checked,
    isStockMaterial: checked ? line.isStockMaterial : false,
  }));
}

/** Marking a line as stock marks it as a company expense, which then cannot be unmarked on its own. */
export function setStockMaterial(
  draft: ClassificationDraft,
  itemId: string,
  checked: boolean,
): ClassificationDraft {
  return mapLine(draft, itemId, (line) => ({
    ...line,
    isStockMaterial: checked,
    isCompanyExpense: checked ? true : line.isCompanyExpense,
  }));
}

export type StockFields = Pick<
  LineDraft,
  | 'target'
  | 'materialId'
  | 'newMaterialName'
  | 'newMaterialUnit'
  | 'packageQuantity'
  | 'packageScale'
>;

/** Changes what a stock line points at or how much a package holds. */
export function patchStockFields(
  draft: ClassificationDraft,
  itemId: string,
  patch: Partial<StockFields>,
): ClassificationDraft {
  return mapLine(draft, itemId, (line) => ({ ...line, ...patch }));
}

export function setDiscountMode(
  draft: ClassificationDraft,
  mode: DiscountAllocationMode,
): ClassificationDraft {
  return { ...draft, mode };
}

export function setManualAmount(
  draft: ClassificationDraft,
  itemId: string,
  text: string,
): ClassificationDraft {
  return { ...draft, manual: { ...draft.manual, [itemId]: text } };
}

/** Whether anything differs from where the screen started: what leaving would throw away. */
export function isDraftDirty(initial: ClassificationDraft, current: ClassificationDraft): boolean {
  return JSON.stringify(initial) !== JSON.stringify(current);
}

/**
 * The mode that counts: the one chosen, as long as it still has lines to land
 * on. Unmarking the last company expense after choosing "only the company items"
 * leaves the choice standing on nothing, and the person is asked again instead
 * of the API refusing it later.
 */
export function effectiveDiscountMode(draft: ClassificationDraft): DiscountAllocationMode | null {
  if (draft.mode === null) {
    return null;
  }

  return discountModeAvailability(draft.lines)[draft.mode].enabled ? draft.mode : null;
}

/** The consumption unit a stock line is measured in: the material's, or the one chosen for a new one. */
export function stockLineUnit(
  line: LineDraft,
  materials: ReadonlyMap<string, LinkableMaterial>,
): ConsumptionUnit | null {
  if (line.target === 'EXISTING') {
    return line.materialId === null
      ? null
      : (materials.get(line.materialId)?.consumptionUnit ?? null);
  }

  return isConsumptionUnit(line.newMaterialUnit) ? line.newMaterialUnit : null;
}

/** What the classification needs to know about a material to link a line to it. */
export interface LinkableMaterial {
  id: string;
  consumptionUnit: ConsumptionUnit;
}

export type LineField = 'material' | 'newMaterialName' | 'newMaterialUnit' | 'packageQuantity';

export interface LineReading {
  itemId: string;
  /** What a stock line is missing, per field. Empty for a line that is not stock, or is done. */
  issues: Partial<Record<LineField, string>>;
  unit: ConsumptionUnit | null;
  /** How much one package holds, once readable. */
  packageQuantity: Quantity | null;
}

/** Why a note cannot be concluded yet. */
export type ConcludeBlock =
  'NOTHING_TO_CLASSIFY' | 'LINES_INCOMPLETE' | 'DISCOUNT_MODE_MISSING' | 'MANUAL_NOT_CLOSED';

/** What concluding will do, in the terms the person thinks in. */
export interface ConclusionSummary {
  /** Lines that will give a stock entry now. */
  stockEntries: number;
  /** Of those, how many create their material. */
  newMaterials: number;
  /** Lines that were already entered in the stock, and are left as they are. */
  alreadyStocked: number;
  /** Lines of the note that end up as company expenses, counting those already stocked. */
  companyExpenses: number;
  /** Lines of the note that end up as personal. */
  personalItems: number;
}

export interface ClassificationReading {
  lines: ReadonlyMap<string, LineReading>;
  availability: DiscountModeAvailability;
  /** The mode that counts, or `null`. Always `null` for a note without a discount. */
  mode: DiscountAllocationMode | null;
  /** Present while the mode is `MANUAL`. */
  manual: ManualReading | null;
  summary: ConclusionSummary;
  blocker: ConcludeBlock | null;
  /** What to send. `null` while {@link blocker} is set. */
  request: ClassificationRequestDto | null;
}

export const REQUIRED_MATERIAL = 'Escolha o insumo que este item abastece.';
export const REQUIRED_NEW_MATERIAL_NAME = 'Dê um nome ao insumo novo.';
export const REQUIRED_NEW_MATERIAL_UNIT = 'Escolha a unidade de consumo.';
export const REQUIRED_PACKAGE_QUANTITY = 'Informe quanto a embalagem contém.';
export const UNREADABLE_PACKAGE_QUANTITY =
  'Não entendi esse valor. Use números, com vírgula nos decimais e até 3 casas.';
export const EMPTY_PACKAGE = 'A embalagem precisa conter mais do que zero.';

function emptyReading(itemId: string): LineReading {
  return { itemId, issues: {}, unit: null, packageQuantity: null };
}

function readStockLine(
  line: LineDraft,
  materials: ReadonlyMap<string, LinkableMaterial>,
): LineReading {
  const issues: Partial<Record<LineField, string>> = {};
  const unit = stockLineUnit(line, materials);

  if (line.target === 'EXISTING') {
    if (unit === null) {
      issues.material = REQUIRED_MATERIAL;
    }
  } else {
    if (line.newMaterialName.trim() === '') {
      issues.newMaterialName = REQUIRED_NEW_MATERIAL_NAME;
    }

    if (unit === null) {
      issues.newMaterialUnit = REQUIRED_NEW_MATERIAL_UNIT;
    }
  }

  let packageQuantity: Quantity | null = null;

  // Without a unit the digits have no meaning: "1,5" cannot be read yet.
  if (unit !== null) {
    if (line.packageQuantity.trim() === '') {
      issues.packageQuantity = REQUIRED_PACKAGE_QUANTITY;
    } else {
      packageQuantity = parseQuantityInput(line.packageQuantity, unit, line.packageScale);

      if (packageQuantity === null) {
        issues.packageQuantity = UNREADABLE_PACKAGE_QUANTITY;
      } else if (packageQuantity.compare(Quantity.zero(unit)) <= 0) {
        issues.packageQuantity = EMPTY_PACKAGE;
        packageQuantity = null;
      }
    }
  }

  return { itemId: line.itemId, issues, unit, packageQuantity };
}

function toRequestItem(line: LineDraft, reading: LineReading): ClassifiedItemRequestDto {
  const base = {
    itemId: line.itemId,
    isCompanyExpense: line.isCompanyExpense,
    isStockMaterial: line.isStockMaterial,
  };

  if (!line.isStockMaterial || reading.packageQuantity === null || reading.unit === null) {
    return base;
  }

  // `toApiNumber` carries at most three places, which is what the column holds.
  const packageQuantity = reading.packageQuantity.toApiNumber();

  return line.target === 'EXISTING' && line.materialId !== null
    ? { ...base, materialId: line.materialId, packageQuantity }
    : {
        ...base,
        newMaterial: { name: line.newMaterialName.trim(), consumptionUnit: reading.unit },
        packageQuantity,
      };
}

/**
 * Reads the whole draft once, and says what is missing, what will happen and
 * what to send. The same reading answers whether the button is enabled and
 * builds the request, so the screen cannot allow a conclusion it would not be
 * able to send.
 *
 * `locked` are the lines the API already entered into the stock. They are
 * counted but never sent again: sending a stock line again gives its entry again.
 */
export function readClassification(
  draft: ClassificationDraft,
  purchase: PurchaseDetail,
  materials: ReadonlyMap<string, LinkableMaterial>,
  locked: ReadonlySet<string>,
): ClassificationReading {
  const availability = discountModeAvailability(draft.lines);
  const editable = draft.lines.filter((line) => !locked.has(line.itemId));
  const entries = editable.map((line) => ({
    line,
    reading: line.isStockMaterial ? readStockLine(line, materials) : emptyReading(line.itemId),
  }));
  const lines = new Map(entries.map((entry) => [entry.line.itemId, entry.reading]));

  const asked = purchase.requiresDiscountAllocationChoice;
  const mode = asked ? effectiveDiscountMode(draft) : null;
  const manual =
    mode === 'MANUAL'
      ? readManualAllocation(
          purchase.lines.map((line) => ({ itemId: line.id, grossValue: line.grossValue })),
          draft.manual,
          purchase.discountTotal,
        )
      : null;

  const stockLines = editable.filter((line) => line.isStockMaterial);
  const summary: ConclusionSummary = {
    stockEntries: stockLines.length,
    newMaterials: stockLines.filter((line) => line.target === 'NEW').length,
    alreadyStocked: draft.lines.length - editable.length,
    companyExpenses: draft.lines.filter((line) => line.isCompanyExpense).length,
    personalItems: draft.lines.filter((line) => !line.isCompanyExpense).length,
  };

  const incomplete = [...lines.values()].some((reading) => Object.keys(reading.issues).length > 0);
  const blocker: ConcludeBlock | null =
    editable.length === 0
      ? 'NOTHING_TO_CLASSIFY'
      : incomplete
        ? 'LINES_INCOMPLETE'
        : asked && mode === null
          ? 'DISCOUNT_MODE_MISSING'
          : manual !== null && !manual.closes
            ? 'MANUAL_NOT_CLOSED'
            : null;

  return {
    lines,
    availability,
    mode,
    manual,
    summary,
    blocker,
    request: blocker === null ? buildRequest(entries, mode, manual) : null,
  };
}

function buildRequest(
  entries: readonly { line: LineDraft; reading: LineReading }[],
  mode: DiscountAllocationMode | null,
  manual: ManualReading | null,
): ClassificationRequestDto {
  const request: ClassificationRequestDto = {
    items: entries.map(({ line, reading }) => toRequestItem(line, reading)),
  };

  if (mode !== null) {
    request.discountAllocationMode = mode;
  }

  if (mode === 'MANUAL' && manual !== null) {
    // Only the lines that were given something: the others are not cited, and the API leaves them at zero.
    request.manualAllocation = manual.lines.flatMap((line) =>
      line.amount === null
        ? []
        : [{ itemId: line.itemId, allocatedDiscount: line.amount.toCentsString() }],
    );
  }

  return request;
}

/** The text a package field is pre-filled with when an existing material is picked. */
export function packageQuantityText(quantity: Quantity): string {
  return quantityInputText(quantity);
}
