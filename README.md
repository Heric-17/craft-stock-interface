# CraftStock — interface

SPA que consome a API do CraftStock: gestão de estoque fracionado, precificação e projeção de
capacidade de produção para pequenos negócios que produzem itens compostos. O insumo é comprado em
embalagem fechada e consumido em fração dela; a interface mostra custo, preço sugerido, o que dá
para produzir e o insumo que limita a produção.

**O backend é a fonte da verdade das regras de negócio.** A interface não recalcula custo, preço
sugerido, capacidade, gargalo, desconto atribuído, total de venda nem estoque baixo: exibe o que a
API devolve. As únicas contas feitas aqui são as métricas derivadas do dataset analítico e as
prévias de formulário (ficha técnica e venda), porque a API não oferece simulação. Ambas usam
`Money`, ficam em `model/` e têm teste.

Uma build por instalação: o nome da empresa e o endereço da API vêm do ambiente. Não há seletor de
empresa, de plano nem de conta, e não há papéis.

## Começando

Requer Node 22.23.3 ou posterior.

```bash
npm install
cp .env.example .env    # preencha VITE_API_URL e VITE_COMPANY_NAME
npm run dev
```

Sem `VITE_API_URL` ou `VITE_COMPANY_NAME` o `dev` e o `build` param na partida dizendo qual
variável falta.

### Variáveis de ambiente

São lidas na **build** (o Vite as grava no pacote), não na execução: mudar uma exige nova build.

| Variável            | Obrigatória | O que é                                                                                              |
| ------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `VITE_API_URL`      | sim         | Endereço da API, URL completa, sem barra no fim. Em produção: o endereço do próprio site mais `/api` |
| `VITE_COMPANY_NAME` | sim         | Nome da empresa exibido no menu e na tela de entrada                                                 |

Para o ambiente de desenvolvimento do próprio Vite há ainda duas variáveis de **processo** (não
vão para o pacote), usadas por `npm run dev:https` e pelo `vite preview`:

| Variável           | Padrão                  | O que faz                                                                   |
| ------------------ | ----------------------- | --------------------------------------------------------------------------- |
| `API_PROXY_TARGET` | `http://localhost:3000` | Para onde o servidor repassa `/api` (a API responde sob esse mesmo prefixo) |

## Scripts

| Comando                    | O que faz                                                              |
| -------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`              | servidor de desenvolvimento                                            |
| `npm run dev:https`        | servidor em HTTPS na rede local, para testar a câmera no celular       |
| `npm run build`            | typecheck + build de produção em `dist/`                               |
| `npm run preview`          | serve o `dist/` localmente, com os cabeçalhos de segurança de produção |
| `npm run lint`             | ESLint, incluindo as proibições por pasta                              |
| `npm run typecheck`        | TypeScript em modo strict, com `noUncheckedIndexedAccess`              |
| `npm run arch`             | dependency-cruiser: as regras de dependência                           |
| `npm run test`             | Vitest + Testing Library, com MSW interceptando a rede                 |
| `npm run test:coverage`    | o mesmo, com cobertura                                                 |
| `npm run e2e`              | Playwright contra o backend local (ver "Testes de ponta a ponta")      |
| `npm run e2e:install`      | baixa o Chromium que o Playwright usa                                  |
| `npm run check:deployment` | confere um site publicado (ver "Implantação")                          |
| `npm run format`           | Prettier                                                               |

Os cinco que o CI roda — `lint`, `typecheck`, `arch`, `test`, `build` — mais `format:check`,
precisam passar antes de qualquer tarefa ser dada como concluída.

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

**Se o servidor cair ao abrir a página no celular** com `server.shouldUpgradeCallback is not a
function`, o problema é o Node, não o projeto: a versão 22.21.0 tem um defeito
([nodejs/node#60336](https://github.com/nodejs/node/issues/60336)) que derruba o servidor HTTPS do
Vite na primeira conexão. A tela do navegador mostra "O CraftStock não conseguiu iniciar", com
"Failed to fetch dynamically imported module". Use o Node 22.20 ou anterior, ou uma versão
posterior à 22.21; o 22.23.3 foi testado e funciona. Confira com `node -v` no mesmo terminal em que
roda o `dev:https`: com `nvm`, um Node instalado à parte em `C:\Program Files\nodejs` pode vir antes
no `PATH` e continuar valendo mesmo depois do `nvm use`.

Com a API em desenvolvimento, `AUTH_COOKIE_SECURE=false` (ver o `.env.example` do backend). A API
responde sob `/api`, então o repasse passa o caminho e o cookie de renovação (`Path=/api/auth`) como
vêm: nada é reescrito.

## Estrutura

```
src/
  app/        router, providers, AppShell, error boundary de rota, navegação (caminhos de rota)
  shared/
    api/      http-client, ApiError, mensagens de erro, query client
    config/   validação do ambiente (Zod), lida na partida e no browser
    money/    Money, DecimalString, Percentage
    quantity/ Quantity, ConsumptionUnit, conversão kg/L/m
    format/   toda formatação de exibição, leitura de entrada em pt-BR, período e fuso
    lib/      utilitários sem regra de negócio
    theme/    tema claro/escuro
    ui/       componentes shadcn e genéricos
  features/   auth, materials, composite-products, sales, invoices, shortages, spending,
              activity, settings — cada uma com api/, model/, components/, pages/, index.ts
  test/       setup do Vitest e servidor MSW
