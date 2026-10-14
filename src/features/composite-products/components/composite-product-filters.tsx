import { CheckboxField } from '@/shared/ui/checkbox-field';
import { SearchField } from '@/shared/ui/search-field';

interface CompositeProductFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  includeDiscontinued: boolean;
  onIncludeDiscontinuedChange: (value: boolean) => void;
}

/**
 * "Include discontinued" goes to the API as the parameter it accepts. The
 * search has no parameter on `GET /composite-products`, so it narrows the list
 * the API already returned: a bounded set that arrives whole, which is the one
 * case where filtering on this side hides rows from nobody.
 */
export function CompositeProductFilters({
  search,
  onSearchChange,
  includeDiscontinued,
  onIncludeDiscontinuedChange,
}: CompositeProductFiltersProps) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
      <SearchField
        label="Buscar ficha técnica"
        placeholder="Buscar ficha técnica…"
        value={search}
        onChange={onSearchChange}
        className="lg:max-w-sm lg:flex-1"
      />
      <CheckboxField
        label="Incluir descontinuados"
        checked={includeDiscontinued}
        onChange={(event) => onIncludeDiscontinuedChange(event.target.checked)}
        className="lg:ml-auto"
      />
    </div>
  );
}
