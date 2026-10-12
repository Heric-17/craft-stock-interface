import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { isApiError } from './api-error';
import { FIELD_REJECTED_MESSAGE, messageForError } from './error-messages';

/**
 * Carries an API failure into a form, the same way for every form in the
 * system.
 *
 * - `VALIDATION_FAILED` marks each field the API named, by the flattened path
 *   it reports (`billOfMaterials.0.quantity`), which is also the name the field
 *   is registered under. The sentence under the field is not the API's — its
 *   `constraints` are English and diagnostic — and the form as a whole carries
 *   the line that says what to do.
 * - Any other failure the user can act on (`INVALID_CREDENTIALS`, a refused
 *   domain rule) becomes the form-level message, from the map keyed by `code`.
 * - An unexpected failure — a 5xx, or no network — is **not** the form's: it
 *   has nothing to do with what was typed, so the function returns `false` and
 *   the caller shows it as a toast with the support code.
 *
 * The form-level message lives at `errors.root.api`.
 *
 * @returns whether the form took the error.
 */
export function applyApiErrorToForm<TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
): boolean {
  if (!isApiError(error) || error.isUnexpected) {
    return false;
  }

  for (const issue of error.validationIssues) {
    if (issue.path !== '') {
      // The cast is the one place a string path becomes a typed one: the API's
      // path and the form's registered name are the same by contract, and a
      // path the form never registered simply has no input to show it on.
      setError(issue.path as Path<TFieldValues>, {
        type: 'server',
        message: FIELD_REJECTED_MESSAGE,
      });
    }
  }

  setError('root.api', { type: 'server', message: messageForError(error) });

  return true;
}