e2e/          testes de ponta a ponta (Playwright)
scripts/      conferência de um site publicado
```

Direção das dependências:

```
app  ->  features  ->  shared
pages -> components -> model
api   -> model, shared/api
```

### Regras verificadas por máquina

Cada regra abaixo falha o CI; nenhuma depende de lembrança.

| Regra                                                                                               | Quem verifica                |
| --------------------------------------------------------------------------------------------------- | ---------------------------- |
| `shared/` não importa `features/` nem `app/`; uma feature importa outra só pelo `index.ts`          | dependency-cruiser, ESLint   |
| Só `features/*/api` e `shared/api` tocam o `http-client`; ninguém mais chama `fetch`                | dependency-cruiser, ESLint   |
| Tipos de DTO não saem de `api/` e `model/`; `model/` é TypeScript puro, sem React, fetch nem DOM    | dependency-cruiser           |
| Sem `parseFloat`, `Number()`, `toFixed` fora de `shared/money`, `shared/quantity` e `shared/format` | ESLint                       |
| Sem `Intl`, `toLocaleString` nem formatação de data fora de `shared/format`                         | ESLint                       |
| Sem `localStorage`/`sessionStorage` (única exceção: a preferência de tema em `theme-storage.ts`)    | ESLint                       |
| Nenhuma cor em hexadecimal nem funcional dentro de componente                                       | ESLint                       |
| Sem `next/*`, sem dependência circular, sem arquivo órfão                                           | dependency-cruiser           |
| Dinheiro e quantidade: aritmética, arredondamento único, conversão de unidade, eco de interpretação | Vitest (`shared/*`)          |
| Texto de erro vem do mapa indexado por `code`; todo número exibido num erro vem de `details`        | Vitest (`shared/api`)        |
| Renovação de token em voo único; token só em memória                                                | Vitest (`shared/api`)        |
| Prévias de ficha e venda repetem a tabela do `pricing-formula.md` do backend, caso a caso           | Vitest (`features/*/model`)  |
| Todo par texto/fundo dos tokens de cor tem contraste AA nos dois temas                              | Vitest (`shared/theme`)      |
| Sem rolagem horizontal e alvos de toque de 44px, de 320 a 1280px, em toda tela com conteúdo         | Playwright (`responsive`)    |
| Todo controle tem nome; foco visível; teclado preso e devolvido em diálogo e gaveta                 | Playwright (`accessibility`) |
| Nenhuma tela viola a Content-Security-Policy e nenhuma chamada sai da origem                        | Playwright (`security`)      |

O jsdom não calcula layout: largura, rolagem e tamanho de alvo são sempre zero lá. Por isso a
responsividade se confere no Chromium real, no Playwright, e o Vitest só confere a troca de forma
do conteúdo (cartões no lugar de tabela, gaveta no lugar de menu lateral).

## Testes de ponta a ponta

O Playwright abre o **build de produção** da interface contra o **backend de verdade** e um banco
próprio dos testes. Nada é interceptado. A página é servida com os cabeçalhos de segurança de
produção (lidos do `render.yaml`) e chega à API por `/api` na própria origem, que é a topologia da
implantação.

| Arquivo                 | O que cobre                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session.spec.ts`       | login, senha errada, redirecionamento, **expiração do access token e renovação silenciosa**, recarga                                                                       |
| `stock-flow.spec.ts`    | cadastrar insumo e dar entrada, montar ficha técnica e ver o gargalo, criar venda, passar para **Montado** e ver o estoque debitado, voltar a **Pendente** e ver devolvido |
| `responsive.spec.ts`    | rolagem horizontal e alvos de toque em 22 telas (e nos painéis abertos) a 320, 360, 768 e 1280px                                                                           |
| `accessibility.spec.ts` | nome em todo controle, foco visível, teclado em diálogo e gaveta                                                                                                           |
| `security.spec.ts`      | cabeçalhos, Content-Security-Policy, cookie de sessão em `/api/auth`                                                                                                       |

