import { CircleDollarSign } from 'lucide-react';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader } from '@/shared/ui/page-header';
export function SpendingPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Gastos da empresa"
        description="Entenda para onde está indo o dinheiro do seu negócio."
      />
      <EmptyState
        icon={CircleDollarSign}
        title="Esta tela está em construção"
        description="Ela ainda não está disponível. Volte em breve."
      />
    </div>
  );
}
