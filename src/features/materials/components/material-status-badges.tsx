import { StatusBadge } from '@/shared/ui/status-badge';

import type { Material } from '../model/material';

/**
 * The seals of a material: discontinued, and low on stock as the API says it
 * (`lowStock`, never a comparison made here). A material that is neither is
 * simply in good shape.
 */
export function MaterialStatusBadges({ material }: { material: Material }) {
  const discontinued = !material.isActive;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {discontinued ? <StatusBadge tone="neutral">Descontinuado</StatusBadge> : null}
      {material.lowStock ? <StatusBadge tone="warning">Estoque baixo</StatusBadge> : null}
      {!discontinued && !material.lowStock ? (
        <StatusBadge tone="success">Saudável</StatusBadge>
      ) : null}
    </div>
  );
}
