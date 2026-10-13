import { ScanLine } from 'lucide-react';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader } from '@/shared/ui/page-header';
export function InvoiceImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operação"
        title="Importar nota fiscal"
        description="Dê entrada nos seus insumos sem digitação manual."
      />
      <EmptyState
        icon={ScanLine}
        title="Esta tela está em construção"
        description="Ela ainda não está disponível. Volte em breve."
      />
    </div>
  );
}
