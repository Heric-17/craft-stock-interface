import { StatusBadge } from '@/shared/ui/status-badge';

import { unitsText } from '../model/labels';

/** The seal of a product that is out of use. It stays in the history, so it stays visible. */
export function DiscontinuedBadge() {
  return <StatusBadge tone="neutral">Descontinuado</StatusBadge>;
}

/**
 * How many units the stock allows, with the zero made impossible to miss: a
 * product that cannot be made right now is the one thing on the list somebody
 * has to act on.
 */
export function CapacityBadge({ capacity }: { capacity: number }) {
  return capacity === 0 ? (
    <StatusBadge tone="danger">Não dá para produzir</StatusBadge>
  ) : (
    <span className="font-semibold">{unitsText(capacity)}</span>
  );
}
