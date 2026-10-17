import { useState } from 'react';

import type { PeriodPreset } from '@/shared/format';
import { PageHeader } from '@/shared/ui/page-header';
import { PeriodField } from '@/shared/ui/period-field';

import { EstablishmentRanking } from '../components/establishment-ranking';
import { ExportReportButton } from '../components/export-report-button';
import { MonthlySpendChart } from '../components/monthly-spend-chart';
import { RecentPurchases } from '../components/recent-purchases';
import { SpendingHelp } from '../components/spending-help';
import { SpendingSummaryCards } from '../components/spending-summary-cards';
import { usePeriodWindow } from '../components/use-period-window';

/** Six months is what the mockup opens on: enough to see a trend, few enough to read. */
const DEFAULT_PRESET: PeriodPreset = 'LAST_6_MONTHS';

interface SpendingPageProps {
  /** Where the list of purchases is. */
  purchasesPath: string;
  /** Where one purchase opens. */
  purchasePath: (purchaseId: string) => string;
  /** Where importing a note goes. */
  importPath: string;
}

/**
 * Where the company's money went: the figures, the months, the shops and the
 * latest purchases. Everything is derived from the spending dataset and read in
 * `model/`; the only list here is the recent purchases, which is shown and never
 * added up.
 */
export function SpendingPage({ purchasesPath, purchasePath, importPath }: SpendingPageProps) {
  const [preset, setPreset] = useState<PeriodPreset>(DEFAULT_PRESET);
  const scope = usePeriodWindow(preset);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Gastos da empresa"
        description="Entenda para onde está indo o dinheiro do seu negócio."
        actions={<ExportReportButton scope={scope} />}
      />

      {/* Whole calendar months only: a period that starts mid-month would draw its first month as if it were complete. */}
      <PeriodField
        value={{ kind: 'preset', preset }}
        allowCustom={false}
        onChange={(next) => {
          if (next.kind === 'preset') {
            setPreset(next.preset);
          }
        }}
      />

      <SpendingSummaryCards scope={scope} />

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <MonthlySpendChart scope={scope} importPath={importPath} />
        </div>
        <EstablishmentRanking scope={scope} purchasesPath={purchasesPath} />
      </div>

      <RecentPurchases
        purchasesPath={purchasesPath}
        purchasePath={purchasePath}
        importPath={importPath}
      />

      <SpendingHelp />
    </div>
  );
}
