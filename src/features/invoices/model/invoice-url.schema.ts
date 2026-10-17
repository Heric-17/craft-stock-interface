import { z } from 'zod';

/**
 * The only checks made on this side: that something was typed, and that it is
 * an address on the web. Whether it is a note the portal knows is the API's to
 * decide, and it answers with a reason the screen can say.
 *
 * `https` is required rather than merely "a URL": the QR Code of a note is a
 * portal address, and a line of free text or an `intent:` link pasted by mistake
 * is better stopped here than sent.
 */
export const invoiceUrlSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Cole o endereço que está no QR Code da nota.')
    .refine(isHttpsUrl, 'O endereço precisa começar com https://'),
});

export type InvoiceUrlFormValues = z.infer<typeof invoiceUrlSchema>;

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
