import { ArrowLeft, FileX } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { useMaterials } from '@/features/materials';
import { isApiError } from '@/shared/api/api-error';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';
import { PageHeader } from '@/shared/ui/page-header';

import { usePurchase } from '../api/use-purchases';
import { ClassificationScreen } from '../components/classification-screen';

interface InvoiceClassificationPageProps {
  /** Where the notes are listed: the way back, and where a concluded note goes. */
  historyPath: string;
}

/**
 * The second step of an import, for the purchase the address names. The note and
 * the materials it can be linked to are read first; the screen under them is
 * mounted only once both are here, so its draft starts from the note as the API
 * has it and a later refetch cannot overwrite what is being typed.
 */
export function InvoiceClassificationPage({ historyPath }: InvoiceClassificationPageProps) {
  const { purchaseId = '' } = useParams();
  const purchase = usePurchase(purchaseId);
  // Discontinued ones too: a line may already point at one, and its name is shown.
  const materials = useMaterials({ includeDiscontinued: true });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          to={historyPath}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 self-start text-sm"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar para as notas
        </Link>
        <PageHeader
          eyebrow="Operação"
          title="Classificar nota"
          description="Passo 2 de 2: diga o que cada item da nota é e como dividir o desconto."
        />
      </div>

      {purchase.isPending || materials.isPending ? (
        <LoadingSkeleton variant="cards" count={3} />
      ) : purchase.isError ? (
        isApiError(purchase.error) && purchase.error.code === 'PURCHASE_NOT_FOUND' ? (
          <EmptyState
            icon={FileX}
            title="Nota não encontrada"
            description="Esta nota não existe mais ou o endereço está incorreto."
            action={
              <Button asChild variant="outline">
                <Link to={historyPath}>Ver as notas importadas</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState
            error={purchase.error}
            title="Não foi possível carregar a nota"
            onRetry={() => void purchase.refetch()}
            retrying={purchase.isFetching}
          />
        )
      ) : materials.isError ? (
        <ErrorState
          error={materials.error}
          title="Não foi possível carregar os insumos"
          onRetry={() => void materials.refetch()}
          retrying={materials.isFetching}
        />
      ) : (
        <ClassificationScreen
          key={purchase.data.id}
          purchase={purchase.data}
          materials={materials.data}
          historyPath={historyPath}
        />
      )}
    </div>
  );
}
