import { useState } from 'react';

import { PageHeader } from '@/shared/ui/page-header';

import { InvoiceImportForm } from '../components/invoice-import-form';
import { InvoiceQueue } from '../components/invoice-queue';
import { RecentInvoices } from '../components/recent-invoices';

interface InvoiceImportPageProps {
  /**
   * Where the second step of a given purchase is. The route table owns every
   * path, so the page is told this one instead of spelling it.
   */
  classificationPath: (purchaseId: string) => string;
  /** Where every imported note is. */
  historyPath: string;
}

/**
 * Importing a note: the address of its QR Code on top, then the notes that are
 * waiting to be read, then the ones that came in. Scanning is the first half of
 * a job that is finished elsewhere, so what happened to the notes already sent is
 * the other half of the same screen.
 */
export function InvoiceImportPage({ classificationPath, historyPath }: InvoiceImportPageProps) {
  const [focusRequest, setFocusRequest] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operação"
        title="Importar nota fiscal"
        description="Dê entrada nos seus insumos sem digitação manual."
      />

      <InvoiceImportForm classificationPath={classificationPath} focusRequest={focusRequest} />

      <InvoiceQueue classificationPath={classificationPath} />

      <RecentInvoices
        classificationPath={classificationPath}
        historyPath={historyPath}
        onStartImport={() => setFocusRequest((count) => count + 1)}
      />
    </div>
  );
}
