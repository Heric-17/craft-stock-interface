import { cn } from '@/shared/lib/cn';

import { ImageWithPlaceholder } from './image-with-placeholder';

export interface MosaicPhoto {
  key: string;
  /** `null` is the reserved space: no photo, or not loaded yet. */
  src: string | null;
  alt: string;
}

/** How many photos are drawn before the last one says how many more there are. */
const MAX_TILES = 4;

/**
 * The photos of one thing made of several — a sale of several products —
 * fitted into one picture frame, so the whole frame is used whatever the count:
 *
 *  - one photo fills it;
 *  - two split it in halves;
 *  - three give the first the left half and stack the other two beside it;
 *  - four or more make a grid of four, and the fourth says how many are left.
 *
 * The frame is the same shape as the photo of a catalogue card, so a list that
 * mixes both stays level.
 */
export function PhotoMosaic({
  photos,
  className,
}: {
  photos: readonly MosaicPhoto[];
  className?: string;
}) {
  const shown = photos.slice(0, MAX_TILES);
  const hidden = photos.length - shown.length;

  return (
    <div
      className={cn(
        'bg-card grid aspect-[4/3] w-full gap-0.5 overflow-hidden',
        shown.length === 1 ? 'grid-cols-1' : 'grid-cols-2 grid-rows-2',
        shown.length === 2 && 'grid-rows-1',
        className,
      )}
    >
      {shown.map((photo, index) => (
        <div
          key={photo.key}
          className={cn(
            'relative min-h-0 min-w-0',
            shown.length === 3 && index === 0 && 'row-span-2',
          )}
        >
          <ImageWithPlaceholder
            src={photo.src}
            alt={photo.alt}
            className="size-full rounded-none"
          />
          {hidden > 0 && index === shown.length - 1 ? (
            <span className="bg-scrim text-on-scrim absolute inset-0 grid place-items-center text-3xl font-bold backdrop-blur-sm">
              +{hidden + 1}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
