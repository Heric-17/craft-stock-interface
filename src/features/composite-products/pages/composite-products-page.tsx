import { ClipboardList } from 'lucide-react';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader } from '@/shared/ui/page-header';
export function CompositeProductsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Produtos"
        title="Fichas técnicas"
        description="Consulte e gerencie as fichas técnicas dos seus produtos."
      />
      <EmptyState
        icon={ClipboardList}
        title="Esta tela está em construção"
        description="Ela ainda não está disponível. Volte em breve."
      />
    </div>
  );
}
