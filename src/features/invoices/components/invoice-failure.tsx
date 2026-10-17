import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { isApiError } from '@/shared/api/api-error';
import { messageForError } from '@/shared/api/error-messages';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { SupportCode } from '@/shared/ui/support-code';

interface InvoiceFailureProps {
  error: unknown;
  /** Where the second step of a given purchase is. */
  classificationPath: (purchaseId: string) => string;
}

/**
 * What went wrong while reading a note, and what to do about it. Reading a note
 * fails in ways that call for different things:
 *
 * - **Already imported:** not a failure at all. The note exists, and the way out
 *   is to go to it, by the purchase the API names in `details`.
 * - **The portal did not answer:** it passes. The note is kept in the queue and
 *   trying again is the right thing to do, so there is no code to report.
 * - **Anything else**, above all the portal having changed under the reader:
 *   nothing the person can fix. The code goes with the message so that
 *   whoever can fix it can find this exact failure.
 */
export function InvoiceFailure({ error, classificationPath }: InvoiceFailureProps) {
  if (!isApiError(error)) {
    return (
      <Callout tone="danger" alert>
        Algo deu errado. Tente novamente.
      </Callout>
    );
  }

  const duplicate = error.detailsFor('DUPLICATE_INVOICE');

  if (duplicate !== undefined) {
    return (
      <Callout tone="warning" alert className="flex flex-col items-start gap-3">
        <span>{messageForError(error)}</span>
        <Button asChild variant="outline" size="sm">
          <Link to={classificationPath(duplicate.existingPurchaseId)}>
            Abrir a nota importada
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </Callout>
    );
  }

  if (error.code === 'INVOICE_SOURCE_UNAVAILABLE') {
    return (
      <Callout tone="warning" alert>
        {messageForError(error)}
      </Callout>
    );
  }

  const supportCode = error.isUnexpected ? error.supportId : undefined;

  return (
    <div className="flex flex-col gap-3">
      <Callout tone="danger" alert>
        {messageForError(error)}
      </Callout>
      {supportCode === undefined ? null : <SupportCode code={supportCode} />}
    </div>
  );
}
