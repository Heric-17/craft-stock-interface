import { ShoppingBag } from 'lucide-react';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader } from '@/shared/ui/page-header';
export function SalesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Comercial"
        title="Vendas"
        description="Acompanhe seus pedidos do pagamento à entrega."
      />
      <EmptyState
        icon={ShoppingBag}
        title="Esta tela está em construção"
        description="Ela ainda não está disponível. Volte em breve."
      />
    </div>
  );
}
