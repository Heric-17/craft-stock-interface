import { CheckboxField } from '@/shared/ui/checkbox-field';
import { SearchField } from '@/shared/ui/search-field';
import { SelectField } from '@/shared/ui/select-field';

import { STOCK_FILTER_LABELS, type StockFilter } from '../model/labels';

interface MaterialFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  stockFilter: StockFilter;
  onStockFilterChange: (value: StockFilter) => void;
  includeDiscontinued: boolean;
  onIncludeDiscontinuedChange: (value: boolean) => void;
}

/**
 * Search by name and "include discontinued" go to the API as the parameters it
 * accepts. The low-stock filter has no parameter on `GET /materials`, so it
 * narrows the list the API already returned: a bounded set that arrives whole,
 * which is the one case where filtering on this side is not hiding rows from
 * anyone.
 */
export function MaterialFilters({
  search,
  onSearchChange,
  stockFilter,
  onStockFilterChange,
  includeDiscontinued,
  onIncludeDiscontinuedChange,
}: MaterialFiltersProps) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
      <SearchField
        label="Buscar insumo"
        placeholder="Buscar insumo…"
        value={search}
        onChange={onSearchChange}
        className="lg:max-w-sm lg:flex-1"
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 lg:ml-auto">
        <SelectField
          label="Filtrar por estoque"
          hideLabel
          value={stockFilter}
          onChange={(event) => onStockFilterChange(event.target.value as StockFilter)}
          className="sm:min-w-44"
        >
          {(Object.keys(STOCK_FILTER_LABELS) as StockFilter[]).map((value) => (
            <option key={value} value={value}>
              {STOCK_FILTER_LABELS[value]}
            </option>
          ))}
        </SelectField>
        <CheckboxField
          label="Incluir descontinuados"
          checked={includeDiscontinued}
          onChange={(event) => onIncludeDiscontinuedChange(event.target.checked)}
        />
      </div>
    </div>
  );
}
