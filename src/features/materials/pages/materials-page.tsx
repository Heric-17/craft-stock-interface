import { Boxes } from 'lucide-react';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader } from '@/shared/ui/page-header';
export function MaterialsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Estoque"
        title="Insumos"
        description="Acompanhe tudo o que entra e sai da sua produção."
      />
      <EmptyState
        icon={Boxes}
        title="Esta tela está em construção"
        description="Ela ainda não está disponível. Volte em breve."
      />
    </div>
  );
}
