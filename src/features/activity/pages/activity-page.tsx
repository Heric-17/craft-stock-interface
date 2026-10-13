import { Activity } from 'lucide-react';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader } from '@/shared/ui/page-header';
export function ActivityPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Conta"
        title="Minhas atividades"
        description="Veja o que foi feito no sistema e quando."
      />
      <EmptyState
        icon={Activity}
        title="Esta tela está em construção"
        description="Ela ainda não está disponível. Volte em breve."
      />
    </div>
  );
}
