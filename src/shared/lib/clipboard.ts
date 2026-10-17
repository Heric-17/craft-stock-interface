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

/**
 * Reads the text the user copied, for a "paste" button. Resolves `null` when it
 * cannot: the API only exists in a secure context, the browser asks permission
 * and the person may refuse, and some browsers never allow a read from a page.
 * Every one of those is "paste it by hand", which the caller tells the user,
 * and none of them is a crash.
 */
export async function readFromClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}
