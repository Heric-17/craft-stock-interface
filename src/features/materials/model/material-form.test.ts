import { describe, expect, it } from 'vitest';

import { cera, materialDto } from '@/test/fixtures/materials';

import { toMaterial } from './material';
import {
  buildCreateRequest,
  buildUpdate,
  EMPTY_MATERIAL_FORM,
  hasChanges,
  materialFormSchema,
  materialFormValuesFrom,
  packageCostChanged,
  readMaterialForm,
  type MaterialFormValues,
} from './material-form';

function form(overrides: Partial<MaterialFormValues> = {}): MaterialFormValues {
  return {
    name: 'Cera de soja',
    consumptionUnit: 'GRAM',
    packageQuantity: '1000',
    packageScale: 'base',
    packageCost: '28,00',
    minimumStockAlert: '300',
    ...overrides,
  };
}

function parsed(values: MaterialFormValues) {
  const { parsed: result } = readMaterialForm(values);

  if (result === null) {
    throw new Error('the form was expected to be valid');
  }

  return result;
}

function issuePaths(values: MaterialFormValues): string[] {
  return readMaterialForm(values).issues.map((issue) => issue.path);
}

describe('the package quantity, typed in a larger unit', () => {
  it('turns 1,5 kg into 1500 g', () => {
    const request = buildCreateRequest(
      parsed(form({ packageQuantity: '1,5', packageScale: 'major' })),
    );

    expect(request.packageQuantity).toBe(1500);
    expect(request.consumptionUnit).toBe('GRAM');
  });

  it('turns 2 L into 2000 ml and 1,5 m into 150 cm', () => {
    expect(
      buildCreateRequest(
        parsed(
          form({ consumptionUnit: 'MILLILITER', packageQuantity: '2', packageScale: 'major' }),
        ),
      ).packageQuantity,
    ).toBe(2000);
    expect(
      buildCreateRequest(
        parsed(
          form({ consumptionUnit: 'CENTIMETER', packageQuantity: '1,5', packageScale: 'major' }),
        ),
      ).packageQuantity,
    ).toBe(150);
  });

  it('sends what was typed in the base unit as it is', () => {
    expect(buildCreateRequest(parsed(form({ packageQuantity: '1000' }))).packageQuantity).toBe(
      1000,
    );
  });

  it('reads 0,145 in the base unit as 0,145, not 145', () => {
    expect(buildCreateRequest(parsed(form({ packageQuantity: '0,145' }))).packageQuantity).toBe(
      0.145,
    );
  });

  it('has no larger unit for UNIT: a major scale changes nothing', () => {
    const request = buildCreateRequest(
      parsed(form({ consumptionUnit: 'UNIT', packageQuantity: '12', packageScale: 'major' })),
    );

    expect(request.packageQuantity).toBe(12);
  });

  it('refuses a fourth decimal place instead of rounding it', () => {
    expect(issuePaths(form({ packageQuantity: '0,1455' }))).toEqual(['packageQuantity']);
  });
});

describe('an empty field is not a zero', () => {
  const EMPTY_WITH_UNIT = { ...EMPTY_MATERIAL_FORM, consumptionUnit: 'GRAM' };

  it('asks for every required field and sends nothing', () => {
    const reading = readMaterialForm(EMPTY_WITH_UNIT);

    expect(reading.parsed).toBeNull();
    expect(reading.issues.map((issue) => issue.path).sort()).toEqual([
      'minimumStockAlert',
      'name',
      'packageCost',
      'packageQuantity',
    ]);
  });

  it('says what is missing in plain words, not as a zero', () => {
    const messages = readMaterialForm(EMPTY_WITH_UNIT).issues.map((issue) => issue.message);

    expect(messages).toContain('Informe quanto a embalagem contém.');
    expect(messages).toContain('Informe o custo da embalagem.');
    expect(messages).toContain('Informe o estoque mínimo. Digite 0 se não quiser alerta.');
  });

  it('accepts zero for the minimum, because zero was typed on purpose', () => {
    const request = buildCreateRequest(parsed(form({ minimumStockAlert: '0' })));

    expect(request.minimumStockAlert).toBe(0);
  });

  it('leaves the choice of unit empty until somebody makes it', () => {
    expect(EMPTY_MATERIAL_FORM.consumptionUnit).toBe('');
    expect(issuePaths(form({ consumptionUnit: '' }))).toContain('consumptionUnit');
  });

  it('refuses a package that contains nothing', () => {
    expect(issuePaths(form({ packageQuantity: '0' }))).toEqual(['packageQuantity']);
  });

  it('does not accept whitespace as a name', () => {
    expect(issuePaths(form({ name: '   ' }))).toEqual(['name']);
  });

  it('reports all of them at once through the Zod schema, on the field each one names', () => {
    const result = materialFormSchema.safeParse(EMPTY_WITH_UNIT);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0]).sort()).toEqual([
      'minimumStockAlert',
      'name',
      'packageCost',
      'packageQuantity',
    ]);
  });
});

