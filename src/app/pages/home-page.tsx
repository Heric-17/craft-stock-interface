import { env } from '@/shared/config/env';

/**
 * The landing route while the features are being built. It is replaced by the
 * first real screen; nothing here reads from the API, and nothing here is a
 * placeholder for data the API does not have.
 */
export function HomePage() {
  return (
    <section className="flex flex-col gap-3">
      <p className="text-muted-foreground text-[0.625rem] font-bold tracking-[0.1em] uppercase">
        {env.VITE_COMPANY_NAME}
      </p>
      <h1 className="text-3xl font-bold tracking-tight">CraftStock</h1>
      <p className="text-muted-foreground max-w-prose text-sm">
        Controle de estoque fracionado, precificação e capacidade de produção. As telas entram aqui
        conforme ficam prontas.
      </p>
    </section>
  );
}
