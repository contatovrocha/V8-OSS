# Launch OS

Plataforma de gestão de lançamentos para experts: escada de evolução V1–V8, posicionamento, projetos, páginas, tráfego pago (Meta Ads), financeiro, tarefas, relatórios e seções dinâmicas.

**Stack:** React 19 + TypeScript + Tailwind CSS 4 + Vite · Supabase (Auth, Postgres com RLS, Storage, Realtime, Edge Functions) · Recharts.

---

## Rodar localmente (modo demonstrativo, sem servidor)

```bash
npm install
npm run dev        # http://localhost:5173
```

Sem as variáveis do Supabase, o app roda em **modo local**: os dados ficam no `localStorage` do navegador, com as mesmas regras de permissão emuladas (ver `src/data/local/policies.ts`). A interface mostra o selo "Modo local".

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@launchos.demo` | `admin123` |
| Expert (Rafael Martins) | `rafael@launchos.demo` | `expert123` |
| Expert (Camila Duarte, para testar isolamento) | `camila@launchos.demo` | `expert123` |

Todos os dados de exemplo são fictícios e identificados como **Exemplo / Dados demonstrativos**. Em *Configurações → Demonstração* o administrador restaura o estado inicial sem afetar registros reais.

## Produção com Supabase

1. Crie um projeto no Supabase e aplique as migrações, em ordem:
   ```bash
   supabase link --project-ref <ref>
   supabase db push            # aplica supabase/migrations/0001..0004
   ```
2. Configure o frontend (`.env`, ver `.env.example`):
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
3. Publique as Edge Functions:
   ```bash
   supabase functions deploy admin-create-user
   supabase functions deploy meta-sync
   supabase functions deploy meta-oauth --no-verify-jwt   # o retorno do OAuth não traz JWT
   ```
4. **Primeiro acesso:** o primeiro usuário cadastrado no Supabase Auth vira administrador automaticamente (trigger `handle_new_user`). Os demais usuários são criados pelo admin em *Configurações → Experts e usuários*.
5. Carregue os dados demonstrativos em *Configurações → Demonstração → Restaurar dados iniciais* (opcional).

### Integração Meta Ads (Marketing API)

1. No [Meta for Developers](https://developers.facebook.com/), crie um app do tipo *Business* com o produto **Marketing API** e permissão `ads_read`.
2. Em *Facebook Login → Configurações*, adicione como URI de redirecionamento válida a URL da função: `https://<ref>.supabase.co/functions/v1/meta-oauth`.
3. Defina os segredos das funções:
   ```bash
   supabase secrets set META_APP_ID=... META_APP_SECRET=... \
     META_REDIRECT_URI=https://<ref>.supabase.co/functions/v1/meta-oauth \
     APP_ORIGIN=https://seu-dominio.com
   ```
4. No app: *Configurações → Integrações → Conectar conta Meta*. Depois vincule a conta ao projeto (edição do projeto) e clique em **Sincronizar**.

A conta só aparece como **Conectada** depois de uma autorização válida **e** uma sincronização bem-sucedida. Sem credenciais, o módulo de tráfego fica em modo demonstrativo e informa o que falta configurar — nenhuma conexão é simulada.

Os tokens de acesso ficam no schema `private` (sem acesso por `anon`/`authenticated`) e só são lidos pelas Edge Functions com a service role. Nunca chegam ao navegador.

## Arquitetura

```
src/
  app/            contexto global (período, expert/projeto selecionado, marca), navegação, rótulos
  auth/           login e sessão
  components/     UI reutilizável (primitivos, modais, tabela, inputs, gauges, escada V1–V8)
  data/
    backend.ts    contrato único de dados
    local/        backend demonstrativo (localStorage) + emulação das políticas RLS
    supabase/     backend de produção
    seed.ts       dados demonstrativos (IDs estáveis) e configuração base
    store.ts      cache reativo + atualização em tempo real
  lib/            regras de negócio puras: fases, métricas, financeiro, seções, formatação pt-BR
  modules/        uma pasta por módulo (overview, positioning, projects, pages, traffic, finance, tasks, reports, settings, sections, phases)
supabase/
  migrations/     schema, RLS, triggers/RPCs, funções de integração
  functions/      admin-create-user, meta-oauth, meta-sync
  tests/          validação das migrações em Postgres puro
```

### Regras de cálculo (iguais em todos os módulos)

- **Progresso da escada** = fases concluídas ÷ 8 × 100. O status de cada fase é armazenado individualmente; concluir uma fase posterior **não** conclui as anteriores (fica registrado como exceção administrativa). Regra de transição configurável: iniciar a próxima fase automaticamente ou aguardar o administrador.
- **Tráfego:** somente métricas no nível de anúncio, por dia (`ad_metrics_daily`). Totais de campanha/conjunto são derivados dessa soma — nunca somados de forma independente. CTR = cliques no link ÷ impressões × 100 · CPC = investimento ÷ cliques no link · CPL = investimento ÷ leads · Custo por compra = investimento ÷ compras · ROAS = receita atribuída ÷ investimento. Denominador zero → "—".
- **Financeiro:** resultado = receita líquida (bruto − descontos − taxas − reembolsos) − investimento em tráfego − outras despesas. Investimento em tráfego = gasto sincronizado + despesas manuais de tráfego **não** vinculadas a uma conta sincronizada (as vinculadas são apenas conciliadas, sem dupla contagem).
- **Produto mais vendido:** por quantidade de vendas aprovadas (configurável para faturamento).

### Seções dinâmicas

*Configurações → Construtor de Seções* cria seções com nome, ícone, posição no menu, perfis, vínculo com projeto/expert e campos tipados (15 tipos). As telas de listagem (cards/tabela), filtros, cadastro, edição, visualização e exclusão são geradas a partir da configuração, persistida em `section_configs`. Os registros (`section_records.data`) são validados no cliente e no servidor (trigger `validate_section_record`). Alterar a configuração não apaga dados existentes.

## Testes

```bash
npm test                      # regras de negócio (vitest)
npm run dev & npm run e2e     # 14 cenários de aceitação no navegador (Playwright, modo local)
PGHOST=... PGPORT=... PGUSER=postgres ./supabase/tests/run.sh   # migrações + RLS + RPCs em Postgres
```

O E2E usa o Chromium em `/opt/pw-browsers/chromium` por padrão; defina `CHROME_PATH` para outro executável.

## Personalização

Nome da plataforma, nome da operação, logo, cores (principal, sucesso, fases, alertas), fuso horário, módulos ativos e regras de transição ficam em *Configurações → Geral e marca* (tabela `app_settings`) — sem rebuild. O menu pode ficar na lateral (recolhível) ou no topo.
