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

| Comando             | O que faz                                                        |
| ------------------- | ---------------------------------------------------------------- |
| `npm run dev`       | servidor de desenvolvimento                                      |
| `npm run dev:https` | servidor em HTTPS na rede local, para testar a câmera no celular |
| `npm run build`     | typecheck + build de produção                                    |
| `npm run lint`      | ESLint, incluindo as proibições por pasta (seção 18.1)           |
| `npm run typecheck` | TypeScript em modo strict, com `noUncheckedIndexedAccess`        |
| `npm run arch`      | dependency-cruiser: as regras de dependência das seções 5 e 18   |
| `npm run test`      | Vitest + Testing Library, com MSW interceptando a rede           |
| `npm run format`    | Prettier                                                         |

### Testar a câmera no celular

O navegador só libera a câmera em origem segura (HTTPS), e o celular precisa alcançar o seu
computador pela rede local. `npm run dev:https` serve a página em HTTPS com certificado
autoassinado e repassa `/api` para a API, porque uma página em HTTPS não pode chamar uma API em
HTTP (conteúdo misto) e `localhost` no celular é o próprio celular.

1. Suba a API no computador (porta 3000 por padrão; outra porta: `API_PROXY_TARGET=http://localhost:3001`).
2. Crie `.env.https.local` (não é versionado) apontando a interface para ela mesma, com o IP que o
   `npm run dev:https` mostra em "Network":

   ```
   VITE_API_URL=https://192.168.0.10:5173/api
   ```

3. Rode `npm run dev:https` e abra o endereço de "Network" no celular. O navegador avisa que o
   certificado não é confiável: continue mesmo assim, é o certificado de desenvolvimento.

Com a API em desenvolvimento, `AUTH_COOKIE_SECURE=false` (ver o `.env.example` do backend). O
repasse reescreve o `path` do cookie de renovação de `/auth` para `/api/auth`; sem isso o navegador
não o devolveria e a sessão não sobreviveria a um recarregamento.

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
