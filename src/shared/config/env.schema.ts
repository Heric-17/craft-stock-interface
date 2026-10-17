import { z } from 'zod';

/**
 * The configuration of one installation.
 *
 * Kept free of `import.meta.env` on purpose: the Vite config reads it at
 * startup so a missing variable stops `dev` and `build` instead of shipping a
 * bundle that fails in the browser, and the application reads it again at
 * runtime for the bundle that is already built. One schema, two readers.
 */
export const envSchema = z.object({
  VITE_API_URL: z
    .string({ required_error: 'é obrigatória' })
    .min(1, 'é obrigatória')
    // `new URL` alone accepts `localhost:3000`, reading `localhost:` as the
    // protocol. Requiring http or https is what makes the check mean what it
    // looks like it means.
    .refine(
      (value) => /^https?:\/\/[^/\s]+/.test(value),
      'precisa ser uma URL completa começando com http:// ou https://, por exemplo https://api.suaempresa.com.br',
    )
    .transform((value) => value.replace(/\/+$/, '')),

  VITE_COMPANY_NAME: z
    .string({ required_error: 'é obrigatório' })
    .min(1, 'é obrigatório')
    .transform((value) => value.trim()),
});

export type Env = z.infer<typeof envSchema>;

/** What each variable is for, shown with the failure so it can be fixed in one pass. */
const PURPOSE: Record<string, string> = {
  VITE_API_URL: 'endereço da API do CraftStock',
  VITE_COMPANY_NAME: 'nome da empresa exibido na interface',
};

export class MissingEnvironmentError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(
      [
        'Configuração ausente ou inválida.',
        ...issues.map((issue) => `  - ${issue}`),
        '',
        'Copie o arquivo .env.example para .env e preencha os valores.',
      ].join('\n'),
    );
    this.name = 'MissingEnvironmentError';
    this.issues = issues;
  }
}

/**
 * Validates whatever the caller hands over. Throws with every problem listed
 * at once — discovering one missing variable per restart is its own small
 * punishment.
 */
export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues.map((issue) => {
    const name = String(issue.path[0] ?? '(raiz)');
    const purpose = PURPOSE[name];

    return purpose === undefined
      ? `${name}: ${issue.message}`
      : `${name} (${purpose}): ${issue.message}`;
  });

  throw new MissingEnvironmentError(issues);
}

/**
 * Whether the page and the API are on different hosts. The refresh token is a
 * `SameSite=Lax` cookie, and a browser neither stores it from a cross-site
 * response nor sends it on a cross-site request — so a page opened at
 * `localhost` calling an API at `192.168.0.10` signs in fine and loses the
 * session on every reload, with no error anywhere. Ports do not count: the same
 * host on two ports is the same site.
 */
export function apiOnAnotherHost(apiUrl: string, pageHostname: string): boolean {
  try {
    return new URL(apiUrl).hostname !== pageHostname;
  } catch {
    return false;
  }
}
