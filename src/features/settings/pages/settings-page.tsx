import { Settings } from 'lucide-react';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader } from '@/shared/ui/page-header';
export function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Ajuste o funcionamento do sistema para o seu negócio."
      />
      <EmptyState
        icon={Settings}
        title="Esta tela está em construção"
        description="Ela ainda não está disponível. Volte em breve."
      />
    </div>
  );
}
