/**
 * The suggested-price contract, ported case by case from
 * `craft-stock-api/docs/pricing-formula.md` sections 5 and 6 — the table and
 * the same table as JSON, which the document names as the frontend's fixture.
 * The backend runs them in
 * `src/modules/composite-products/domain/composite-product-pricing.spec.ts`.
 *
 * There is no simulation endpoint, so the screen computes this figure while a
 * `BillOfMaterials` is still being edited, and the preview and the saved value
 * come from two implementations of one formula. They have to agree to the
 * cent, which is what makes these cases a contract and not a test: changing
 * one means changing both sides.
 *
 * The order of operations, and the two places rounding happens:
 *
 *  1. `lineCost = round(packageCost x quantity / packageQuantity)`, per line,
 *     multiplied before divided, rounded once;
 *  2. `materialsCost` is the sum of the already rounded lines;
 *  3. `totalCost = materialsCost + fixedOperationalCost`, exact;
 *  4. `suggestedPrice = round(totalCost x (10000 + bp) / 10000)`, the margin
 *     applied to the total and never per line;
 *  5. `finalPrice = manualPrice ?? suggestedPrice`.
 *
 * `WRONG_ORDER_CASES` is documentation of what not to reproduce: each one
 * carries the result a plausible wrong order produces, and the test asserts
 * the right one and denies that one.
 */

export interface PricingLine {
  packageCost: string;
  quantity: string;
  packageQuantity: string;
}

export interface PricingCase {
  name: string;
  description: string;
  input: {
    lines: readonly PricingLine[];
    fixedOperationalCost: string;
    profitMarginBasisPoints: number;
    manualPrice: string | null;
  };
  expected: {
    lineCosts: readonly string[];
    materialsCost: string;
    totalCost: string;
    suggestedPrice: string;
    finalPrice: string;
  };
}

export interface WrongOrderCase extends PricingCase {
  wrongMethod: string;
  wrongSuggestedPrice: string;
}

export const PRICING_CASES: readonly PricingCase[] = [
  {
    name: 'zero-margin-sells-at-cost',
    description: 'Margem 0%: o preço sugerido é o custo total.',
    input: {
      lines: [{ packageCost: '28.00', quantity: '120', packageQuantity: '1000' }],
      fixedOperationalCost: '0.00',
      profitMarginBasisPoints: 0,
      manualPrice: null,
    },
    expected: {
      lineCosts: ['3.36'],
      materialsCost: '3.36',
      totalCost: '3.36',
      suggestedPrice: '3.36',
      finalPrice: '3.36',
    },
  },
  {
    name: 'hundred-percent-margin',
    description: 'Margem 100% (10000 bp) dobra o custo.',
    input: {
      lines: [{ packageCost: '28.00', quantity: '120', packageQuantity: '1000' }],
      fixedOperationalCost: '0.00',
      profitMarginBasisPoints: 10_000,
      manualPrice: null,
    },
    expected: {
      lineCosts: ['3.36'],
      materialsCost: '3.36',
      totalCost: '3.36',
      suggestedPrice: '6.72',
      finalPrice: '6.72',
    },
  },
  {
    name: 'margin-33-33-percent',
    description: 'Margem 33,33% (3333 bp), custo 10,01: 1334,633 ¢ arredonda para 1335 ¢.',
    input: {
      lines: [{ packageCost: '10.01', quantity: '1', packageQuantity: '1' }],
      fixedOperationalCost: '0.00',
      profitMarginBasisPoints: 3333,
      manualPrice: null,
    },
    expected: {
      lineCosts: ['10.01'],
      materialsCost: '10.01',
      totalCost: '10.01',
      suggestedPrice: '13.35',
      finalPrice: '13.35',
    },
  },
  {
    name: 'margin-33-33-percent-rounds-down',
    description: 'Margem 33,33%, custo 0,03: 3,9999 ¢ arredonda para 4 ¢.',
    input: {
      lines: [{ packageCost: '0.03', quantity: '1', packageQuantity: '1' }],
      fixedOperationalCost: '0.00',
      profitMarginBasisPoints: 3333,
      manualPrice: null,
    },
    expected: {
      lineCosts: ['0.03'],
      materialsCost: '0.03',
      totalCost: '0.03',
      suggestedPrice: '0.04',
      finalPrice: '0.04',
    },
  },
  {
    name: 'fixed-cost-and-exact-tie',
    description:
      'Custo fixo > 0 e margem 35%: 490 ¢ × 1,35 = 661,5 ¢, empate exato, arredonda para longe do zero (662 ¢).',
    input: {
      lines: [{ packageCost: '20.00', quantity: '120', packageQuantity: '1000' }],
      fixedOperationalCost: '2.50',
      profitMarginBasisPoints: 3500,
      manualPrice: null,
    },
    expected: {
      lineCosts: ['2.40'],
      materialsCost: '2.40',
      totalCost: '4.90',
      suggestedPrice: '6.62',
      finalPrice: '6.62',
    },
  },
  {
    name: 'tie-decided-by-the-rule-not-by-float',
    description:
      'Custo 1,25 e margem 34,80%: 168,5 ¢ exatos, vira 169 ¢. Em float 125 × 1,348 dá 168,49999… e vira 168.',
    input: {
      lines: [{ packageCost: '1.25', quantity: '1', packageQuantity: '1' }],
      fixedOperationalCost: '0.00',
      profitMarginBasisPoints: 3480,
      manualPrice: null,
    },
    expected: {
      lineCosts: ['1.25'],
      materialsCost: '1.25',
      totalCost: '1.25',
      suggestedPrice: '1.69',
      finalPrice: '1.69',
    },
  },
  {
    name: 'several-lines-with-fixed-cost',
    description:
      'Três linhas (2,40 + 1,80 + 2,00) mais custo fixo 2,50 e margem 25%: 1087,5 ¢ arredonda para 1088 ¢.',
    input: {
      lines: [
        { packageCost: '20.00', quantity: '120', packageQuantity: '1000' },
        { packageCost: '30.00', quantity: '60', packageQuantity: '1000' },
        { packageCost: '1.00', quantity: '2', packageQuantity: '1' },
      ],
      fixedOperationalCost: '2.50',
      profitMarginBasisPoints: 2500,
      manualPrice: null,
    },
    expected: {
      lineCosts: ['2.40', '1.80', '2.00'],
      materialsCost: '6.20',
      totalCost: '8.70',
      suggestedPrice: '10.88',
      finalPrice: '10.88',
    },
  },
  {
    name: 'manual-price-overrides-the-suggestion',
    description: 'O preço manual vence no finalPrice; o sugerido continua calculado.',
    input: {
      lines: [{ packageCost: '20.00', quantity: '120', packageQuantity: '1000' }],
      fixedOperationalCost: '2.50',
      profitMarginBasisPoints: 3500,
      manualPrice: '12.00',
    },
    expected: {
      lineCosts: ['2.40'],
      materialsCost: '2.40',
      totalCost: '4.90',
      suggestedPrice: '6.62',
      finalPrice: '12.00',
    },
  },
  {
    name: 'no-materials-only-fixed-cost',
    description: 'Ficha técnica vazia: o custo fixo sozinho recebe a margem.',
    input: {
      lines: [],
      fixedOperationalCost: '2.50',
      profitMarginBasisPoints: 5000,
      manualPrice: null,
    },
    expected: {
      lineCosts: [],
      materialsCost: '0.00',
      totalCost: '2.50',
      suggestedPrice: '3.75',
      finalPrice: '3.75',
    },
  },
  {
    name: 'largest-margin-the-column-holds',
    description: 'Margem 999,99% (99999 bp), o teto: 1 ¢ × 10,9999 = 10,9999 ¢ vira 11 ¢.',
    input: {
      lines: [{ packageCost: '0.01', quantity: '1', packageQuantity: '1' }],
      fixedOperationalCost: '0.00',
      profitMarginBasisPoints: 99_999,
      manualPrice: null,
    },
    expected: {
      lineCosts: ['0.01'],
      materialsCost: '0.01',
      totalCost: '0.01',
      suggestedPrice: '0.11',
      finalPrice: '0.11',
    },
  },
];

