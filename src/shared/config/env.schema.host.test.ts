import { describe, expect, it } from 'vitest';

import { apiOnAnotherHost } from './env.schema';

describe('apiOnAnotherHost', () => {
  it('is false when the page and the API share a host, whatever the ports', () => {
    expect(apiOnAnotherHost('http://localhost:3000', 'localhost')).toBe(false);
    expect(apiOnAnotherHost('http://192.168.0.73:3000', '192.168.0.73')).toBe(false);
  });

  it('is true when the host differs, which is when the refresh cookie is dropped', () => {
    expect(apiOnAnotherHost('http://192.168.0.73:3000', 'localhost')).toBe(true);
    expect(apiOnAnotherHost('http://localhost:3000', '192.168.0.73')).toBe(true);
  });

  it('is false for an address it cannot read', () => {
    expect(apiOnAnotherHost('nao-e-uma-url', 'localhost')).toBe(false);
  });
});
