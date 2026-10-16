import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
interface ImageWithPlaceholderProps {
  src: string | null;
  alt: string;
  className?: string;
}
export function ImageWithPlaceholder({ src, alt, className }: ImageWithPlaceholderProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src === null || src === failedSrc) {
    return (
      <span
        role="img"
        aria-label={`${alt} (sem foto)`}
        className={cn(
          'bg-muted text-muted-foreground grid shrink-0 place-items-center overflow-hidden rounded-lg',
          className,
        )}
      >
        <ImageOff aria-hidden="true" className="size-1/2 max-h-14 max-w-14" />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className={cn('bg-muted shrink-0 overflow-hidden rounded-lg object-cover', className)}
    />
  );
}
