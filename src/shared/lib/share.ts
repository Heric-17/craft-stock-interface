/**
 * Whether the browser can hand text to the system's share sheet. It is a phone's
 * feature, mostly, and needs a secure context: on a desktop browser it is often
 * missing, and a screen that offers "Compartilhar" there offers a button that
 * does nothing. The caller shows the button only when this is true.
 */
export function canShareText(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export type ShareResult = 'shared' | 'cancelled' | 'failed';

/**
 * Opens the system's share sheet with a text. Resolves instead of throwing:
 * closing the sheet without choosing anything is not an error, and is told
 * apart from a share that could not happen, which the caller tells the user.
 */
export async function shareText(title: string, text: string): Promise<ShareResult> {
  try {
    await navigator.share({ title, text });

    return 'shared';
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
