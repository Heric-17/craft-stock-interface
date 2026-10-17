import { describe, expect, it } from 'vitest';

import { toCsv } from '@/shared/format';
import { EMPTY_SPENDING, spendingDatasetDto } from '@/test/fixtures/spending';

import { toSpendingDataset } from './spending-dataset';
import { buildSpendingReport, spendingReportFileName } from './spending-report';

const SIX_MONTHS = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];

function report(dataset = spendingDatasetDto()) {
  return buildSpendingReport({
    dataset: toSpendingDataset(dataset),
    months: SIX_MONTHS,
    currentMonth: '2026-10',
    periodLabel: 'Últimos 6 meses',
  });
}

describe('buildSpendingReport', () => {
  it('has a row for every month of the period, the one without a purchase at zero, and the totals of the period', () => {
    const rows = report();

    expect(rows).toContainEqual(['Mês', 'Gasto (R$)', 'Economia em descontos (R$)', 'Compras']);
    expect(rows).toContainEqual(['maio de 2026', '300,00', '12,00', '3']);
    expect(rows).toContainEqual(['junho de 2026', '0,00', '0,00', '0']);
    expect(rows).toContainEqual(['agosto de 2026', '200,00', '0,00', '2']);
    expect(rows).toContainEqual(['Total do período', '3130,50', '112,50', '20']);
  });

  it('marks the running month as not finished', () => {
    expect(report()).toContainEqual(['outubro de 2026 (em andamento)', '1180,00', '30,50', '6']);
    expect(report()).not.toContainEqual(
      expect.arrayContaining(['setembro de 2026 (em andamento)']),
    );
  });

  it('lists the shops with what was paid and the purchases, the CNPJ for one with no name and a plain label for no shop', () => {
    const rows = report();

    expect(rows).toContainEqual(['Casa das Essências', '1500,00', '60,00', '8']);
    expect(rows).toContainEqual(['11222333000144', '400,00', '12,00', '3']);
    expect(rows).toContainEqual(['Sem estabelecimento', '330,00', '10,00', '2']);
  });

  it('splits stock from other company expenses by amount and share, and offers no count for it', () => {
    const rows = report();

    expect(rows).toContainEqual(['Tipo', 'Gasto (R$)', 'Participação (%)']);
    expect(rows).toContainEqual(['Insumo de estoque', '2191,35', '70,0']);
    expect(rows).toContainEqual(['Só gasto da empresa', '939,15', '30,0']);
  });

  it('is a report of zeros, not an empty file, for a period with no purchase', () => {
    const rows = buildSpendingReport({
      dataset: toSpendingDataset(EMPTY_SPENDING),
      months: SIX_MONTHS,
      currentMonth: '2026-10',
      periodLabel: 'Últimos 6 meses',
    });

    expect(rows).toContainEqual(['Total do período', '0,00', '0,00', '0']);
    expect(rows).toContainEqual(['Insumo de estoque', '0,00', '']);
  });

  it('becomes a file with semicolons, amounts in Brazilian form and no currency symbol in the cells', () => {
    const csv = toCsv(report());
    const lines = csv.split('\r\n');

    expect(lines).toContain('Mês;Gasto (R$);Economia em descontos (R$);Compras');
    expect(lines).toContain('maio de 2026;300,00;12,00;3');
    expect(lines).toContain('Total do período;3130,50;112,50;20');
    // The cells are numbers a spreadsheet can add up.
    expect(csv).not.toMatch(/R\$\s?\d/);
  });
});

describe('spendingReportFileName', () => {
  it('says which months the file covers', () => {
    expect(spendingReportFileName(SIX_MONTHS)).toBe('gastos-2026-05-a-2026-10.csv');
    expect(spendingReportFileName(['2026-10'])).toBe('gastos-2026-10.csv');
  });
});
