import { describe, expect, it } from 'vitest';

import { invoiceUrlSchema, isHttpsUrl } from './invoice-url.schema';

describe('invoiceUrlSchema', () => {
  it('accepts the address of a portal and trims what was pasted around it', () => {
    const result = invoiceUrlSchema.safeParse({
      url: '  https://www.nfce.fazenda.sp.gov.br/qrcode?p=3524|2|1|1|abc \n',
    });

    expect(result.success).toBe(true);
    expect(result.data?.url).toBe('https://www.nfce.fazenda.sp.gov.br/qrcode?p=3524|2|1|1|abc');
  });

  it('asks for the address when the field is empty or only spaces', () => {
    for (const url of ['', '   ']) {
      const result = invoiceUrlSchema.safeParse({ url });

      expect(result.error?.issues[0]?.message).toBe('Cole o endereço que está no QR Code da nota.');
    }
  });

  it('refuses what is not an https address, with the way to fix it', () => {
    for (const url of [
      'nfce.fazenda.sp.gov.br/qrcode',
      'http://portal.example/nota',
      'Nota do mercado',
      'javascript:alert(1)',
      'ftp://portal.example/nota',
    ]) {
      const result = invoiceUrlSchema.safeParse({ url });

      expect(result.success, url).toBe(false);
      expect(result.error?.issues[0]?.message, url).toBe('O endereço precisa começar com https://');
    }
  });
});

describe('isHttpsUrl', () => {
  it('is true only for https', () => {
    expect(isHttpsUrl('https://portal.example/nota')).toBe(true);
    expect(isHttpsUrl('http://portal.example/nota')).toBe(false);
    expect(isHttpsUrl('portal.example/nota')).toBe(false);
  });
});
