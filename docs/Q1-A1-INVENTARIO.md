# Q1-A1 — Inventário e detecção de roles/enums (somente leitura)

> **Sem alteração de runtime.** Nenhuma guarda da S1/P1, RLS, permissão ou
> `SECURITY DEFINER` foi tocada nesta etapa. Apenas auditoria.
> Nomes técnicos preservados exatamente como existem no banco/código.

## 1. Enums/roles críticos reais

### 1.1 Enum de banco `app_role` (fonte de verdade)
Valores reais (consulta direta a `pg_enum`), nesta ordem:
`admin`, `entrevistador`, `tarefeiro`, `assistido`, `coordenador_de_tratamento`,
`administrador_master`.

### 1.2 Enum de banco `notif_evento` (fonte de verdade)
16 valores reais: `entrevista_criada`, `entrevista_lembrete`, `sessao_criada`,
`sessao_lembrete`, `remarcacao`, `cancelamento`, `presenca_registrada`,
`falta_registrada`, `sessao_cancelada_por_excecao`, `sessao_remarcada_por_excecao`,
`entrevista_cancelada_por_excecao`, `entrevista_remarcada_por_excecao`,
`publico_cancelado_por_excecao`, `publico_remarcado_por_excecao`, `mensagem_manual`,
`aviso_ausencia_recebido`.

## 2. Arquivos TS que espelham esses contratos

| Contrato | Espelho TS | Papel |
|---|---|---|
| `app_role` | `src/contexts/AuthContext.tsx` (`type AppRole`) | declaração do union (raiz) |
| `app_role` | `src/constants/roles.ts` (`APP_ROLES`, grupos, labels) | fonte única de grupos/labels |
| `notif_evento` (parcial) | `src/lib/notificacaoElegibilidade.ts` (`DiagnosticoCodigo`) | eventos/diagnóstico usados na UI |
| status presença | `src/lib/presencaClassificacao.ts` (`STATUS_PRESENCA`) → reexport em `src/constants/status.ts` | fonte única + espelho de `fn_presenca_classificacao` |
| status entrevista/vínculo/etc. | `src/constants/status.ts` | fonte única TS |

**Observação de paridade:** `AppRole` (union, 6) e `APP_ROLES` (tupla, 6)
conferem com `app_role` do banco hoje, **mas não há teste automático** que
falhe se o banco evoluir. Lacuna real para o Q1-A2/B.

## 3. Ocorrências de strings soltas (role literal)

Varredura em `src/**/*.ts(x)`, excluindo `src/constants/roles.ts`,
`src/integrations/supabase/types.ts`, `**/*.test.ts` e `src/test/**`:
**211 ocorrências**. Distribuição por arquivo:

| Arquivo | Ocorrências | Natureza |
|---|---|---|
| `src/components/AppSidebar.tsx` | 80 | arrays de visibilidade de menu por papel |
| `src/App.tsx` | 69 | `allowedRoles` em route guards |
| `src/lib/help/helpContent.ts` | 46 | tags/visibilidade de conteúdo de ajuda |
| `src/contexts/AuthContext.tsx` | 15 | declaração do union + colapso master→admin |
| `src/pages/GovernancaAcessos.tsx` | 14 | seleção de papéis + `.eq("role", ...)` |
| `src/hooks/useHelp.ts` | 8 | mapeamento de onboarding por papel |
| `src/pages/Relatorios.tsx` | 7 | filtros de visão por papel |
| `src/lib/signupRequest.ts` | 7 | fluxo de cadastro |
| `src/services/notificacoes/notificacoesService.ts` | 6 | guard de leitura |
| `src/pages/Usuarios.tsx` | 5 | papel base `assistido` |
| `src/pages/Dashboard.tsx` | 5 | troca de dashboard por papel |
| `src/components/ProtectedRoute.tsx` | 5 | guard de rota |
| demais (≤3 cada) | ~14 arquivos | filtros pontuais / `.eq("role", ...)` |

Status operacionais (presença/entrevista/vínculo) **não** apresentaram literais
soltos fora de `src/constants/**` e `src/lib/**` — já estão bem centralizados.

## 4. Classificação dos achados

### 4.1 Falso positivo (não corrigir)
- `src/contexts/AuthContext.tsx` — **declaração** do union `AppRole`; é a raiz do
  contrato, não um espelho duplicado.
- `src/lib/help/helpContent.ts`, `src/hooks/useHelp.ts`, `src/lib/help/types.ts`,
  `src/lib/help/helpVisibility.ts` — conteúdo/visibilidade de ajuda (dados de
  configuração, não decisão de segurança).
- Comentários, labels de UI e textos.

### 4.2 Aceitável por arquitetura (manter, registrar em allowlist)
- `src/App.tsx` (`allowedRoles`) e `src/components/AppSidebar.tsx` — listas de
  papéis para roteamento/menu. São **consumidores** do contrato; poderiam usar
  grupos de `roles.ts`, mas hoje não causam drift de segurança porque os guards
  efetivos ficam no backend (RLS/SECURITY DEFINER). Refator opcional (cosmético).
- `.eq("role", "...")` em consultas de contagem/listagem
  (`GovernancaAcessos.tsx`, `Tratamentos.tsx`) — filtro de dados, não decisão de
  autorização. Aceitável; idealmente usar constante de `roles.ts`.

### 4.3 Precisa correção (Q1-A2, baixo risco)
- Substituir literais de papel por `APP_ROLES`/grupos (`STAFF_ROLES`,
  `OPERATIONAL_ROLES`, etc.) onde já existe constante equivalente — começando por
  `ProtectedRoute.tsx`, `Dashboard.tsx`, `Relatorios.tsx`,
  `notificacoesService.ts`. Mudança de legibilidade/consistência, **sem alterar
  comportamento**.

### 4.4 Crítico
- **Nenhum drift crítico ativo encontrado.** O risco crítico real é a **ausência
  de teste de paridade `app_role`/`notif_evento` DB×TS** — não um valor errado
  hoje, mas a falta de trava contra regressão futura.

## 5. Proposta de allowlist (para testes futuros)

A varredura bloqueante de role literal (Q1-A2) deve **ignorar**:
- `src/contexts/AuthContext.tsx` (declaração do union)
- `src/constants/roles.ts` (fonte única)
- `src/integrations/supabase/types.ts` (gerado)
- `src/lib/help/**` (configuração de conteúdo de ajuda)
- `**/*.test.ts`, `src/test/**` (testes/mocks)
- linhas de comentário e strings de label de UI
- chamadas `.eq("role", ...)` (filtro de dados) — allowlist por padrão de linha

E **sinalizar** (não bloquear inicialmente): `src/App.tsx`, `src/components/AppSidebar.tsx`.

## 6. Proposta de testes futuros (não implementados aqui)

- **Puro (CI, `src/test/governanca`):** varredura de role literal com allowlist
  acima; verificação de que `APP_ROLES`/grupos cobrem todos os papéis usados em
  guards; comparação contra `types.ts` quando não exigir banco vivo.
- **Integração real (`src/test/integration/db`, `npm run test:db`):** paridade
  `app_role` DB×`APP_ROLES`; paridade `notif_evento` DB×espelho;
  paridade de check constraints de status DB×constantes.

## 7. Confirmação de não regressão de segurança

Esta etapa foi **somente leitura**. Nenhuma guarda da S1/P1, política RLS,
permissão de papel ou função `SECURITY DEFINER` foi alterada. `0028`=0, `0025`=0,
`0029`=56 permanecem inalterados.
