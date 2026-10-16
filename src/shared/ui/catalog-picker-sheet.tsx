import { PackageSearch, SearchX } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { formatCount } from '@/shared/format';

import { Button } from './button';
import { CatalogCard, type CatalogFact } from './catalog-card';
import { CatalogGrid } from './catalog-grid';
import { EmptyState } from './empty-state';
import { SearchField } from './search-field';
import { SegmentedControl } from './segmented-control';
import { ResponsiveSheet, SheetPanel } from './sheet-panel';

/** One thing that can be picked, already written for the person: no wire types in here. */
export interface CatalogOption {
  id: string;
  name: string;
  imageUrl: string | null;
  /** Which of the panel's groups it belongs to, when there are several. */
  group?: string;
  badges?: ReactNode;
  facts: readonly CatalogFact[];
}

export interface CatalogGroup {
  id: string;
  label: string;
}

interface CatalogPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The dialog's name for a screen reader, and the heading of the panel. */
  title: string;
  description: string;
  /** "Buscar insumo": the label of the search box. */
  searchLabel: string;
  searchPlaceholder: string;
  /** Names the list of cards: "Insumos disponíveis". */
  listLabel: string;
  /** Already narrowed to what can be picked. */
  options: readonly CatalogOption[];
  /** Two or more groups become tabs above the search; one or none is a plain list. */
  groups?: readonly CatalogGroup[];
  /** What to say when nothing at all can be picked. */
  nothingToPick: { title: string; description: string };
  /** What a search is for, in the count: "insumo" / "insumos". */
  noun: { one: string; many: string };
  onPick: (option: CatalogOption) => void;
}

/** A search ignores case and accents: "essencia" finds "Essência baunilha". */
function searchKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
}

/**
 * Where something is chosen from a catalogue: a wide panel with a search box and
 * a grid of cards, each with the photo, the name and what is needed to tell two
 * of them apart. A select could only show a name, and two items with similar
 * names are exactly the ones that get mixed up.
 *
 * With groups — products and loose materials, say — the groups are tabs, and
 * the search looks inside the one that is open.
 */
export function CatalogPickerSheet({
  open,
  onOpenChange,
  title,
  ...body
}: CatalogPickerSheetProps) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={title} width="wide">
      <PickerBody
        title={title}
        {...body}
        onPick={(option) => {
          body.onPick(option);
          onOpenChange(false);
        }}
      />
    </ResponsiveSheet>
  );
}

function PickerBody({
  title,
  description,
  searchLabel,
  searchPlaceholder,
  listLabel,
  options,
  groups,
  nothingToPick,
  noun,
  onPick,
}: Omit<CatalogPickerSheetProps, 'open' | 'onOpenChange'>) {
  // The body is only mounted while the panel is open, so neither the search nor
  // the tab survives to the next time it is opened.
  const [search, setSearch] = useState('');
  const [chosenGroup, setChosenGroup] = useState<string | null>(null);

  const hasGroups = groups !== undefined && groups.length > 1;
  const group = hasGroups ? (chosenGroup ?? groups[0]?.id ?? null) : null;

  const inGroup = options.filter((option) => group === null || option.group === group);
  const term = searchKey(search.trim());
  const visible = inGroup.filter((option) => term === '' || searchKey(option.name).includes(term));

  return (
    <SheetPanel title={title} description={description}>
      <div className="bg-card sticky top-0 z-10 -mx-5 -mt-5 flex flex-col gap-3 px-5 pt-5 pb-1">
        {hasGroups ? (
          <SegmentedControl
            label="Tipo de item"
            options={groups.map((entry) => ({
              value: entry.id,
              label: `${entry.label} (${formatCount(options.filter((option) => option.group === entry.id).length)})`,
            }))}
            value={group ?? ''}
            onChange={(next) => {
              setChosenGroup(next);
              setSearch('');
            }}
          />
        ) : null}
        <SearchField
          label={searchLabel}
          placeholder={searchPlaceholder}
          value={search}
          onChange={setSearch}
        />
      </div>

      {options.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={nothingToPick.title}
          description={nothingToPick.description}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={`Nenhum ${noun.one} encontrado`}
          description={
            inGroup.length === 0
              ? 'Não há nada neste grupo.'
              : `Nenhum ${noun.one} combina com a busca.`
          }
          action={
            search === '' ? undefined : (
              <Button variant="outline" onClick={() => setSearch('')}>
                Limpar busca
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {visible.length === 1 ? `1 ${noun.one}` : `${formatCount(visible.length)} ${noun.many}`}
          </p>
          <CatalogGrid
            label={listLabel}
            items={visible}
            getKey={(option) => `${option.group ?? ''}:${option.id}`}
            minCardWidth="narrow"
            renderItem={(option) => (
              <CatalogCard
                name={option.name}
                imageUrl={option.imageUrl}
                badges={option.badges}
                facts={option.facts}
                density="compact"
                onClick={() => onPick(option)}
              />
            )}
          />
        </div>
      )}
    </SheetPanel>
  );
}