export const WRONG_ORDER_CASES: readonly WrongOrderCase[] = [
  {
    name: 'unit-cost-rounded-before-multiplying',
    description:
      'Dividir primeiro: 2800 ¢ ÷ 1000 g = 2,8 ¢/g, arredondado para 3 ¢/g; × 120 g = 360 ¢. Certo: multiplicar antes, 2800 × 120 ÷ 1000 = 336 ¢.',
    input: {
      lines: [{ packageCost: '28.00', quantity: '120', packageQuantity: '1000' }],
      fixedOperationalCost: '0.00',
      profitMarginBasisPoints: 0,
      manualPrice: null,
    },
    wrongMethod: 'round(packageCost ÷ packageQuantity) × quantity',
    wrongSuggestedPrice: '3.60',
    expected: {
      lineCosts: ['3.36'],
      materialsCost: '3.36',
      totalCost: '3.36',
      suggestedPrice: '3.36',
      finalPrice: '3.36',
    },
  },
  {
    name: 'margin-applied-per-line-then-summed',
    description:
      'Duas linhas de 1,25 e margem 34,80%: 168,5 ¢ por linha arredonda para 169 ¢, somando 338 ¢. Certo: somar o custo (250 ¢) e aplicar a margem uma vez, 337 ¢.',
    input: {
      lines: [
        { packageCost: '1.25', quantity: '1', packageQuantity: '1' },
        { packageCost: '1.25', quantity: '1', packageQuantity: '1' },
      ],
      fixedOperationalCost: '0.00',
      profitMarginBasisPoints: 3480,
      manualPrice: null,
    },
    wrongMethod: 'Σ round(lineCost × (10000 + bp) ÷ 10000)',
    wrongSuggestedPrice: '3.38',
    expected: {
      lineCosts: ['1.25', '1.25'],
      materialsCost: '2.50',
      totalCost: '2.50',
      suggestedPrice: '3.37',
      finalPrice: '3.37',
    },
  },
  {
    name: 'floating-point-factor',
    description:
      'Fator em ponto flutuante: 125 × (1 + 3480 / 10000) é 168,49999999999997 e arredonda para 168 ¢; o valor exato é 168,5 ¢ e arredonda para 169 ¢.',
    input: {
      lines: [{ packageCost: '1.25', quantity: '1', packageQuantity: '1' }],
      fixedOperationalCost: '0.00',
      profitMarginBasisPoints: 3480,
      manualPrice: null,
    },
    wrongMethod: 'Math.round(totalCents * (1 + bp / 10000))',
    wrongSuggestedPrice: '1.68',
    expected: {
      lineCosts: ['1.25'],
      materialsCost: '1.25',
      totalCost: '1.25',
      suggestedPrice: '1.69',
      finalPrice: '1.69',
    },
  },
];
