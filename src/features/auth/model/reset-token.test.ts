import { describe, expect, it } from 'vitest';

import { readResetToken } from './reset-token';

const TOKEN = 'a'.repeat(64);

describe('readResetToken', () => {
  it('reads the token out of the fragment of the link', () => {
    expect(readResetToken(`#token=${TOKEN}`)).toBe(TOKEN);
  });

  it('reads it without the leading hash too', () => {
    expect(readResetToken(`token=${TOKEN}`)).toBe(TOKEN);
  });

  it('finds it among other parameters', () => {
    expect(readResetToken(`#utm=x&token=${TOKEN}`)).toBe(TOKEN);
  });

  it('answers null when there is no fragment, or no token in it', () => {
    expect(readResetToken('')).toBeNull();
    expect(readResetToken('#')).toBeNull();
    expect(readResetToken('#outra=coisa')).toBeNull();
  });

  it('answers null for an empty token', () => {
    expect(readResetToken('#token=')).toBeNull();
  });

  it('answers null for something that cannot be a token the API issued', () => {
    expect(readResetToken(`#token=${'a'.repeat(257)}`)).toBeNull();
    expect(readResetToken('#token=com%20espa%C3%A7o')).toBeNull();
  });
});
