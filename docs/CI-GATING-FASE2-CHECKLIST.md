# Checklist de Ativação — CI Gating Fase 2

> Documento de **decisão e operação**. Pré-preparado para uso **quando a janela
> observacional da Fase 1 fechar** (ver `docs/CI-GATING.md`, seção 10).
>
> **Estado atual: NÃO ATIVAR.** Este documento não altera nenhum workflow nem o
> comportamento da Fase 1 — é apenas o roteiro auditável para evoluir o gating.
>
> Referências: [`CI-GATING.md`](./CI-GATING.md) · [`BACKLOG-GOVERNANCA.md`](./BACKLOG-GOVERNANCA.md)

---

## 0. O que muda da Fase 1 para a Fase 2 (resumo)

| Aspecto | Fase 1 (atual) | Fase 2 (após esta checklist) |
|---|---|---|
| Único bloqueante | `quality` | `gate-summary` (consolida `quality` + condicionais disparados) |
| `test-db` / `test-e2e-rls` / `test-e2e` | observacionais (`continue-on-error`) | **bloqueantes quando disparados** |
| Required check no branch protection | nenhum novo | `gate-summary` |
| Skip por filtro de path | N/A (não bloqueia) | N/A (não bloqueia) — mantido |
| Skip por erro/cancelamento | warning | **bloqueia** (fail closed) |
| Override `ci-override-aprovado` | warning auditado | warning auditado (regras inalteradas) |

---

## 1. Pré-condições técnicas (obrigatórias)

- [ ] **Segredos `TEST_*` configurados** no repositório:
  `TEST_PGHOST`, `TEST_PGPORT`, `TEST_PGUSER`, `TEST_PGPASSWORD`, `TEST_PGDATABASE`,
  `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_E2E_RLS_PASSWORD`,
  `TEST_SERVICE_ROLE_KEY`.
- [ ] **Segredos validados** — uma execução real confirmou autenticação e conexão
  (sem `::warning::` de segredo ausente nos guards).
- [ ] **Banco de teste dedicado acessível** a partir do runner do CI (não é o de
  produção; isolado; `withRollback`/seed namespaced funcionando).
- [ ] **Jobs pesados realmente executando** — `test-db`, `test-e2e-rls` e `test-e2e`
  rodaram de fato (assertivas executadas), **não** auto-skip por `HAS_DB=false` /
  `HAS_E2E=false`.
- [ ] **Zero side effect operacional confirmado** — nenhum dispatch real
  (WhatsApp/e-mail), nenhuma escrita em filas/tabelas de produção.

## 2. Janela observacional concluída

- [ ] Atingido **10 PRs OU 14 dias corridos, o que vier por último**.
- [ ] **Log da janela** preenchido (`CI-GATING.md`, seção 10.2) com execuções reais.
- [ ] Registro considerado **suficiente e representativo** (jobs executando, não
  apenas skip).
- [ ] **Relatório de estabilidade** emitido (template `CI-GATING.md`, seção 10.3).

## 3. Critérios de estabilidade (limiares de aprovação)

- [ ] **Taxa de falha por job** dentro do aceitável:
  - falhas por **asserção real** = correspondem a bugs reais detectados e corrigidos
    (sinal positivo do gate), **não** a ruído do gate;
  - falhas por **infra** baixas e resolvidas com ≤ 1 retry;
  - falhas por **configuração** = **zero** ao final da janela (segredos OK).
- [ ] **Distinção causa-raiz clara** registrada para cada falha:
  infra × configuração × asserção real.
- [ ] **Ausência de flaky recorrente relevante** — nenhum job falhando de forma
  intermitente sem causa de asserção reproduzível.
- [ ] **Ausência de skip indevido relevante** — nenhum caso em que o filtro de path
  deveria ter disparado um gate e não disparou (falso negativo).
- [ ] **Qualidade aceitável dos filtros de path** — sem falsos disparos crônicos
  (gate pesado rodando em PR irrelevante) nem falsos pulos.
- [ ] **Sem tendência de pipeline frágil** — duração dos pesados estável; sem
  crescimento de cancelamentos/timeouts.

## 4. Ações de ativação (executar só após 1–3 aprovados)

- [ ] No `.github/workflows/ci.yml`, **remover `continue-on-error: true`** dos gates
  aprovados (`test-db`, `test-e2e-rls`, `test-e2e`).
- [ ] No `gate-summary`, **ativar a semântica fail-closed completa** para os
  condicionais: `failure`/`cancelled` bloqueiam; `skipped` por filtro = ok;
  `skipped` por erro = bloqueia. (Hoje só `quality` é dura.)
- [ ] No **branch protection** de `main`: marcar **`gate-summary` como único
  required check** (e nenhum outro, para evitar required frágil).
- [ ] Confirmar **quais jobs passam a bloquear e por quê** (registrar no PR de
  ativação):
  - `quality` — sempre, todo PR (leve, base do build);
  - `test-db` — quando migração/banco/segurança/fila;
  - `test-e2e-rls` — quando segurança/permissão/RLS;
  - `test-e2e` — quando UI crítica de autenticação/rotas protegidas/segurança.
- [ ] Verificar que **`nightly.yml` permanece não bloqueante**.
- [ ] Anunciar mudança ao time (gate passa a bloquear merge).

## 5. Plano de rollback da Fase 2 → Fase 1

- [ ] **Gatilho de rollback:** ruído excessivo do gate — flaky de infra recorrente,
  falsos disparos/pulos de filtro, ou indisponibilidade do banco de teste
  bloqueando merges legítimos de forma sistemática.
- [ ] **Como reverter (rápido):**
  - reintroduzir `continue-on-error: true` nos gates problemáticos **ou**
  - remover `gate-summary` da lista de required no branch protection
    (volta a só `quality` como base);
  - manter o restante observacional até estabilizar.
- [ ] **Quem decide:** mantenedor responsável pela governança de CI (papel
  Administrador/Master ou equivalente acordado), nunca rollback silencioso por
  qualquer contribuidor.
- [ ] **Como registrar:** PR de rollback + nota no `BACKLOG-GOVERNANCA.md`
  (`CI-GATING-#1`) com motivo, jobs afetados, autor e data; manter rastro para a
  nova tentativa de Fase 2.

## 6. Critério formal de pronto / não pronto

A Fase 2 só é ativada quando **todos** os itens abaixo são verdadeiros:

1. Pré-condições técnicas (seção 1) ✅
2. Janela observacional concluída e suficiente (seção 2) ✅
3. Critérios de estabilidade (seção 3) ✅

### Decisão

- [ ] **PRONTO PARA FASE 2** — seções 1, 2 e 3 satisfeitas; executar seção 4.
- [ ] **AINDA NÃO PRONTO** — registrar o(s) item(ns) faltante(s) e a ação corretiva;
  permanecer na Fase 1 (observacional) e reabrir/estender a janela se necessário.

> Decisão registrada por: __________________  Data: __________
> Justificativa: ____________________________________________
EOF_PLACEHOLDER
