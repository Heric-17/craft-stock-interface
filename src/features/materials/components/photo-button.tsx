import { Camera } from 'lucide-react';
import { useId, type ChangeEvent } from 'react';

import { cn } from '@/shared/lib/cn';

/**
 * What the file picker offers. The API is the one that decides what it accepts
 * and says so in `UNSUPPORTED_IMAGE_MIME_TYPE`; this only keeps the phone's
 * picker from offering a format that is already known not to work.
 */
const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp';

interface PhotoButtonProps {
  label: string;
  onPick: (file: File) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * A button that opens the file picker — on a phone, the camera and the gallery.
 *
 * The input is hidden visually but stays in the page, labelled by the button's
 * own text: it is the real control, so a keyboard and a screen reader reach it
 * the same way a thumb does.
 */
export function PhotoButton({ label, onPick, disabled = false, className }: PhotoButtonProps) {
  const id = useId();

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];

    // Cleared so that picking the same file again, after a failure, still fires.
    event.target.value = '';

    if (file !== undefined) {
      onPick(file);
    }
  }

  return (
    <div className={cn('relative inline-flex', className)}>
      <input
        id={id}
        type="file"
        accept={ACCEPTED_IMAGES}
        disabled={disabled}
        onChange={handleChange}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className={cn(
          'border-border bg-card text-card-foreground hover:bg-muted peer-focus-visible:ring-ring inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium peer-focus-visible:ring-2',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        <Camera aria-hidden="true" className="size-4" />
        {label}
      </label>
    </div>
  );
}
