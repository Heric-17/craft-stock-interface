import { ClipboardList, Plus, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { formatCount } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';
import { PageHeader } from '@/shared/ui/page-header';

import { useCompositeProducts } from '../api/use-composite-products';
import { CompositeProductFilters } from '../components/composite-product-filters';
import { CompositeProductTable } from '../components/composite-product-table';

interface CompositeProductsPageProps {
  /**
   * Where "Nova ficha técnica" goes, relative to this screen. The route table
   * owns every path, so the page is told this one instead of spelling it.
   */
  newProductPath: string;
}

/**
 * The products and their bills of materials, with the cost, price and
 * production capacity the backend derives for each. Opening a row goes to the
 * editor, which is a screen of its own.
 */
export function CompositeProductsPage({ newProductPath }: CompositeProductsPageProps) {
  const [search, setSearch] = useState('');
  const [includeDiscontinued, setIncludeDiscontinued] = useState(false);

  const list = useCompositeProducts({ includeDiscontinued });

  // The API has no search parameter. The list is a bounded set that comes back
  // whole, so narrowing it here hides nothing from anyone.
  const term = search.trim().toLocaleLowerCase('pt-BR');
  const visible = (list.data ?? []).filter(
    (product) => term === '' || product.name.toLocaleLowerCase('pt-BR').includes(term),
  );
  const filtering = term !== '';

  const newProductLink = (
    <Button asChild>
      <Link to={newProductPath}>
        <Plus aria-hidden="true" />
        Nova ficha técnica
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Produtos"
        title="Fichas técnicas"
        description="Consulte e gerencie as fichas técnicas dos seus produtos."
        actions={newProductLink}
      />

      <CompositeProductFilters
        search={search}
        onSearchChange={setSearch}
        includeDiscontinued={includeDiscontinued}
        onIncludeDiscontinuedChange={setIncludeDiscontinued}
      />

      {list.isPending ? (
        <LoadingSkeleton variant="table" />
      ) : list.isError ? (
        <ErrorState
          error={list.error}
          title="Não foi possível carregar as fichas técnicas"
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      ) : visible.length === 0 ? (
        filtering ? (
          <EmptyState
            icon={SearchX}
            title="Nenhuma ficha técnica encontrada"
            description="Nenhuma ficha técnica combina com a busca."
            action={
              <Button variant="outline" onClick={() => setSearch('')}>
                Limpar busca
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="Nenhuma ficha técnica cadastrada"
            description="Monte a primeira ficha técnica para saber quanto cada produto custa, por quanto vender e quantos dá para produzir."
            action={newProductLink}
          />
        )
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {visible.length === 1
              ? '1 ficha técnica'
              : `${formatCount(visible.length)} fichas técnicas`}
          </p>
          <CompositeProductTable
            products={visible}
            // Relative to this screen: the editor of a product is `<this screen>/<id>`.
            hrefFor={(product) => encodeURIComponent(product.id)}
          />
        </div>
      )}
    </div>
  );
}
