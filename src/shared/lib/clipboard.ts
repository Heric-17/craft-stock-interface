/**
 * Copies text for the user to paste elsewhere. Resolves `false` instead of
 * throwing: the clipboard is unavailable outside a secure context and refused
 * when the page is not focused, and "could not copy" is something the caller
 * tells the user, not a crash.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