A importação de nota **não tem teste de ponta a ponta**: o backend não tem modo de fixture para a
leitura da nota (ela vai ao portal da SEFAZ de verdade), e um teste que dependesse de um portal
público seria instável. O fluxo é coberto no Vitest, com MSW, e deve ser conferido em aparelho real
(ver abaixo).

### Como rodar

1. Suba o PostgreSQL do backend (`docker compose up -d` no repositório dele).
2. Crie um banco só para os testes. O nome **precisa terminar em `_e2e`**; o script recusa outro:

   ```bash
   docker exec craftstock-postgres psql -U craftstock -d craftstock -c "CREATE DATABASE craftstock_e2e"
   ```

3. Compile o backend (`npm run build` no repositório dele). Ele fica ao lado deste, em
   `../craft-stock-api`; outro lugar: `E2E_BACKEND_PATH`.
4. Instale o navegador uma vez: `npm run e2e:install`.
5. `npm run e2e`.

O script `e2e/support/start-backend.mjs` aplica as migrações e o seed (idempotentes, nada é
zerado), sobe a API em outra porta (3100) e força valores inofensivos para armazenamento, e-mail e
alertas — a execução nunca escreve em bucket nem manda mensagem, qualquer que seja o `.env` do
backend. O access token vive 6 segundos nessa execução em vez de 900, para a renovação silenciosa
ser exercitada por espera de verdade, sem simulação. Outro banco: `E2E_DATABASE_URL`.

Os testes usam nomes únicos e não dependem de banco vazio. Para recomeçar do zero, apague o banco
`craftstock_e2e` e crie de novo.

Rode antes de cada entrega. Não está no CI porque o backend vive em outro repositório.

## Implantação

Hospedagem: **Render, static site**, um por instalação, definido por [`render.yaml`](render.yaml).

### A regra de um host só