describe('the package cost', () => {
  it('sends cents, with a point, as the API validates them', () => {
    expect(buildCreateRequest(parsed(form({ packageCost: '1.284,7' }))).packageCost).toBe(
      '1284.70',
    );
  });

  it('refuses a third decimal place instead of rounding it', () => {
    expect(issuePaths(form({ packageCost: '28,005' }))).toEqual(['packageCost']);
  });

  it('refuses text that is not an amount', () => {
    expect(issuePaths(form({ packageCost: 'vinte' }))).toEqual(['packageCost']);
  });

  it('refuses a negative cost', () => {
    expect(issuePaths(form({ packageCost: '-3' }))).toEqual(['packageCost']);
  });
});

describe('registering a material', () => {
  it('starts with no stock: the stock enters through "Dar entrada"', () => {
    expect(buildCreateRequest(parsed(form())).stockQuantity).toBe(0);
  });

  it('sends exactly what the form means, and no image field', () => {
    expect(buildCreateRequest(parsed(form()))).toEqual({
      name: 'Cera de soja',
      packageCost: '28.00',
      packageQuantity: 1000,
      consumptionUnit: 'GRAM',
      stockQuantity: 0,
      minimumStockAlert: 300,
    });
  });
});

describe('editing a material', () => {
  const original = toMaterial(cera);

  it('fills the form with text that reads back to the same values', () => {
    const values = materialFormValuesFrom(original);

    expect(values).toEqual({
      name: 'Cera de soja',
      consumptionUnit: 'GRAM',
      packageQuantity: '1000',
      packageScale: 'base',
      packageCost: '28,00',
      minimumStockAlert: '300',
    });
    expect(hasChanges(buildUpdate(parsed(values), original))).toBe(false);
  });

  it('sends only what changed', () => {
    const update = buildUpdate(parsed(form({ name: 'Cera de soja premium' })), original);

    expect(update).toEqual({ consumptionUnit: null, patch: { name: 'Cera de soja premium' } });
  });

  it('sends the new package cost when it differs, as cents', () => {
    const update = buildUpdate(parsed(form({ packageCost: '30' })), original);

    expect(update.patch).toEqual({ packageCost: '30.00' });
  });

  it('does not send a package cost that was only retyped the same', () => {
    expect(buildUpdate(parsed(form({ packageCost: '28' })), original).patch).toEqual({});
  });

  it('puts the unit change first and sends the quantities in the new unit', () => {
    const empty = toMaterial(materialDto({ stockQuantity: 0 }));
    const update = buildUpdate(parsed(form({ consumptionUnit: 'MILLILITER' })), empty);

    expect(update.consumptionUnit).toBe('MILLILITER');
    expect(update.patch).toEqual({ packageQuantity: 1000, minimumStockAlert: 300 });
  });

  it('does nothing when nothing changed', () => {
    expect(hasChanges({ consumptionUnit: null, patch: {} })).toBe(false);
  });

  it('knows when the typed package cost is a new one, for the warning', () => {
    expect(packageCostChanged('28,00', original)).toBe(false);
    expect(packageCostChanged('28', original)).toBe(false);
    expect(packageCostChanged('30,00', original)).toBe(true);
    expect(packageCostChanged('', original)).toBe(false);
    expect(packageCostChanged('abc', original)).toBe(false);
  });
});
