import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Button } from '@/shared/ui/button';
import { PageHeader } from '@/shared/ui/page-header';

import { SaleFilters } from '../components/sale-filters';
import { SaleHistory } from '../components/sale-history';
import { SaleSummaryCards } from '../components/sale-summary-cards';
import { isPaymentStatus, isProductionStatus } from '../model/status';

/** The API's default page, and a size that reads well on a phone. */
const PAGE_SIZE = 20;

/**
 * The address parameters the two filters live in, so a reload, a link and the
 * back button land on the same list. Visible text, so in Portuguese.
 */
const PAYMENT_PARAM = 'pagamento';
const PRODUCTION_PARAM = 'producao';

interface SalesPageProps {
  /**
   * Where "Nova venda" goes, relative to this screen. The route table owns
   * every path, so the page is told this one instead of spelling it.
   */
  newSalePath: string;
}

/**
 * The sales history: the cards of the dataset on top, the two independent
 * filters, and the paginated list.
 *
 * Two questions, two sources, kept apart. "How much did I sell, what is open"
 * is the dataset's, in the cards. "Which sales are they" is the list's, a page
 * of a history that grows. Nothing in the cards is added up from the list.
 */
export function SalesPage({ newSalePath }: SalesPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentParam = searchParams.get(PAYMENT_PARAM) ?? '';
  const productionParam = searchParams.get(PRODUCTION_PARAM) ?? '';
  const paymentStatus = isPaymentStatus(paymentParam) ? paymentParam : undefined;
  const productionStatus = isProductionStatus(productionParam) ? productionParam : undefined;

  const [offset, setOffset] = useState(0);

  function setParam(name: string, value: string | undefined): void {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (value === undefined) {
          next.delete(name);
        } else {
          next.set(name, value);
        }

        return next;
      },
      { replace: true },
    );
    // A different filter is a different list: it starts from its first page.
    setOffset(0);
  }

  function clearFilters(): void {
    setSearchParams({}, { replace: true });
    setOffset(0);
  }

  const newSaleLink = (
    <Button asChild>
      <Link to={newSalePath}>
        <Plus aria-hidden="true" />
        Nova venda
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Comercial"
        title="Vendas"
        description="Acompanhe seus pedidos do pagamento à entrega."
        actions={newSaleLink}
      />

      <SaleSummaryCards />

      <SaleFilters
        paymentStatus={paymentStatus}
        onPaymentStatusChange={(value) => setParam(PAYMENT_PARAM, value)}
        productionStatus={productionStatus}
        onProductionStatusChange={(value) => setParam(PRODUCTION_PARAM, value)}
        onClear={clearFilters}
      />

      <SaleHistory
        filters={{ paymentStatus, productionStatus, limit: PAGE_SIZE, offset }}
        narrowed={paymentStatus !== undefined || productionStatus !== undefined}
        newSaleAction={newSaleLink}
        onOffsetChange={setOffset}
        onClearFilters={clearFilters}
      />
    </div>
  );
}
