import { useCompositeProducts } from '@/features/composite-products';
import { useMaterials } from '@/features/materials';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';

import { NewSaleForm } from '../components/new-sale-form';

/**
 * A sale being registered, in a screen of its own. It needs the products and
 * materials that can be sold, which are the **active** ones: a discontinued
 * product or material is not offered for a new sale, and the API would refuse
 * it anyway. They stay in the history of the sales that already have them.
 */
export function NewSalePage() {
  const products = useCompositeProducts({ includeDiscontinued: false });
  const materials = useMaterials({ includeDiscontinued: false });

  if (products.isPending || materials.isPending) {
    return <LoadingSkeleton variant="form" />;
  }

  if (products.isError) {
    return (
      <ErrorState
        error={products.error}
        title="Não foi possível carregar os produtos"
        onRetry={() => void products.refetch()}
        retrying={products.isFetching}
      />
    );
  }

  if (materials.isError) {
    return (
      <ErrorState
        error={materials.error}
        title="Não foi possível carregar os insumos"
        onRetry={() => void materials.refetch()}
        retrying={materials.isFetching}
      />
    );
  }

  return <NewSaleForm products={products.data} materials={materials.data} />;
}
