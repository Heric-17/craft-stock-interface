import { FileDown } from 'lucide-react';
import { toast } from 'sonner';

import { formatPeriodPreset, toCsv } from '@/shared/format';
import { downloadTextFile } from '@/shared/lib/download';
import { Button } from '@/shared/ui/button';

import { useSpendingDataset } from '../api/use-spending-dataset';
import { buildSpendingReport, spendingReportFileName } from '../model/spending-report';

import type { PeriodWindow } from './use-period-window';

/**
 * Saves the period's figures as a CSV for a spreadsheet. The file is built here,
 * from the dataset the screen already holds and through the same derivations, and
 * nothing is sent anywhere. It is off until the dataset is there, because a report
 * of a period that has not loaded would be an empty one.
 */
export function ExportReportButton({ scope }: { scope: PeriodWindow }) {
  const dataset = useSpendingDataset(scope.range);

  function exportReport() {
    if (dataset.data === undefined) {
      return;
    }

    const rows = buildSpendingReport({
      dataset: dataset.data,
      months: scope.months,
      currentMonth: scope.currentMonth,
      periodLabel: formatPeriodPreset(scope.preset),
    });

    downloadTextFile(spendingReportFileName(scope.months), toCsv(rows), 'text/csv');
    toast.success('Relatório exportado.');
  }

  return (
    <Button type="button" variant="outline" disabled={!dataset.isSuccess} onClick={exportReport}>
      <FileDown aria-hidden="true" />
      Exportar relatório
    </Button>
  );
}
