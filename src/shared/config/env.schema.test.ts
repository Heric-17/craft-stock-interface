import { describe, expect, it } from 'vitest';

import { MissingEnvironmentError, parseEnv } from './env.schema';

describe('parseEnv', () => {
  const valid = {
    VITE_API_URL: 'http://localhost:3000',
    VITE_COMPANY_NAME: 'Ateliê da Marina',
  };

  it('accepts a complete configuration', () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it('strips the trailing slash so joining a path never doubles it', () => {
    expect(parseEnv({ ...valid, VITE_API_URL: 'https://api.empresa.com.br/' }).VITE_API_URL).toBe(
      'https://api.empresa.com.br',
    );
  });

  it('refuses to start without the API address, and says which variable it is', () => {
    expect(() => parseEnv({ VITE_COMPANY_NAME: 'Ateliê da Marina' })).toThrow(
      MissingEnvironmentError,
    );

    try {
      parseEnv({ VITE_COMPANY_NAME: 'Ateliê da Marina' });
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(MissingEnvironmentError);
      expect((error as MissingEnvironmentError).message).toContain('VITE_API_URL');
      expect((error as MissingEnvironmentError).message).toContain('endereço da API');
    }
  });

  it('refuses an API address that is not a URL', () => {
    expect(() => parseEnv({ ...valid, VITE_API_URL: 'localhost:3000' })).toThrow(
      MissingEnvironmentError,
    );
  });

  it('reports every missing variable at once', () => {
    try {
      parseEnv({});
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      const { issues } = error as MissingEnvironmentError;

      expect(issues).toHaveLength(2);
      expect(issues.join('\n')).toContain('VITE_COMPANY_NAME');
    }
  });
});
