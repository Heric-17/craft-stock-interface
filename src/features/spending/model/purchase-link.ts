import type { PeriodPreset } from '@/shared/format';

/**
 * How the ranking of shops hands its filter to the list of purchases: two
 * parameters of the address. They are visible text like the rest of the address,
 * so they are in Portuguese, and they are the only way the two screens agree on
 * which shop and which period a list is about.
 */
const PARAMS = { establishment: 'estabelecimento', period: 'periodo' } as const;

const PERIOD_SLUGS: Record<PeriodPreset, string> = {
  THIS_MONTH: 'este-mes',
  LAST_6_MONTHS: '6-meses',
  LAST_12_MONTHS: '12-meses',
};

export interface PurchasesFilter {
  establishmentId?: string | undefined;
  preset?: PeriodPreset | undefined;
}

/** The list of purchases, already narrowed: what a row of the ranking opens. */
export function purchasesLink(purchasesPath: string, filter: PurchasesFilter): string {
  const params = new URLSearchParams();

  if (filter.establishmentId !== undefined) {
    params.set(PARAMS.establishment, filter.establishmentId);
  }

  if (filter.preset !== undefined) {
    params.set(PARAMS.period, PERIOD_SLUGS[filter.preset]);
  }

  const query = params.toString();

  return query === '' ? purchasesPath : `${purchasesPath}?${query}`;
}

/** What an address asks the list to be narrowed by. An unknown period is ignored. */
export function readPurchasesFilter(params: URLSearchParams): PurchasesFilter {
  const establishmentId = params.get(PARAMS.establishment);
  const slug = params.get(PARAMS.period);
  const preset = (Object.keys(PERIOD_SLUGS) as PeriodPreset[]).find(
    (candidate) => PERIOD_SLUGS[candidate] === slug,
  );

  return {
    establishmentId:
      establishmentId === null || establishmentId === '' ? undefined : establishmentId,
    preset,
  };
}

/** The same address with the shop taken off, for "show every shop". */
export function withoutEstablishment(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);

  next.delete(PARAMS.establishment);

  return next;
}

/** The same address with the period set, whatever else it holds. */
export function withPeriod(params: URLSearchParams, preset: PeriodPreset): URLSearchParams {
  const next = new URLSearchParams(params);

  next.set(PARAMS.period, PERIOD_SLUGS[preset]);

  return next;
}
