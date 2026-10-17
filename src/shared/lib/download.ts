/**
 * Byte order mark. Excel opens a CSV as the machine's ANSI page unless it finds
 * this at the start, and then every accent in a shop's name turns into noise.
 */
const UTF8_BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

const REVOKE_DELAY_MILLISECONDS = 1000;

/**
 * Hands a text to the browser as a file to save, built here and never sent
 * anywhere: nothing about it reaches the API. The object address is let go a moment
 * after the click.
 */
export function downloadTextFile(fileName: string, text: string, mimeType: string): void {
  const blob = new Blob([UTF8_BYTE_ORDER_MARK, text], { type: `${mimeType};charset=utf-8` });
  const address = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = address;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();

  // Some browsers start reading the address after the click returns, so it is let go a moment later.
  setTimeout(() => URL.revokeObjectURL(address), REVOKE_DELAY_MILLISECONDS);
}
