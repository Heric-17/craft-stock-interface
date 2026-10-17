import { isApiError } from '@/shared/api/api-error';
import { errorDetail, messageForError } from '@/shared/api/error-messages';
import { SupportCode } from './support-code';
const GENERIC_MESSAGE = 'Algo deu errado. Tente novamente.';
export function UnexpectedError({ error }: { error: unknown }) {
  const apiError = isApiError(error) ? error : null;
  const message = apiError === null ? GENERIC_MESSAGE : messageForError(apiError);
  const detail = apiError === null ? undefined : errorDetail(apiError);
  const supportCode = apiError?.isUnexpected === true ? apiError.supportId : undefined;
  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-muted-foreground text-sm">{message}</p>
      {detail === undefined ? null : <p className="text-foreground text-sm">{detail}</p>}
      {supportCode === undefined ? null : <SupportCode code={supportCode} />}
    </div>
  );
}
