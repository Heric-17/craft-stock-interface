import { describe, expect, it } from 'vitest';

import { Money, requireDecimalString } from '@/shared/money';
import { Quantity } from '@/shared/quantity';

import {
  effectiveDiscountMode,
  initialDraft,
  isDraftDirty,
  patchStockFields,
  readClassification,
  setCompanyExpense,
  setDiscountMode,
  setManualAmount,
  setStockMaterial,
  type ClassificationDraft,
  type LinkableMaterial,
} from './classification-draft';
import type { PurchaseDetail, PurchaseLine } from './purchase-detail';

const money = (value: string): Money => Money.parse(requireDecimalString(value));

function line(id: string, overrides: Partial<PurchaseLine> = {}): PurchaseLine {
  return {
    id,
    description: `Item ${id}`,
    quantity: Quantity.fromApi(1, 'UNIT'),
    printedUnit: 'UN',
    grossValue: money('10.00'),
    allocatedDiscount: money('0.00'),
    isCompanyExpense: true,
    isStockMaterial: false,
    materialId: null,
    ...overrides,
  };
}

function purchase(lines: PurchaseLine[], overrides: Partial<PurchaseDetail> = {}): PurchaseDetail {
  return {
    id: 'compra-1',
    purchaseDate: '2026-10-12T17:20:00.000Z',
    establishmentName: 'Casa das Essências',
    grossTotal: money('30.00'),
    discountTotal: money('0.00'),
    netTotal: money('30.00'),
    discountAllocationMode: 'PROPORTIONAL',
    allocationPending: false,
    requiresDiscountAllocationChoice: false,
    lines,
    ...overrides,
  };
}

const withDiscount = (lines: PurchaseLine[], overrides: Partial<PurchaseDetail> = {}) =>
  purchase(lines, {
    discountTotal: money('6.00'),
    netTotal: money('24.00'),
    requiresDiscountAllocationChoice: true,
    ...overrides,
  });

const MATERIALS = new Map<string, LinkableMaterial>([
  ['mat-cera', { id: 'mat-cera', consumptionUnit: 'GRAM' }],
  ['mat-pavio', { id: 'mat-pavio', consumptionUnit: 'UNIT' }],
]);
const NONE: ReadonlySet<string> = new Set();

function read(
  draft: ClassificationDraft,
  source: PurchaseDetail,
  locked: ReadonlySet<string> = NONE,
) {
  return readClassification(draft, source, MATERIALS, locked);
}

describe('the implication between stock material and company expense', () => {
  const source = purchase([line('a', { isCompanyExpense: false }), line('b')]);

  it('marking a line as stock marks it as a company expense', () => {
    const draft = setStockMaterial(initialDraft(source), 'a', true);
    const marked = draft.lines.find((entry) => entry.itemId === 'a');

    expect(marked?.isStockMaterial).toBe(true);
    expect(marked?.isCompanyExpense).toBe(true);
  });

  it('unmarking the company expense of a stock line unmarks the stock too', () => {
    const stocked = setStockMaterial(initialDraft(source), 'b', true);
    const draft = setCompanyExpense(stocked, 'b', false);
    const result = draft.lines.find((entry) => entry.itemId === 'b');

    expect(result?.isCompanyExpense).toBe(false);
    expect(result?.isStockMaterial).toBe(false);
  });

  it('unmarking the stock keeps the line a company expense', () => {
    const stocked = setStockMaterial(initialDraft(source), 'a', true);
    const draft = setStockMaterial(stocked, 'a', false);
    const result = draft.lines.find((entry) => entry.itemId === 'a');

    expect(result?.isStockMaterial).toBe(false);
    expect(result?.isCompanyExpense).toBe(true);
  });

  it('marking the company expense again does not bring the stock back', () => {
    const stocked = setStockMaterial(initialDraft(source), 'b', true);
    const unmarked = setCompanyExpense(stocked, 'b', false);
    const draft = setCompanyExpense(unmarked, 'b', true);

    expect(draft.lines.find((entry) => entry.itemId === 'b')?.isStockMaterial).toBe(false);
  });

  it('leaves the other lines alone', () => {
    const draft = setStockMaterial(initialDraft(source), 'a', true);

    expect(draft.lines.find((entry) => entry.itemId === 'b')).toEqual(
      initialDraft(source).lines[1],
    );
  });
});

