import { QUERY_ROOTS } from '@/shared/api/query-roots';

/**
 * The purchase history's filters, all parameters the API accepts. `from` is
 * inclusive and `to` exclusive, both instants with the offset of
 * `America/Sao_Paulo`, built by `buildPeriodRange`. Without them the whole
 * history is meant. `establishmentId` is the shop's CNPJ, or its name when the
 * note had none: the same key the spending dataset ranks by.
 */
export interface PurchaseFilters {
  from?: string | undefined;
  to?: string | undefined;
  establishmentId?: string | undefined;
  limit: number;
  offset: number;
}

const root = [QUERY_ROOTS.purchases] as const;

export const purchaseKeys = {
  all: root,
  lists: () => [...root, 'list'] as const,
  list: (filters: PurchaseFilters) => [...root, 'list', filters] as const,
  details: () => [...root, 'detail'] as const,
  detail: (id: string) => [...root, 'detail', id] as const,
};