O cookie de renovação da sessão é `HttpOnly`, `Secure` e **`SameSite=Lax`**. O navegador só o
devolve se a página e a API forem o **mesmo site**. Dois subdomínios de `onrender.com` **não** são:
`onrender.com` está na [Public Suffix List](https://publicsuffix.org/), então cada subdomínio conta
como um site distinto, e uma chamada de `app.onrender.com` para `api.onrender.com` é entre sites. O
refresh passaria a falhar sempre, com 401, e a sessão deixaria de sobreviver a um recarregamento,
sem erro em lugar nenhum.

A solução é o navegador enxergar **um host só**:

```
navegador ──► https://craft-stock-web.onrender.com/            interface (arquivos estáticos)
          └─► https://craft-stock-web.onrender.com/api/...     o Render encaminha, como proxy,
                                                               para https://craft-stock-api.onrender.com/api/...
```

- O site estático tem uma regra de **rewrite** de `/api/*` para a URL pública da API, **mantendo o
  `/api` no destino**. É proxy, não redirecionamento: o endereço no navegador não muda, e o cookie
  nasce e volta no host da interface.
- A API responde sob `/api` (prefixo global), de modo que o cookie que ela cria já sai com
  `Path=/api/auth`, o caminho onde o navegador vai enviá-lo.
- **Não se usa `SameSite=None`**: o Safari bloqueia cookie de terceiros, e a sessão no iPhone
  quebraria.

Dois subdomínios de `onrender.com` continuam sendo dois sites, e isso não importa mais: o navegador
só fala com um deles. Domínio próprio deixa de ser requisito (continua funcionando, se existir).

### O que a API precisa ter

| Na API                  | Valor                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prefixo global          | **`/api`** (já é o que a API faz: `API_GLOBAL_PREFIX` é uma constante em `src/shared/presentation/http/api-prefix.ts`). Todas as rotas de negócio e de sessão ficam sob ele, e o `Path` do cookie sai `/api/auth` sozinho. A rota antiga na raiz (`/auth/login`) dá 404                                                                                                                             |
| Health check do serviço | **`/health`**, fora do prefixo de propósito (`/api/health` dá 404): o `HEALTHCHECK` do Dockerfile e o "Health Check Path" do Render não mudam                                                                                                                                                                                                                                                       |
| Imagens em disco local  | `/uploads` fica na raiz, fora do prefixo, e a `imageUrl` é absoluta e aponta direto para o host da API, sem passar pelo rewrite. Em produção use `STORAGE_PROVIDER=S3` (a `imageUrl` vem de `S3_PUBLIC_BASE_URL`; a CSP já aceita qualquer `https:`). No desenvolvimento a imagem vem de `http://localhost:3000/uploads/...`, que a CSP de produção (usada pelo `vite preview`) recusa de propósito |
| `NODE_ENV`              | `production`                                                                                                                                                                                                                                                                                                                                                                                        |
| `AUTH_COOKIE_SECURE`    | `true` (a API recusa `false` em produção)                                                                                                                                                                                                                                                                                                                                                           |
| `JWT_SECRET`            | um segredo da instalação, com 32 caracteres ou mais                                                                                                                                                                                                                                                                                                                                                 |
| `CORS_ORIGINS`          | a origem da interface, por exemplo `https://craft-stock-web.onrender.com`. **Obrigatória em produção: a API não sobe sem ela**                                                                                                                                                                                                                                                                      |
| `PUBLIC_BASE_URL`       | o endereço público da API. Obrigatória em produção                                                                                                                                                                                                                                                                                                                                                  |
| `WEB_APP_URL`           | a origem da interface: o link do e-mail de redefinição de senha é montado a partir dela (obrigatória com `EMAIL_SENDER=SMTP`)                                                                                                                                                                                                                                                                       |

**O CORS continua necessário?** Em produção, o navegador não faz chamada entre origens (a interface
chama o próprio host), então o CORS não é exercitado. Mas `CORS_ORIGINS` precisa estar preenchida
mesmo assim, porque a API recusa subir em produção sem ela, e continua útil no desenvolvimento
local, onde a interface (`:5173`) e a API (`:3000`) são origens diferentes. Sem a variável, fora de
produção, a API já libera `localhost:5173` e `127.0.0.1:5173`.

### Passo a passo para subir uma instalação nova

1. **API.** Suba o serviço da API no Render (ou onde preferir) com o prefixo `/api` e as variáveis
   da tabela acima. Anote o endereço público, por exemplo `https://craft-stock-api.onrender.com`. O
   rewrite exige serviço **público**: o Render não encaminha para serviço privado.
2. **Primeira conta.** Não existe cadastro público (`POST /users` exige login). Crie a conta inicial
   com o seed da API: `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` e `SEED_USER_NAME` no ambiente e
   `npx prisma db seed`.
3. **Interface.** No Render, **New → Blueprint** e aponte para este repositório. Antes de aplicar,
   em [`render.yaml`](render.yaml), troque o `destination` da regra `/api/*` pelo endereço da API
   do passo 1 (mantendo `/api/*` no fim) e, se quiser, o `name` do serviço.
4. **Variáveis do site.** O Render pede os valores marcados com `sync: false`:
   - `VITE_API_URL`: o **endereço do próprio site mais `/api`**, por exemplo
     `https://craft-stock-web.onrender.com/api`. É o mesmo host da página, de propósito;
   - `VITE_COMPANY_NAME`: o nome da empresa.
5. **CORS e e-mail.** Com o endereço do site já conhecido, volte à API e preencha `CORS_ORIGINS` e
   `WEB_APP_URL` com ele.
6. **Conferir.** Com o site no ar, rode, de qualquer computador:

   ```bash
   CHECK_EMAIL=conta@empresa.com CHECK_PASSWORD='...' \
     npm run check:deployment -- https://craft-stock-web.onrender.com
   ```

   Ele confere o que um teste automático dentro do repositório não alcança: o rewrite preserva a
   query string e o corpo do POST, o `Set-Cookie` sobrevive e sai com `Path=/api/auth`, `HttpOnly`,
   `Secure`, `SameSite=Lax` e sem `Domain`, o refresh aceita o cookie, os cabeçalhos de segurança
   chegam e o cache dos arquivos está como deveria. Sem `CHECK_EMAIL` e `CHECK_PASSWORD` ele confere
   só a página e o caminho do rewrite.

7. **Abrir no aparelho.** Entre pelo celular, recarregue a página (a sessão tem que sobreviver) e
   escaneie uma nota.

### O que o `render.yaml` configura

| Item                | Valor                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build               | `npm ci && npm run build`, publicando `dist/`                                                                                                                                                      |
| Rota `/api/*`       | rewrite para a API, com `/api` mantido no destino                                                                                                                                                  |
| Rota `/*`           | rewrite para `/index.html`: rota profunda e recarregamento abrem a tela, sem 404. O Render não aplica a regra a um caminho em que existe arquivo, então os arquivos de `assets/` saem como são     |
| `/assets/*`         | `Cache-Control: public, max-age=31536000, immutable` (o nome do arquivo leva o hash do conteúdo)                                                                                                   |
| `/` e `/index.html` | `Cache-Control: no-cache` (o ponto de entrada nomeia os arquivos com hash e precisa ser pedido sempre)                                                                                             |
| Todas as respostas  | `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (câmera só da própria origem, que lê o QR Code), `Strict-Transport-Security` |

A Content-Security-Policy permite scripts só da própria origem (por isso o script que aplica o tema
antes da primeira pintura é o arquivo `public/theme-init.js`, e não um bloco dentro do HTML) e
chamadas só à própria origem (a API está atrás do `/api`). O `vite preview` e o Playwright servem a
página com **os mesmos cabeçalhos**, lidos do `render.yaml`: uma política que só fosse testada em
produção quebraria a interface no primeiro deploy.

**Limites do que a documentação do Render garante** (por isso o passo 6): a documentação não diz se
o rewrite preserva query string, corpo de POST e `Set-Cookie`, nem qual regra vence quando dois
cabeçalhos iguais casam o mesmo caminho. O `render.yaml` evita a segunda dúvida (nenhum
`Cache-Control` em `/*`: cada caminho pertence a uma regra só), e o `check:deployment` responde à
primeira com o site de verdade.

### Se a sessão não sobrevive ao recarregamento

É o sintoma de um cookie que o navegador não devolve, sem erro em lugar nenhum. Em ordem:

1. A interface está chamando `/api` no **próprio host**? `VITE_API_URL` precisa ser o endereço do
   site mais `/api`. Se apontar para o endereço da API, é entre sites e o cookie some.
2. A API responde sob `/api`? O `Path` do cookie acompanha o prefixo (`/api/auth`). Uma API sem o
   prefixo (versão antiga) cria o cookie em `/auth`, e o navegador não o envia para
   `/api/auth/refresh`.
3. `AUTH_COOKIE_SECURE` está `true` e o acesso é por HTTPS?
4. `npm run check:deployment` mostra qual desses falhou.

## Documentação

**O material de trabalho não é versionado.** `docs/` e as notas de arquitetura ficam só no disco
de quem desenvolve: são insumo para construir a interface, não parte do que se publica. O
`.gitignore` ignora todo `.md` fora deste README, mais `docs/mockups/` e `docs/v0-reference/`;
nada disso vai para o pacote publicado.

O contrato da API também não vive aqui: ele pertence ao repositório do backend
(`craft-stock-api/docs/`), igualmente fora do GitHub, e é lido de lá. Contrato copiado envelhece
em silêncio — já aconteceu uma vez, com a cópia que descrevia o refresh token no corpo da
resposta depois de o backend tê-lo movido para cookie.

Quem for mexer no projeto encontra, no disco: `docs/README.md` (onde estão os três contratos do
backend), `docs/api-reference.md` (o recorte do contrato que este frontend consome),
`docs/divergencias.md` (mockup contra API, nas quatro listas) e as pastas `docs/mockups/` e
`docs/v0-reference/`.
