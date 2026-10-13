import { ShoppingCart } from 'lucide-react';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader } from '@/shared/ui/page-header';
export function ShortagesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Estoque / Planejamento"
        title="Insumos faltantes"
        description="Uma lista de compras baseada nas vendas selecionadas."
      />
      <EmptyState
        icon={ShoppingCart}
        title="Esta tela está em construção"
        description="Ela ainda não está disponível. Volte em breve."
      />
    </div>
  );
}
