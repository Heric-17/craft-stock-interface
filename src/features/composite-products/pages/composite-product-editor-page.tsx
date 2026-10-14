import { useParams } from 'react-router';

import { useMaterials } from '@/features/materials';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';

import { useCompositeProduct } from '../api/use-composite-products';
import { CompositeProductEditor } from '../components/composite-product-editor';

/**
 * The editor of a product, in a screen of its own: `nova` for a new one and
 * `:id` for a saved one. The same page serves both, and what differs is
 * whether there is a product to read.
 *
 * The materials come with it, discontinued ones included. A line of the bill
 * is priced by its material's package and may point at one that has since been
 * discontinued; only the picker leaves those out.
 */
export function CompositeProductEditorPage() {
  const { id } = useParams();

  return id === undefined ? <NewProduct /> : <SavedProduct key={id} id={id} />;
}

function useEditorMaterials() {
  return useMaterials({ includeDiscontinued: true });
}

function NewProduct() {
  const materials = useEditorMaterials();

  if (materials.isPending) {
    return <LoadingSkeleton variant="form" />;
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

  return <CompositeProductEditor materials={materials.data} />;
}

function SavedProduct({ id }: { id: string }) {
  const product = useCompositeProduct(id);
  const materials = useEditorMaterials();

  if (product.isPending || materials.isPending) {
    return <LoadingSkeleton variant="form" />;
  }

  if (product.isError) {
    return (
      <ErrorState
        error={product.error}
        title="Não foi possível abrir esta ficha técnica"
        onRetry={() => void product.refetch()}
        retrying={product.isFetching}
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

  return <CompositeProductEditor product={product.data} materials={materials.data} />;
}
