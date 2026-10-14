import type { ReactNode } from 'react';

/** A titled block of the editor: a card with what it is for, then its fields. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        {description === undefined ? null : (
          <p className="text-muted-foreground text-sm text-pretty">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
