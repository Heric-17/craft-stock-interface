import { describe, expect, it } from 'vitest';

import { loginPath, safeDestination } from './redirect';

describe('safeDestination', () => {
  it('goes to the start when there is nowhere else to go', () => {
    expect(safeDestination(null)).toBe('/');
    expect(safeDestination('')).toBe('/');
  });

  it('keeps a page of this application, with its query and anchor', () => {
    expect(safeDestination('/materials')).toBe('/materials');
    expect(safeDestination('/sales?paymentStatus=PENDING&offset=20#top')).toBe(
      '/sales?paymentStatus=PENDING&offset=20#top',
    );
  });

  it.each([
    ['another host', 'https://evil.example/phish'],
    ['a protocol-relative address', '//evil.example/phish'],
    ['a backslash that browsers read as a slash', '/\\evil.example'],
    ['a javascript: address', 'javascript:alert(1)'],
    ['a data: address', 'data:text/html,<script>alert(1)</script>'],
  ])('refuses %s, which would turn the login into an open redirect', (_label, value) => {
    expect(safeDestination(value)).toBe('/');
  });

  it('does not send a person back to the login they just used', () => {
    expect(safeDestination('/login')).toBe('/');
    expect(safeDestination('/login?redirect=%2Fsales')).toBe('/');
  });
});

describe('loginPath', () => {
  it('is the bare login when the start is where they were', () => {
    expect(loginPath('/')).toBe('/login');
  });

  it('carries the page they were on, encoded, so signing in brings them back', () => {
    expect(loginPath('/sales?paymentStatus=PENDING')).toBe(
      '/login?redirect=%2Fsales%3FpaymentStatus%3DPENDING',
    );
  });

  it('round-trips through safeDestination', () => {
    const target = '/purchases?limit=50&offset=100';
    const redirect = new URLSearchParams(loginPath(target).split('?')[1]).get('redirect');

    expect(safeDestination(redirect)).toBe(target);
  });

  it('never builds a login address that points somewhere else', () => {
    expect(loginPath('https://evil.example')).toBe('/login');
  });
});
