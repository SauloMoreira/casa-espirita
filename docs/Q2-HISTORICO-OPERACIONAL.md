# Histórico Operacional — Frentes Q2 (Tratamentos FER)

> Documento de fechamento formal das frentes funcionais do ciclo Q2.
> Não reabrir frentes marcadas como **encerradas**.

---

## Ciclo Q2-A — IA na Entrevista Fraterna
- **Status:** ✅ Encerrado formalmente
- **Escopo:** Diagnóstico e ajustes na frente inicial da IA na entrevista fraterna.
- **Decisão:** Encerrado conforme aprovação do responsável.

---

## Ciclo Q2-B — Qualidade Operacional da Agenda e Presença
- **Status:** ✅ Encerrado formalmente
- **Escopo:** Diagnóstico de qualidade operacional da agenda, presença, falta, conclusão, carga e relatórios.
- **Entregas aprovadas:**
  - **Q2-B1** — Correção da carga operacional e saneamento pontual de agenda residual (carga do tarefeiro contemplando modelo legado + novo modelo com deduplicação; saneamento de sessão residual).
- **Conclusão:** Fluxo operacional consistente após Q2-B1, sem risco crítico, alto ou médio remanescente.
- **Decisão:** Encerrado conforme aprovação do responsável.

---

## Ciclo Q2-C — Comunicação, Avisos e Notificações Operacionais
- **Status:** ✅ Encerrado formalmente (Q2-C1 → Q2-C2 → Q2-C3-A → Q2-C3-B → Q2-C4)
- **Escopo:** Saneamento, diagnóstico, correção estrutural, encerramento auditado e validação final da fila de notificações.

### Q2-C1 — Saneamento pontual e auditado da fila (erro de cadastro)
- **Status:** ✅ Concluído e aprovado
- **Recorte executado:**
  - 19 itens `sem_telefone` em `falha` foram encerrados como `cancelado` / `erro='erro_cadastro'` via RPC `fn_encerrar_item_fila_erro_cadastro`, em lote idempotente.
- **Auditoria:** 19 registros `encerrar_item_fila_erro_cadastro` gerados em `audit_logs`.
- **Idempotência:** Predicado filtra `status='falha'` + motivo de cadastro; reexecução seleciona 0 itens — provado em teste.
- **Garantias preservadas:**
  - Sem bloqueio de assistido.
  - Sem alteração de opt-out, consentimento ou preferências.
  - Sem reenvio (`sent_at` permanece nulo).
  - Sem alteração de schema, tabelas, RLS, policies, grants, edge functions, dispatchers, provider ou templates.
- **Testes:**
  - `src/test/integration/db/q2c1-saneamento-fila-erro-cadastro.dbtest.ts` — 7 testes verdes.
  - Suíte relacionada (notificações, fila, elegibilidade, avisos, consentimento) — 169 testes verdes.
  - `tsgo` limpo, exit 0.
- **Indicadores preservados:** `0028 = 0`, `0025 = 0`, `0029 = 56` inalterados.
- **Arquivos alterados:**
  - `src/test/integration/db/q2c1-saneamento-fila-erro-cadastro.dbtest.ts`
  - `supabase/migrations/20260707011829_a550ff12-115f-44ce-8443-fe656d417467.sql`

### Q2-C2 — Diagnóstico controlado da falha `template_indisponivel`
- **Status:** ✅ Concluído e aprovado
- **Recorte executado:** Diagnóstico exclusivo, sem alteração produtiva no item da fila.
- **Item afetado:** 1 item em `notificacoes_fila` (`status='falha'`, `erro='template_indisponivel'`, `template_codigo='tratamento_ausencia_remarcada'`).
- **Diagnóstico conclusivo:** A causa da falha é a ausência da chave de template `tratamento_ausencia_remarcada` no catálogo `notificacoes_templates`. O fluxo de falta tenta carregar o template via `fn_get_template_para_evento`, que falha porque a chave não existe no catálogo. O item é então enfileirado com `erro='template_indisponivel'`.
- **Invariantes preservadas:**
  - Item permaneceu intocado (`status='falha'`, `sent_at=NULL`, `retry_count=0`).
  - Sem reenvio, sem alteração de `external_message_id`, sem alteração de `updated_at`.
  - Sem nova RPC, migration, template, dispatcher ou provider.
- **Testes:**
  - `src/test/integration/db/q2c2-template-indisponivel.dbtest.ts` — 4 testes verdes.
  - `tsgo` limpo, exit 0.
- **Indicadores preservados:** `0028 = 0`, `0025 = 0`, `0029 = 56` inalterados.

### Q2-C3-A — Correção do catálogo de templates
- **Status:** ✅ Concluído e aprovado
- **Recorte executado:** Correção estrutural do catálogo, sem tocar no item remanescente da fila.
- **Migração idempotente:** Criadas no catálogo `notificacoes_templates` as chaves ausentes:
  - `tratamento_ausencia_remarcada` (ativo, canal `whatsapp`, evento `falta_registrada`)
  - `tratamento_suspenso` (ativo, canal `whatsapp`, evento `falta_registrada`)
