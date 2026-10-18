import { Activity } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useSession } from '@/features/auth';
import { useMaterials } from '@/features/materials';
import { formatCount } from '@/shared/format';
import { useNow } from '@/shared/lib/use-now';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';
import { Pagination } from '@/shared/ui/pagination';

import { useActivity } from '../api/use-activity';
import { indexMaterials } from '../model/activity-sentence';
import { groupByDay } from '../model/group-by-day';

import { ActivityDayGroup } from './activity-day';

/** The API's default page, and a size that reads well on a phone. */
const PAGE_SIZE = 20;

/** The heading of a day changes at midnight; once a minute is often enough to follow it. */
const CLOCK_REFRESH_MS = 60_000;

/**
 * What was done in the system, newest first, a page at a time and cut into
 * days. The sentences are made here from the structured entries; nothing the
 * API sends is shown as it came.
 *
 * The materials are read for two things the trail does not say: the name of the
 * material a stock loss was recorded for, and the unit of a quantity. They are
 * a help, not a requirement — while they load, or if they fail, the sentences
 * simply leave out what they cannot say honestly.
 */
export function ActivityFeed() {
  const [offset, setOffset] = useState(0);
  const feed = useActivity({ limit: PAGE_SIZE, offset });
  const materials = useMaterials({ includeDiscontinued: true });
  const session = useSession();
  const now = useNow(CLOCK_REFRESH_MS);

  const materialsData = materials.data;
  const viewerId = session.status === 'authenticated' ? session.user.id : null;
  const context = useMemo(
    () => ({
      viewerId,
      materials: indexMaterials(materialsData ?? []),
      now,
    }),
    [viewerId, materialsData, now],
  );

  if (feed.isPending) {
    return <LoadingSkeleton variant="table" />;
  }

  if (feed.isError) {
    return (
      <ErrorState
        error={feed.error}
        title="Não foi possível carregar as atividades"
        onRetry={() => void feed.refetch()}
        retrying={feed.isFetching}
      />
    );
  }

  const page = feed.data;

  if (page.total === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Nada por aqui ainda"
        description="Quando alguém cadastrar, alterar ou excluir insumos, produtos, vendas e compras, o que foi feito aparece nesta lista."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {page.total === 1 ? '1 atividade' : `${formatCount(page.total)} atividades`}
      </p>

      {groupByDay(page.items, now).map((day) => (
        <ActivityDayGroup key={day.key} day={day} context={context} />
      ))}

      <Pagination
        total={page.total}
        limit={page.limit}
        offset={page.offset}
        onOffsetChange={setOffset}
        label="atividades"
        busy={feed.isFetching}
      />
    </div>
  );
}
