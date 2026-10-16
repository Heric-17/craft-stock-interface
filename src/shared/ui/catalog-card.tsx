import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { cn } from '@/shared/lib/cn';

import { ImageWithPlaceholder } from './image-with-placeholder';

/** One labelled figure of a card: what it is, and its value. */
export interface CatalogFact {
  label: string;
  value: ReactNode;
  /** The figure the eye should land on first. */
  emphasis?: boolean;
}

interface CatalogCardProps {
  name: string;
  /** Absolute and ready to use, or `null` for the reserved space. */
  imageUrl: string | null;
  badges?: ReactNode;
  facts: readonly CatalogFact[];
  /** Whatever sits at the foot of the card: a line of text, a seal. */
  footer?: ReactNode;
  /** The card is a link to where it goes… */
  href?: string;
  /** …or a button for what it does. Exactly one of the two. */
  onClick?: () => void;
  /**
   * `comfortable` lays the figures in two columns, for a page of cards;
   * `compact` stacks them, for a card inside a narrow panel.
   */
  density?: 'comfortable' | 'compact';
  /** Shown paler: for something that is out of use but still on the list. */
  muted?: boolean;
}

const OPEN_AREA =
  'after:absolute after:inset-0 after:content-[""] focus-visible:after:rounded-xl focus-visible:outline-none';

/**
 * A large card for something with a picture: a product, a material, a sale
 * line. The photo comes first and big, because the person has to recognise the
 * thing at a glance — a thumbnail beside a name is not enough when two items
 * are alike — then the name, the seals and the few figures that matter.
 *
 * The whole card is the target, 44px and far more, and the name is the one real
 * link or button in it, stretched over the card so a screen reader reads the
 * card once.
 */
export function CatalogCard({
  name,
  imageUrl,
  badges,
  facts,
  footer,
  href,
  onClick,
  density = 'comfortable',
  muted = false,
}: CatalogCardProps) {
  const title = (
    <span className="text-foreground line-clamp-2 text-left text-base leading-snug font-semibold wrap-break-word">
      {name}
    </span>
  );

  return (
    <article
      className={cn(
        'border-border bg-card shadow-card hover:border-primary focus-within:border-primary group relative flex h-full flex-col overflow-hidden rounded-xl border transition-colors',
        muted && 'opacity-75',
      )}
    >
      <ImageWithPlaceholder
        src={imageUrl}
        alt={name}
        className="aspect-[4/3] w-full rounded-none"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex min-w-0 flex-col gap-2">
          {href === undefined ? (
            <button type="button" onClick={onClick} className={cn('min-h-0 text-left', OPEN_AREA)}>
              {title}
            </button>
          ) : (
            <Link to={href} className={OPEN_AREA}>
              {title}
            </Link>
          )}
          {badges === undefined ? null : <div className="flex flex-wrap gap-1.5">{badges}</div>}
        </div>

        <dl
          className={cn(
            'grid gap-x-4 gap-y-2',
            density === 'comfortable' ? 'grid-cols-2' : 'grid-cols-1',
          )}
        >
          {facts.map((fact) => (
            <div key={fact.label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-muted-foreground text-[0.6875rem] font-semibold tracking-wide uppercase">
                {fact.label}
              </dt>
              <dd
                className={cn(
                  'text-sm wrap-break-word',
                  fact.emphasis === true ? 'text-foreground text-base font-bold' : 'font-medium',
                )}
              >
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>

        {footer === undefined ? null : (
          <div className="text-muted-foreground border-border mt-auto border-t pt-3 text-xs">
            {footer}
          </div>
        )}
      </div>
    </article>
  );
}
