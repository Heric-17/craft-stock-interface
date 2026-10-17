import { ArrowLeft, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { resolvePeriod, type PeriodSelection } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { PageHeader } from '@/shared/ui/page-header';
import { PeriodField } from '@/shared/ui/period-field';

import { PurchaseList } from '../components/purchase-list';
import { readPurchasesFilter, withoutEstablishment } from '../model/purchase-link';

/**
 * A year back, because the screen is for finding a purchase and not for the
 * month's figures. Any other stretch is one choice away in the field. A row of
 * the ranking opens this list with its own period.
 */
const DEFAULT_PERIOD: PeriodSelection = { kind: 'preset', preset: 'LAST_12_MONTHS' };

interface PurchasesPageProps {
  /** Where one purchase opens. */
  purchasePath: (purchaseId: string) => string;
  /** Where the classification of a given purchase is: what "Classificar" opens. */
  classificationPath: (purchaseId: string) => string;
  /** Where the spending panel is. */
  spendingPath: string;
  /** Where importing a note goes. */
  importPath: string;
}

/**
 * Every purchase, newest first, for the period and the shop chosen. The ranking
 * of the panel opens this list narrowed to a shop, through the address, so the
 * list a row leads to is the one the row was about.
 *
 * The API filters by period and by shop and does not search by text: a purchase
 * is found by when it was made and where.
 */
export function PurchasesPage({
  purchasePath,
  classificationPath,
  spendingPath,
  importPath,
}: PurchasesPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { establishmentId, preset } = readPurchasesFilter(searchParams);
  // What the address asked for starts the field; from then on the field is what decides.
  const [period, setPeriod] = useState<PeriodSelection>(
    preset === undefined ? DEFAULT_PERIOD : { kind: 'preset', preset },
  );
  const resolution = resolvePeriod(period);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Compras"
        description="Todas as compras que entraram no sistema, da mais recente para a mais antiga."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={spendingPath}>
                <ArrowLeft aria-hidden="true" />
                Gastos da empresa
              </Link>
            </Button>
            <Button asChild>
              <Link to={importPath}>
                <ScanLine aria-hidden="true" />
                Importar nota
              </Link>
            </Button>
          </>
        }
      />

      <PeriodField value={period} onChange={setPeriod} label="Data da compra" />

      {resolution.ok ? (
        <PurchaseList
          period={{ from: resolution.range.from, to: resolution.range.to }}
          establishmentId={establishmentId}
          purchasePath={purchasePath}
          classificationPath={classificationPath}
          importPath={importPath}
          onClearEstablishment={() => setSearchParams(withoutEstablishment(searchParams))}
        />
      ) : (
        <Callout tone="info">
          {resolution.reason === 'INCOMPLETE'
            ? 'Escolha o primeiro e o último dia do período para ver as compras.'
            : 'Corrija o período: a data final vem antes da inicial.'}
        </Callout>
      )}
    </div>
  );
}
