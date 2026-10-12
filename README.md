# CraftStock — interface

SPA que consome a API do CraftStock: estoque fracionado, precificação e projeção de capacidade de
produção.

Uma build por instalação. O nome da empresa e o endereço da API vêm do ambiente; não há seletor
de empresa, de plano nem de conta, e não há papéis.

## Começando

```bash
npm install
cp .env.example .env    # preencha VITE_API_URL e VITE_COMPANY_NAME
npm run dev
```

Sem `VITE_API_URL` ou `VITE_COMPANY_NAME` o `dev` e o `build` param na partida dizendo qual
variável falta.

## Scripts

| Comando             | O que faz                                                      |
| ------------------- | -------------------------------------------------------------- |
| `npm run dev`       | servidor de desenvolvimento                                    |
| `npm run build`     | typecheck + build de produção                                  |
| `npm run lint`      | ESLint, incluindo as proibições por pasta (seção 18.1)         |
| `npm run typecheck` | TypeScript em modo strict, com `noUncheckedIndexedAccess`      |
| `npm run arch`      | dependency-cruiser: as regras de dependência das seções 5 e 18 |
| `npm run test`      | Vitest + Testing Library, com MSW interceptando a rede         |
| `npm run format`    | Prettier                                                       |

Os cinco que o CI roda — `lint`, `typecheck`, `arch`, `test`, `build` — precisam passar antes de
qualquer tarefa ser dada como concluída.

## Estrutura

```
src/
  app/        router, providers, AppShell, error boundary de rota
  shared/
    api/      http-client, ApiError, mensagens de erro, query client
    config/   validação do ambiente (Zod), lida na partida e no browser
    lib/      utilitários sem regra de negócio
    ui/       componentes shadcn e genéricos
  features/   uma pasta por feature: api/, model/, components/, pages/, index.ts
  test/       setup do Vitest e servidor MSW
```

Direção das dependências, verificada por `npm run arch`:

```
app  ->  features  ->  shared
pages -> components -> model
api   -> model, shared/api
```

## Documentação

**O material de trabalho não é versionado.** `docs/` e as notas de arquitetura ficam só no disco
de quem desenvolve: são insumo para construir a interface, não parte do que se publica. O
`.gitignore` ignora todo `.md` fora deste README, mais `docs/mockups/` e `docs/v0-reference/`.

O contrato da API também não vive aqui: ele pertence ao repositório do backend
(`craft-stock-api/docs/`), igualmente fora do GitHub, e é lido de lá. Contrato copiado envelhece
em silêncio — já aconteceu uma vez, com a cópia que descrevia o refresh token no corpo da
resposta depois de o backend tê-lo movido para cookie.

Quem for mexer no projeto encontra, no disco: `docs/README.md` (onde estão os três contratos do
backend), `docs/api-reference.md` (o recorte do contrato que este frontend consome),
`docs/divergencias.md` (mockup contra API, nas quatro listas) e as pastas `docs/mockups/` e
`docs/v0-reference/`.
