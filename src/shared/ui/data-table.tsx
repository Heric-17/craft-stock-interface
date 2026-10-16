import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  useIsDesktop,
  useIsExtraLargeDesktop,
  useIsLargeDesktop,
} from '@/shared/lib/use-media-query';
import { cn } from '@/shared/lib/cn';
export interface DataTableColumn<Row> {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  role?: 'primary' | 'detail' | 'desktop-only';
  align?: 'start' | 'end';
}
interface DataTableProps<Row> {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  getRowKey: (row: Row) => string;
  getRowHref?: ((row: Row) => string) | undefined;
  caption: string;
  /**
   * From which width the rows are a table. `md` by default; a table with many
   * columns on a screen that also has a sidebar asks for `lg`, because between
   * the two the content area is a few hundred pixels wide and the table would
   * hide most of its columns behind a sideways scroll. `xl` is for six or more.
   */
  tableFrom?: 'md' | 'lg' | 'xl';
}
export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  getRowHref,
  caption,
  tableFrom = 'md',
}: DataTableProps<Row>) {
  const isMedium = useIsDesktop();
  const isLarge = useIsLargeDesktop();
  const isExtraLarge = useIsExtraLargeDesktop();
  const isDesktop = tableFrom === 'xl' ? isExtraLarge : tableFrom === 'lg' ? isLarge : isMedium;
  const primary = columns.find((column) => column.role === 'primary') ?? columns[0];
  if (primary === undefined) {
    return null;
  }
  return isDesktop ? (
    <DesktopTable
      columns={columns}
      primary={primary}
      rows={rows}
      getRowKey={getRowKey}
      getRowHref={getRowHref}
      caption={caption}
    />
  ) : (
    <CardList
      columns={columns}
      primary={primary}
      rows={rows}
      getRowKey={getRowKey}
      getRowHref={getRowHref}
      caption={caption}
    />
  );
}
interface LayoutProps<Row> extends DataTableProps<Row> {
  primary: DataTableColumn<Row>;
}
const STRETCHED_LINK =
  'after:absolute after:inset-0 after:content-[""] focus-visible:after:rounded-md';
function DesktopTable<Row>({
  columns,
  primary,
  rows,
  getRowKey,
  getRowHref,
  caption,
}: LayoutProps<Row>) {
  return (
    <div className="border-border bg-card shadow-card relative overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-muted/60 border-border border-b">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  'text-muted-foreground px-4 py-3 text-[0.625rem] font-bold tracking-[0.08em] uppercase',
                  column.align === 'end' && 'text-right',
                )}
              >
                {column.header}
              </th>
            ))}
            {getRowHref === undefined ? null : (
              <th scope="col" className="w-10">
                <span className="sr-only">Abrir</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = getRowHref?.(row);
            return (
              <tr
                key={getRowKey(row)}
                className={cn(
                  'border-border relative min-h-11 border-b last:border-b-0',
                  href !== undefined && 'hover:bg-muted/50',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cn('px-4 py-3 align-middle', column.align === 'end' && 'text-right')}
                  >
                    {column === primary && href !== undefined ? (
                      <Link to={href} className={cn('block', STRETCHED_LINK)}>
                        {column.cell(row)}
                      </Link>
                    ) : (
                      column.cell(row)
                    )}
                  </td>
                ))}
                {href === undefined ? null : (
                  <td className="text-muted-foreground w-10 pr-4">
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function CardList<Row>({
  columns,
  primary,
  rows,
  getRowKey,
  getRowHref,
  caption,
}: LayoutProps<Row>) {
  const details = columns.filter((column) => column !== primary && column.role !== 'desktop-only');
  return (
    <ul aria-label={caption} className="flex flex-col gap-3">
      {rows.map((row) => {
        const href = getRowHref?.(row);
        return (
          <li
            key={getRowKey(row)}
            className="border-border bg-card shadow-card relative flex min-h-11 flex-col gap-3 rounded-xl border p-4"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                {href === undefined ? (
                  primary.cell(row)
                ) : (
                  <Link to={href} className={cn('block', STRETCHED_LINK)}>
                    {primary.cell(row)}
                  </Link>
                )}
              </div>
              {href === undefined ? null : (
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground size-4 shrink-0"
                />
              )}
            </div>
            {details.length === 0 ? null : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {details.map((column) => (
                  <div key={column.id} className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-muted-foreground text-[0.625rem] font-bold tracking-[0.08em] uppercase">
                      {column.header}
                    </dt>
                    <dd className="text-sm">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}
