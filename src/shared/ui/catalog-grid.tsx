import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

interface CatalogGridProps<Item> {
  /** Names the list for a screen reader: "Fichas técnicas". */
  label: string;
  items: readonly Item[];
  getKey: (item: Item) => string;
  /** What each item looks like: normally a card. It is wrapped in the list item here. */
  renderItem: (item: Item) => ReactNode;
  /**
   * The narrowest a card may get before another column is dropped. The grid
   * fits as many columns as that leaves room for, so a phone gets one, a
   * tablet two and a desktop two or three, with no breakpoint to maintain.
   */
  minCardWidth?: 'default' | 'narrow';
  className?: string;
}

/**
 * `min(…, 100%)` keeps a card from being wider than the screen on a 320px
 * phone, where the minimum would not fit.
 */
const COLUMNS = {
  default: 'grid-cols-[repeat(auto-fill,minmax(min(17rem,100%),1fr))] gap-4',
  narrow: 'grid-cols-[repeat(auto-fill,minmax(min(11rem,100%),1fr))] gap-3',
} as const;

/** The grid every page of cards sits in. */
export function CatalogGrid<Item>({
  label,
  items,
  getKey,
  renderItem,
  minCardWidth = 'default',
  className,
}: CatalogGridProps<Item>) {
  return (
    <ul aria-label={label} className={cn('grid', COLUMNS[minCardWidth], className)}>
      {items.map((item) => (
        <li key={getKey(item)} className="min-w-0">
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}
