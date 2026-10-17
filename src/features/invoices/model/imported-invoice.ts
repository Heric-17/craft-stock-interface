import type { ImportedInvoiceDto } from '../api/invoice.dto';

/** A note that has just been imported: enough to say which one and to open the next step. */
export interface ImportedInvoice {
  purchaseId: string;
  /** The shop's name as the note printed it. */
  merchantName: string | null;
}

export function toImportedInvoice(dto: ImportedInvoiceDto): ImportedInvoice {
  return { purchaseId: dto.purchaseId, merchantName: dto.merchantName };
}