- **Validação de payload:** Confirmada compatibilidade entre placeholders dos templates (`nome`, `tratamento`, `nova_data`) e os payloads reais dos fluxos de falta.
- **Idempotência:** `ON CONFLICT (codigo_template) DO NOTHING`.
- **Item remanescente:** Intocado (`status='falha'`, `sent_at=NULL`, `retry_count=0`).
- **Testes:**
  - `src/test/integration/db/q2c3a-catalogo-templates-integridade.dbtest.ts` — 5 testes verdes.
  - Q2-C2 ajustado e verde — 4 testes.
  - Total Q2-C1/C2/C3-A: 16 testes verdes.
  - `tsgo` limpo, exit 0.
- **Indicadores preservados:** `0028 = 0`, `0025 = 0`, `0029 = 56` inalterados.
- **Arquivos alterados:**
  - `src/test/integration/db/q2c3a-catalogo-templates-integridade.dbtest.ts`
  - `supabase/migrations/20260707120508_f129d58d-7f4d-43b6-b1d0-be90e79eeaa0.sql`
  - `src/test/integration/db/q2c2-template-indisponivel.dbtest.ts` (ajustado)

### Q2-C3-B — Encerramento auditado do item remanescente obsoleto
- **Status:** ✅ Concluído e aprovado
- **Recorte executado:** Encerramento do item remanescente por obsolescência operacional, após correção estrutural validada.
- **Nova RPC:** `fn_encerrar_item_fila_obsoleto` (SECURITY DEFINER, restrita a admin).
- **Predicados de segurança:** `status='falha'`, `erro='template_indisponivel'`, `template_codigo='tratamento_ausencia_remarcada'`, `nova_data` vencida.
- **Item atualizado:** `status='cancelado'`, `erro='item_obsoleto'`.
- **Invariantes preservadas:**
  - `sent_at` e `external_message_id` permanecem `NULL`.
  - `retry_count` permanece `0`.
  - Sem reenvio, sem dispatcher, sem provider.
- **Auditoria:** 1 registro `encerrar_item_fila_obsoleto` em `audit_logs` com dados anteriores e novos.
- **Idempotência:** Rejeita reexecução em itens já cancelados; após execução, 0 itens elegíveis.
- **Testes:**
  - `src/test/integration/db/q2c3b-encerramento-item-obsoleto.dbtest.ts` — 11 testes verdes.
  - Total Q2-C1/C2/C3-A/C3-B: 27 testes verdes.
  - `tsgo` limpo, exit 0.
- **Indicadores:** `0028 = 0`, `0025 = 0`, `0029 = 57` (incremento justificado pela RPC administrativa auditada).
- **Arquivos alterados:**
  - `src/test/integration/db/q2c3b-encerramento-item-obsoleto.dbtest.ts`
  - `supabase/migrations/20260707124617_5bc81d19-801d-4304-b20e-ddb4a7120819.sql`

### Q2-C4 — Validação final da fila
- **Status:** ✅ Concluído e aprovado
- **Recorte executado:** Leitura de dados, validação e execução de testes — sem alteração produtiva.
- **Estado da fila:**
  - Total: 529 itens (canal único `whatsapp`).
  - `agendado`: 15 | `enviado`: 53 | `cancelado`: 461 | `falha`: **0**.
- **Distribuição `cancelado`:**
  - `sessao_substituida`: 268
  - `sessao_futura_nao_proxima`: 132
  - `sessao_inexistente`: 31
  - `erro_cadastro`: 19 (Q2-C1)
  - `agendamento_antecipado_indevido`: 5
  - `sessao_cancelada`: 2
  - `entrevista_vencida`: 2
  - `lembrete_vencido`: 1
  - `item_obsoleto`: 1 (Q2-C3-B)
- **Contadores confirmados:**
  - `erro='template_indisponivel'`: 0
  - `erro='erro_cadastro'`: 19
  - `erro='item_obsoleto'`: 1
  - Elegíveis a saneamento cadastral: 0
  - Elegíveis a encerramento por obsolescência: 0
- **Auditoria validada:**
  - 19 registros `encerrar_item_fila_erro_cadastro` (19 IDs distintos, dados anteriores/novos).
  - 1 registro `encerrar_item_fila_obsoleto` (1 ID, dados anteriores/novos).
  - Sem duplicidade indevida.
- **Testes:**
  - DB Q2-C1/C2/C3-A/C3-B: 27 testes verdes.
  - Notificações + fila + aviso-ausência + status: 58 testes verdes.
  - `tsgo` limpo, exit 0.
- **Indicadores finais:** `0028 = 0`, `0025 = 0`, `0029 = 57`.

---

## Regras de não reabertura
As frentes e subitens abaixo estão formalmente encerrados e não devem ser reabertos:
- S1, P1, Correção complementar pós-P1
- Q1-A1, Q1-A2, Q1-B, Q1-C1..Q1-C7
- Ciclo Q1-C formalmente encerrado
- Ciclo Q2-A formalmente encerrado
- Ciclo Q2-B formalmente encerrado
- Ciclo Q2-C formalmente encerrado (diagnóstico + Q2-C1)
