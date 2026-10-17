import { ArrowLeft, ListChecks, Pencil } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { ClassificationSummary, usePurchase, type PurchaseDetail } from '@/features/invoices';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { FormSection } from '@/shared/ui/form-section';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';

import { PurchaseLines } from '../components/purchase-lines';
import { DISCOUNT_TO_DISTRIBUTE, DISCOUNT_TO_DISTRIBUTE_EXPLANATION } from '../model/labels';

interface PurchaseDetailPageProps {
  /** Where the list of purchases is. */
  purchasesPath: string;
  /** Where the classification of a given purchase is: where "Editar" leads. */
  classificationPath: (purchaseId: string) => string;
}

/**
 * One purchase: who it was bought from, the three totals and its lines with the
 * classification of each. It is a reading. Changing what a line is, or how the
 * discount is spread, happens on the classification screen, which "Editar" opens.
 */
export function PurchaseDetailPage({ purchasesPath, classificationPath }: PurchaseDetailPageProps) {
  const { id } = useParams();

  return id === undefined ? null : (
    <PurchaseDetailView
      key={id}
      id={id}
      purchasesPath={purchasesPath}
      classificationPath={classificationPath}
    />
  );
}

function BackLink({ purchasesPath }: { purchasesPath: string }) {
  return (
    <Link
      to={purchasesPath}
      className="text-accent-foreground hover:bg-accent inline-flex min-h-11 items-center gap-2 self-start rounded-md px-2 text-sm font-medium"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Voltar para as compras
    </Link>
  );
}

function PurchaseDetailView({
  id,
  purchasesPath,
  classificationPath,
}: PurchaseDetailPageProps & { id: string }) {
  const purchase = usePurchase(id);

  if (purchase.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink purchasesPath={purchasesPath} />
        <LoadingSkeleton variant="form" />
      </div>
    );
  }

  if (purchase.isError) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink purchasesPath={purchasesPath} />
        <ErrorState
          error={purchase.error}
          title="Não foi possível abrir esta compra"
          onRetry={() => void purchase.refetch()}
          retrying={purchase.isFetching}
        />
      </div>
    );
  }

  return (
    <PurchaseView
      purchase={purchase.data}
      purchasesPath={purchasesPath}
      classificationPath={classificationPath}
    />
  );
}

function PurchaseView({
  purchase,
  purchasesPath,
  classificationPath,
}: PurchaseDetailPageProps & { purchase: PurchaseDetail }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <BackLink purchasesPath={purchasesPath} />
        <Button asChild variant="outline">
          <Link to={classificationPath(purchase.id)}>
            <Pencil aria-hidden="true" />
            Editar classificação
          </Link>
        </Button>
      </div>

      <ClassificationSummary purchase={purchase} />

      {purchase.allocationPending ? (
        <Callout tone="warning" alert>
          <p className="font-semibold">{DISCOUNT_TO_DISTRIBUTE}</p>
          <p className="text-pretty">
            {DISCOUNT_TO_DISTRIBUTE_EXPLANATION} Abra a classificação para distribuir o desconto.
          </p>
        </Callout>
      ) : null}

      <FormSection
        title="Itens da compra"
        description="O valor líquido é o valor bruto menos o desconto atribuído ao item. Itens pessoais não entram nos gastos da empresa."
        icon={ListChecks}
        tone="info"
      >
        {purchase.lines.length === 0 ? (
          <EmptyState
            title="Esta compra não tem itens"
            description="Não há nada para listar aqui."
            className="border-0"
          />
        ) : (
          <PurchaseLines lines={purchase.lines} />
        )}
      </FormSection>
    </div>
  );
}
