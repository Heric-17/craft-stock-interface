import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { resolvePeriod, type PeriodSelection } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { PageHeader } from '@/shared/ui/page-header';
import { PeriodField } from '@/shared/ui/period-field';

import { PurchaseHistory } from '../components/purchase-history';

/**
 * A year back, because the screen is for finding a note and not for the month's
 * figures. Any other stretch is one choice away in the field.
 */
const DEFAULT_PERIOD: PeriodSelection = { kind: 'preset', preset: 'LAST_12_MONTHS' };

interface ImportedInvoicesPageProps {
  /** Where the second step of a given purchase is. */
  classificationPath: (purchaseId: string) => string;
  /** Where importing a note goes. */
  importPath: string;
}

/**
 * Every note that was imported, newest first, for the period chosen. The API
 * filters purchases by period and by shop, and does not search by text: a note
 * is found by when it came in.
 */
export function ImportedInvoicesPage({
  classificationPath,
  importPath,
}: ImportedInvoicesPageProps) {
  const [period, setPeriod] = useState<PeriodSelection>(DEFAULT_PERIOD);
  const resolution = resolvePeriod(period);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operação"
        title="Notas importadas"
        description="Todas as notas fiscais que entraram no sistema, da mais recente para a mais antiga."
        actions={
          <Button asChild variant="outline">
            <Link to={importPath}>
              <ArrowLeft aria-hidden="true" />
              Importar nota
            </Link>
          </Button>
        }
      />

      <PeriodField value={period} onChange={setPeriod} label="Data da nota" />

      {resolution.ok ? (
        <PurchaseHistory
          period={{ from: resolution.range.from, to: resolution.range.to }}
          importPath={importPath}
          classificationPath={classificationPath}
        />
      ) : (
        <Callout tone="info">
          {resolution.reason === 'INCOMPLETE'
            ? 'Escolha o primeiro e o último dia do período para ver as notas.'
            : 'Corrija o período: a data final vem antes da inicial.'}
        </Callout>
      )}
    </div>
  );
}
