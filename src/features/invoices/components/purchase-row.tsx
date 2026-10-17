import { ChevronRight, Receipt } from 'lucide-react';
import { Link } from 'react-router';

import { formatDateTime, formatMoney } from '@/shared/format';
import { StatusBadge } from '@/shared/ui/status-badge';

import { shortAccessKey, type PurchaseSummary } from '../model/purchase';

interface PurchaseRowProps {
  purchase: PurchaseSummary;
  /** Where the note opens: its second step. */
  href: string;
}

/**
 * One imported note. It is named by the shop that issued it, with what tells two
 * visits to the same shop apart: the day, how many lines and the end of the
 * access key. What it cost is what was paid, with the discount under it when
 * there was one — the sum of the lines at full price is not what left the till.
 *
 * The whole row is the link, so a thumb finds it anywhere on the line.
 */
export function PurchaseRow({ purchase, href }: PurchaseRowProps) {
  const hasDiscount = !purchase.discountTotal.isZero();

  return (
    <li>
      <Link
        to={href}
        className="hover:bg-muted/60 focus-visible:bg-muted/60 flex min-h-16 items-center gap-3 p-4 transition-colors sm:px-5"
      >
        <span
          aria-hidden="true"
          className="bg-success-muted text-success grid size-11 shrink-0 place-items-center rounded-lg"
        >
          <Receipt className="size-5" />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-semibold text-pretty wrap-break-word">
            {purchase.establishmentName}
          </span>
          <span className="text-muted-foreground text-xs text-pretty">{details(purchase)}</span>
          {purchase.allocationPending || !purchase.hasInvoice ? (
            <span className="flex flex-wrap gap-1.5">
              {purchase.allocationPending ? (
                <StatusBadge tone="warning">Desconto pendente</StatusBadge>
              ) : null}
              {purchase.hasInvoice ? null : <StatusBadge>Digitada à mão</StatusBadge>}
            </span>
          ) : null}
        </span>

        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span className="text-sm font-bold whitespace-nowrap">
            <span className="sr-only">Total pago: </span>
            {formatMoney(purchase.netTotal)}
          </span>
          {hasDiscount ? (
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              desconto {formatMoney(purchase.discountTotal)}
            </span>
          ) : null}
        </span>

        {/* Left out on a phone: the whole row is the link, and the width is worth more to the shop's name. */}
        <ChevronRight
          aria-hidden="true"
          className="text-muted-foreground hidden size-5 shrink-0 sm:block"
        />
      </Link>
    </li>
  );
}

function details(purchase: PurchaseSummary): string {
  const items = purchase.itemCount === 1 ? '1 item' : `${purchase.itemCount} itens`;
  const parts = [formatDateTime(purchase.purchaseDate), items];

  if (purchase.accessKey !== null) {
    parts.push(`Chave ${shortAccessKey(purchase.accessKey)}`);
  }

  return parts.join(' · ');
}
