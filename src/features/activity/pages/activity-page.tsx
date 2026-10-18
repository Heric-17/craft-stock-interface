import { Callout } from '@/shared/ui/callout';
import { PageHeader } from '@/shared/ui/page-header';

import { ActivityFeed } from '../components/activity-feed';

/**
 * What was done in the system and when. The feed is the whole installation's, not
 * only the signed-in person's — the API takes no user filter — so each line says
 * who did it.
 */
export function ActivityPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Conta"
        title="Minhas atividades"
        description="Veja o que foi feito no sistema e quando."
      />
      <Callout tone="info">
        Esta lista mostra o que foi feito por todas as pessoas que usam o sistema. O que você fez
        aparece como “Você”.
      </Callout>
      <ActivityFeed />
    </div>
  );
}