describe('what a stock line needs before the note can be concluded', () => {
  const source = purchase([line('a'), line('b')]);

  function stocked(patch: Parameters<typeof patchStockFields>[2]) {
    return patchStockFields(setStockMaterial(initialDraft(source), 'a', true), 'a', patch);
  }

  it('asks for a material, and for the package, before anything can be sent', () => {
    const reading = read(stocked({}), source);

    expect(reading.blocker).toBe('LINES_INCOMPLETE');
    expect(reading.request).toBeNull();
    expect(reading.lines.get('a')?.issues.material).toBeDefined();
  });

  it('asks for how much the package holds once the material is chosen', () => {
    const reading = read(stocked({ materialId: 'mat-cera' }), source);

    expect(reading.lines.get('a')?.issues.material).toBeUndefined();
    expect(reading.lines.get('a')?.issues.packageQuantity).toMatch(/embalagem contém/);
    expect(reading.lines.get('a')?.unit).toBe('GRAM');
  });

  it('sends a line linked to an existing material with the package in its own unit', () => {
    const reading = read(stocked({ materialId: 'mat-cera', packageQuantity: '1000' }), source);

    expect(reading.blocker).toBeNull();
    expect(reading.request?.items).toEqual([
      {
        itemId: 'a',
        isCompanyExpense: true,
        isStockMaterial: true,
        materialId: 'mat-cera',
        packageQuantity: 1000,
      },
      { itemId: 'b', isCompanyExpense: true, isStockMaterial: false },
    ]);
  });

  it('turns a package typed in the larger unit into the base unit', () => {
    const reading = read(
      stocked({ materialId: 'mat-cera', packageQuantity: '1,5', packageScale: 'major' }),
      source,
    );

    expect(reading.request?.items[0]?.packageQuantity).toBe(1500);
  });

  it('sends exactly the thousandths that were typed, with no float residue', () => {
    const reading = read(stocked({ materialId: 'mat-cera', packageQuantity: '0,145' }), source);

    expect(reading.request?.items[0]?.packageQuantity).toBe(0.145);
  });

  it('refuses a fourth decimal place instead of rounding it', () => {
    const reading = read(stocked({ materialId: 'mat-cera', packageQuantity: '0,1451' }), source);

    expect(reading.lines.get('a')?.issues.packageQuantity).toMatch(/Não entendi/);
    expect(reading.request).toBeNull();
  });

  it('refuses a package of zero', () => {
    const reading = read(stocked({ materialId: 'mat-cera', packageQuantity: '0' }), source);

    expect(reading.lines.get('a')?.issues.packageQuantity).toMatch(/mais do que zero/);
  });

  it('asks for a name and a unit when the material is new, and reads the package in that unit', () => {
    const incomplete = read(stocked({ target: 'NEW' }), source);

    expect(incomplete.lines.get('a')?.issues.newMaterialName).toBeDefined();
    expect(incomplete.lines.get('a')?.issues.newMaterialUnit).toBeDefined();
    expect(incomplete.lines.get('a')?.issues.packageQuantity).toBeUndefined();

    const ready = read(
      stocked({
        target: 'NEW',
        newMaterialName: '  Queijo mussarela ',
        newMaterialUnit: 'GRAM',
        packageQuantity: '200',
      }),
      source,
    );

    expect(ready.blocker).toBeNull();
    expect(ready.request?.items[0]).toEqual({
      itemId: 'a',
      isCompanyExpense: true,
      isStockMaterial: true,
      newMaterial: { name: 'Queijo mussarela', consumptionUnit: 'GRAM' },
      packageQuantity: 200,
    });
  });

  it('does not ask a line that is not stock for anything, and sends it without a material', () => {
    const reading = read(initialDraft(source), source);

    expect(reading.blocker).toBeNull();
    expect(reading.request?.items.every((item) => item.materialId === undefined)).toBe(true);
    expect(reading.request?.items.every((item) => item.packageQuantity === undefined)).toBe(true);
  });

  it('counts what concluding will do', () => {
    const draft = setCompanyExpense(
      patchStockFields(
        patchStockFields(
          setStockMaterial(setStockMaterial(initialDraft(source), 'a', true), 'b', true),
          'a',
          { materialId: 'mat-cera', packageQuantity: '1000' },
        ),
        'b',
        { target: 'NEW', newMaterialName: 'Novo', newMaterialUnit: 'UNIT', packageQuantity: '10' },
      ),
      'b',
      false,
    );
    // "b" stopped being stock when it stopped being a company expense.
    const reading = read(draft, source);

    expect(reading.summary).toEqual({
      stockEntries: 1,
      newMaterials: 0,
      alreadyStocked: 0,
      companyExpenses: 1,
      personalItems: 1,
    });
  });
});

describe('lines the API has already entered into the stock', () => {
  const source = purchase([
    line('a', { isStockMaterial: true, materialId: 'mat-cera' }),
    line('b'),
  ]);

  it('are never sent again, because sending a stock line again enters it again', () => {
    const reading = read(initialDraft(source), source, new Set(['a']));

    expect(reading.request?.items.map((item) => item.itemId)).toEqual(['b']);
    expect(reading.summary.alreadyStocked).toBe(1);
    expect(reading.summary.stockEntries).toBe(0);
  });

  it('leave nothing to conclude when every line is one of them', () => {
    const all = purchase([line('a', { isStockMaterial: true, materialId: 'mat-cera' })]);
    const reading = read(initialDraft(all), all, new Set(['a']));

    expect(reading.blocker).toBe('NOTHING_TO_CLASSIFY');
    expect(reading.request).toBeNull();
  });
});

