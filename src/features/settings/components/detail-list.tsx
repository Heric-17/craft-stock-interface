interface DetailItem {
  term: string;
  detail: string;
}

/**
 * Label and value pairs, one under the other on a phone and side by side on a
 * wide screen. A long value (an address, an e-mail) breaks inside its own line
 * instead of pushing the page sideways.
 */
export function DetailList({ label, items }: { label: string; items: readonly DetailItem[] }) {
  return (
    <dl aria-label={label} className="divide-border flex flex-col divide-y text-sm">
      {items.map((item) => (
        <div
          key={item.term}
          className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:gap-6"
        >
          <dt className="text-muted-foreground shrink-0 sm:w-40">{item.term}</dt>
          <dd className="text-foreground min-w-0 font-semibold [overflow-wrap:anywhere]">
            {item.detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}
