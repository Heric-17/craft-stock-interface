import { ListChecks } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { PageHeader } from '@/shared/ui/page-header';

/** The second step of an import: what each line of the note is. Its screen is still to come. */
export function InvoiceClassificationPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operação"
        title="Classificar nota"
        description="Passo 2 de 2: diga o que cada item da nota é."
      />
      <EmptyState
        icon={ListChecks}
        title="Esta tela está em construção"
        description="A nota já foi importada e está guardada. A classificação dos itens ainda não está disponível."
        action={
          <Button asChild variant="outline">
            <Link to="..">Voltar para as notas</Link>
          </Button>
        }
      />
    </div>
  );
}