describe('the discount', () => {
  const lines = [
    line('a', { grossValue: money('20.00') }),
    line('b', { grossValue: money('10.00'), isCompanyExpense: false }),
  ];

  it('is not asked, and not sent, when the note has none', () => {
    const source = purchase(lines);
    const reading = read(setDiscountMode(initialDraft(source), 'MANUAL'), source);

    expect(reading.mode).toBeNull();
    expect(reading.blocker).toBeNull();
    expect(reading.request?.discountAllocationMode).toBeUndefined();
    expect(reading.request?.manualAllocation).toBeUndefined();
  });

  it('keeps the mode the API holds for a note with a discount', () => {
    const source = withDiscount(lines, { discountAllocationMode: 'COMPANY_ONLY' });
    const reading = read(initialDraft(source), source);

    expect(reading.mode).toBe('COMPANY_ONLY');
    expect(reading.request?.discountAllocationMode).toBe('COMPANY_ONLY');
    expect(reading.request?.manualAllocation).toBeUndefined();
  });

  it('asks again when the attribution is pending, whatever the API holds', () => {
    const source = withDiscount(lines, {
      allocationPending: true,
      discountAllocationMode: 'MANUAL',
    });
    const draft = initialDraft(source);
    const pending = read(draft, source);

    expect(draft.mode).toBeNull();
    expect(pending.blocker).toBe('DISCOUNT_MODE_MISSING');
    expect(pending.request).toBeNull();

    const resolved = read(setDiscountMode(draft, 'PROPORTIONAL'), source);

    expect(resolved.blocker).toBeNull();
    expect(resolved.request?.discountAllocationMode).toBe('PROPORTIONAL');
  });

  it('drops a choice that no longer has a line to land on', () => {
    const source = withDiscount(lines, { discountAllocationMode: 'COMPANY_ONLY' });
    const draft = setCompanyExpense(initialDraft(source), 'a', false);

    expect(effectiveDiscountMode(draft)).toBeNull();
    expect(read(draft, source).blocker).toBe('DISCOUNT_MODE_MISSING');
  });

  it('blocks the conclusion while the manual sum is not exactly the discount', () => {
    const source = withDiscount(lines);
    const open = setManualAmount(setDiscountMode(initialDraft(source), 'MANUAL'), 'a', '5,99');
    const reading = read(open, source);

    expect(reading.blocker).toBe('MANUAL_NOT_CLOSED');
    expect(reading.manual?.remaining.equals(money('0.01'))).toBe(true);
    expect(reading.request).toBeNull();
  });

  it('concludes when the manual sum closes, sending only the lines that were given something', () => {
    const source = withDiscount(lines);
    const draft = setManualAmount(
      setManualAmount(setDiscountMode(initialDraft(source), 'MANUAL'), 'a', '4,00'),
      'b',
      '2',
    );
    const reading = read(draft, source);

    expect(reading.blocker).toBeNull();
    expect(reading.request?.discountAllocationMode).toBe('MANUAL');
    expect(reading.request?.manualAllocation).toEqual([
      { itemId: 'a', allocatedDiscount: '4.00' },
      { itemId: 'b', allocatedDiscount: '2.00' },
    ]);
  });

  it('does not send the manual amounts under a mode the API works out itself', () => {
    const source = withDiscount(lines);
    const typed = setManualAmount(setDiscountMode(initialDraft(source), 'MANUAL'), 'a', '6,00');
    const reading = read(setDiscountMode(typed, 'PROPORTIONAL'), source);

    expect(reading.request?.manualAllocation).toBeUndefined();
  });

  it('opens an informed-by-line note with what the API attributed', () => {
    const source = withDiscount(
      [
        line('a', { allocatedDiscount: money('4.00') }),
        line('b', { allocatedDiscount: money('2.00') }),
      ],
      { discountAllocationMode: 'MANUAL' },
    );
    const draft = initialDraft(source);

    expect(draft.manual).toEqual({ a: '4,00', b: '2,00' });
    expect(read(draft, source).blocker).toBeNull();
  });
});

describe('leaving with unsaved choices', () => {
  const source = purchase([line('a')]);

  it('is dirty only when something changed', () => {
    const initial = initialDraft(source);

    expect(isDraftDirty(initial, initialDraft(source))).toBe(false);
    expect(isDraftDirty(initial, setCompanyExpense(initial, 'a', false))).toBe(true);
  });
});
