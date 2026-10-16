import { ArrowLeft, CreditCard, ListChecks, Package, Pencil, Phone } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { formatDateTime, formatMoney } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { ErrorState } from '@/shared/ui/error-state';
import { FormSection } from '@/shared/ui/form-section';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';

import { useCatalogImages, useSale } from '../api/use-sales';
import { SaleDetailsSheet } from '../components/sale-details-sheet';
import { SaleItemsList } from '../components/sale-items-list';
import { SaleProgress } from '../components/sale-progress';
import { SaleAxisBadges } from '../components/sale-status-badges';
import { isSaleEditable, shortSaleId, type CatalogImages, type Sale } from '../model/sale';

interface SaleDetailPageProps {
  /** The address of the products, so an item can lead to its product. Navigation only. */
  productPath: string;
}

/**
 * One sale: who it is for, its two independent states, and its items exactly
 * as they were frozen — the name and the price each had when it was sold,
 * never the product as it is today.
 */
export function SaleDetailPage({ productPath }: SaleDetailPageProps) {
  const { id } = useParams();

  return id === undefined ? null : <SaleDetail key={id} id={id} productPath={productPath} />;
}

function BackLink() {
  return (
    <Link
      to=".."
      relative="path"
      className="text-accent-foreground hover:bg-accent inline-flex min-h-11 items-center gap-2 self-start rounded-md px-2 text-sm font-medium"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Voltar para as vendas
    </Link>
  );
}

function SaleDetail({ id, productPath }: { id: string; productPath: string }) {
  const sale = useSale(id);
  const images = useCatalogImages();

  if (sale.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <LoadingSkeleton variant="form" />
      </div>
    );
  }

  if (sale.isError) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <ErrorState
          error={sale.error}
          title="Não foi possível abrir esta venda"
          onRetry={() => void sale.refetch()}
          retrying={sale.isFetching}
        />
      </div>
    );
  }

  return <SaleView sale={sale.data} productPath={productPath} images={images} />;
}

interface SaleViewProps {
  sale: Sale;
  productPath: string;
  images: CatalogImages;
}

function SaleView({ sale, productPath, images }: SaleViewProps) {
  const [editingDetails, setEditingDetails] = useState(false);
  const editable = isSaleEditable(sale);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackLink />

        <section className="border-border bg-card shadow-card overflow-hidden rounded-xl border">
          <div className="bg-secondary text-secondary-foreground flex flex-col gap-1 px-4 py-4 sm:px-5">
            <p className="text-xs font-bold tracking-widest uppercase">
              Venda {shortSaleId(sale)} · {formatDateTime(sale.createdAt)}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              {sale.customerName}
            </h1>
          </div>

          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <Phone aria-hidden="true" className="text-info mt-0.5 size-4 shrink-0" />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">Contato</dt>
                    <dd className="text-sm font-semibold wrap-break-word">
                      {sale.customerContact ?? '—'}
                    </dd>
                  </div>
                </div>
                <div className="flex min-w-0 items-start gap-2.5">
                  <CreditCard aria-hidden="true" className="text-info mt-0.5 size-4 shrink-0" />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">Forma de pagamento</dt>
                    <dd className="text-sm font-semibold wrap-break-word">{sale.paymentMethod}</dd>
                  </div>
                </div>
              </dl>

              <div className="flex flex-col gap-0.5 sm:items-end">
                <p className="text-muted-foreground text-xs">Total</p>
                {/* The API's total: the sum of the lines, each already rounded to the cent. */}
                <p className="text-foreground text-3xl font-bold tracking-tight whitespace-nowrap">
                  {formatMoney(sale.totalAmount)}
                </p>
              </div>
            </div>

            <div className="border-border flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <SaleAxisBadges sale={sale} />
              <div className="flex flex-col gap-1.5 sm:items-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!editable}
                  onClick={() => setEditingDetails(true)}
                >
                  <Pencil aria-hidden="true" />
                  Editar dados
                </Button>
                {editable ? null : (
                  <p className="text-muted-foreground text-xs text-pretty">
                    Só dá para editar enquanto a produção está Pendente.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start xl:gap-8">
        <div className="flex flex-col gap-6 xl:order-2 xl:sticky xl:top-24">
          <FormSection title="Andamento" icon={ListChecks} tone="info">
            <SaleProgress sale={sale} />
          </FormSection>
        </div>

        <div className="xl:order-1">
          <FormSection
            title="Itens"
            icon={Package}
            description="Cada item mostra o nome e o preço de quando a venda foi feita. Mudanças posteriores no produto não alteram esta venda."
          >
            {editable ? null : (
              <Callout tone="info">
                Esta venda já foi montada ou entregue: os itens e os dados do cliente só podem ser
                alterados enquanto a produção está Pendente.
              </Callout>
            )}
            <SaleItemsList sale={sale} images={images} productPath={productPath} />
            <div className="border-border flex items-baseline justify-between gap-4 border-t pt-4">
              <span className="text-muted-foreground text-sm">Total da venda</span>
              <span className="text-xl font-bold tracking-tight whitespace-nowrap">
                {formatMoney(sale.totalAmount)}
              </span>
            </div>
          </FormSection>
        </div>
      </div>

      <SaleDetailsSheet sale={sale} open={editingDetails} onOpenChange={setEditingDetails} />
    </div>
  );
}
