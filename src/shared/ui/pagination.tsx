import { ChevronLeft, ChevronRight } from 'lucide-react';

import { formatCount } from '@/shared/format';

import { Button } from './button';

interface PaginationProps {
  /** The size of the filtered set, as the API counted it — never `items.length`. */
  total: number;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
  /** Says what the list is, for a screen reader: "perdas". */
  label: string;
  /** The previous page stays on screen while the next one loads. */
  busy?: boolean;
}

/**
 * Previous and next over a list the API pages as `{ items, total, limit,
 * offset }`. What it says about where you are — "21–40 de 57" — is computed
 * from `total`, which is the whole filtered set, and the page size.
 */
export function Pagination({
  total,
  limit,
  offset,
  onOffsetChange,
  label,
  busy = false,
}: PaginationProps) {
  if (total === 0) {
    return null;
  }

  const first = offset + 1;
  const last = Math.min(offset + limit, total);
  const hasPrevious = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <nav aria-label={`Paginação de ${label}`} className="flex items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {formatCount(first)}–{formatCount(last)} de {formatCount(total)}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!hasPrevious || busy}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft aria-hidden="true" />
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!hasNext || busy}
          onClick={() => onOffsetChange(offset + limit)}
        >
          Próxima
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
