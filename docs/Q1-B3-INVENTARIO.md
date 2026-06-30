# Q1-B3 — Status operacionais remanescentes (desenho operacional / inventário)

> **Frente:** qualidade técnica / contratos canônicos.
> **Status:** 🟡 desenho operacional — **SEM implementação corretiva**, **SEM
> alteração de runtime**.
> **Diretrizes invioláveis (mantidas):** não alterar RLS, grants/revokes,
> `SECURITY DEFINER`, nem guardas de RPC já endurecidas (S1/P1/Q1-A2/Q1-B2).
> Documento somente de leitura/auditoria — nenhum identificador técnico foi
> traduzido.

---

## 0. Resumo executivo

Inventário dos **5 contratos remanescentes** do Q1-B (os críticos `entrevista` e
`vínculo` já foram corrigidos em Q1-B2). Objetivo: avaliar paridade entre banco
(fonte da verdade) e espelhos no frontend, sem tocar lógica.

| Contrato | Valores no banco | Espelho TS hoje | Classificação |
|---|---|---|---|
| `notif_status` (enum) | 5 | ausente (sem espelho tipado) | ⚠️ precisa correção |
| `notif_evento` (enum) | 16 | parcial (subconjuntos espalhados) | ⚠️ precisa correção |
| `notif_canal` (enum) | 1 | ausente | 🟢 aceitável (registrar p/ futuro) |
| diagnóstico de fila (`fn_fila_diagnostico_pendentes`) | 8 classes | `DiagnosticoPendencia` (união) | 🟢 aceitável (falta paridade real) |
| `avisos_ausencia.status` (CHECK) | 4 | tipado (`StatusAviso`) | 🟢 aceitável (falta paridade real) |

Nenhuma correção foi aplicada. Tudo abaixo é proposta para a fase de
implementação (Q1-B3-impl), sem schema change e sem tocar segurança.

---

## 1. Inventário nominal (fonte da verdade no banco)

### 1.1 `notif_status` — enum
- **Valores reais (`pg_enum`):** `pendente, agendado, enviado, falha, cancelado`.
- **Onde é usado no banco:** coluna `notificacoes_fila.status`; lido por
  `fn_fila_diagnostico_pendentes` (`status IN ('pendente','agendado')`),
  dispatch e saneamento.
- **Espelho frontend:** **não há** constante/união canônica do conjunto completo.
  Existem literais isolados:
  - `src/lib/notificacaoElegibilidade.ts` → `STATUS_ATIVOS_FILA =
    ["pendente","agendado","falha"]` (subconjunto operacional, intencional).
  - Strings soltas `"enviado"`/`"pendente"` em consumidores da Central.
- **Classificação:** ⚠️ **precisa correção** — falta união canônica única
  (`NOTIF_STATUS`) espelhando os 5 valores; risco de string solta nova.

### 1.2 `notif_evento` — enum
- **Valores reais (16, `pg_enum`):** `entrevista_criada, entrevista_lembrete,
  sessao_criada, sessao_lembrete, remarcacao, cancelamento, presenca_registrada,
  falta_registrada, sessao_cancelada_por_excecao, sessao_remarcada_por_excecao,
  entrevista_cancelada_por_excecao, entrevista_remarcada_por_excecao,
  publico_cancelado_por_excecao, publico_remarcado_por_excecao, mensagem_manual,
  aviso_ausencia_recebido`.
- **Onde é usado no banco:** coluna `notificacoes_fila.evento_origem`; triggers
  de geração (`fn_notif_*`), `fn_excecao_alvos`, dispatch.
- **Espelho frontend (parcial, por finalidade — não há conjunto único):**
  - `EVENTOS_OPERACIONAIS` (9) em `src/lib/comunicacaoCanal.ts` (+ espelho Deno
    em `supabase/functions/_shared/comunicacaoCanal.ts`).
  - `EVENTOS_SESSAO` (2) e `EVENTOS_ENTREVISTA` (2) e `EVENTOS_EXCECAO` (6) e
    `EVENTO_MENSAGEM_MANUAL` em `src/lib/notificacaoElegibilidade.ts`.
  - **Sem espelho:** `aviso_ausencia_recebido` não aparece em nenhum subconjunto
    TS (apenas em `types.ts` gerado).
- **Classificação:** ⚠️ **precisa correção** — os subconjuntos por finalidade são
  legítimos (não devem virar um único enum gigante de uso), MAS falta um
  **conjunto de referência canônico completo** (`NOTIF_EVENTO`) usado só para
  travar paridade contra `pg_enum` e detectar evento novo no banco sem espelho
  (como `aviso_ausencia_recebido`).

### 1.3 `notif_canal` — enum
- **Valor real:** `whatsapp` (único).
- **Onde é usado no banco:** coluna de canal da fila/log.
- **Espelho frontend:** literal `"whatsapp"` espalhado; sem constante única.
- **Classificação:** 🟢 **aceitável** — enum de 1 valor, baixo risco. Proposta:
  registrar `NOTIF_CANAL` + teste de paridade leve (detecta quando um 2º canal
  for adicionado ao banco).

### 1.4 Diagnóstico de pendência — `fn_fila_diagnostico_pendentes()`
- **Fonte da verdade (SECURITY DEFINER — NÃO alterar):** retorna `motivo` ∈
  `agendado_futuro`, `bloqueado_inelegivel:<motivo>`, `opt_out`,
  `comunicacao_geral_desativada`, `sem_telefone`, `aguardando_janela`,
  `aguardando_limite_diario`, `pendente`.
- **Espelho frontend:** **já existe** — `DiagnosticoPendencia` (união) +
  `DIAGNOSTICO_BASE`/`rotuloDiagnosticoPendencia` em
  `src/lib/notificacaoElegibilidade.ts` (L-02), com contrato testado em
  `src/test/governanca/contratos-central.test.ts`.
- **Classificação:** 🟢 **aceitável por arquitetura** — espelho documentado e já
  travado por teste de tom/rótulo. **Falta apenas** paridade de conjunto contra
  as classes reais emitidas pela função (teste de integração somente-leitura,
  sem alterar a função).

### 1.5 Aviso de ausência — `avisos_ausencia.status`
- **Fonte da verdade:** CHECK `avisos_ausencia_status_check`
  → `aberto, em_tratamento, resolvido, descartado`.
- **Espelho frontend:** **já tipado** — `StatusAviso` (= `aberto|em_tratamento|
  resolvido|descartado`) + `STATUS_TRATAMENTO` + `STATUS_AVISO_LABELS` em
  `src/services/avisos/avisosAusenciaService.ts`; consumido por
  `src/pages/AvisosAusencia.tsx` (`STATUS_VARIANT`, transições de `tratar`).
- **Classificação:** 🟢 **aceitável por arquitetura** — contrato tipado e
  centralizado (o inventário Q1-B o marcou como "string solta" antes de
  localizar o type no service; reclassificado aqui). **Falta apenas** paridade
  de integração contra o CHECK real.

---

## 2. Strings soltas encontradas (resumo)

- `"pendente"`, `"agendado"`, `"enviado"`, `"falha"` (notif_status) aparecem como
  literais pontuais em consumidores da Central e em `STATUS_ATIVOS_FILA`
  (subconjunto intencional). Sem união canônica única.
- `"whatsapp"` (notif_canal) como literal — baixo risco.
- `aviso_ausencia_recebido` (notif_evento) **sem nenhum espelho TS** — único
  evento do enum não modelado em subconjunto de finalidade.
- `avisos_ausencia.status` e diagnóstico de fila já estão tipados (sem string
  solta de contrato).

---

## 3. Classificação consolidada

- **Falso positivo:** nenhum identificado nesta rodada.
- **Aceitável por arquitetura:** 1.3 (`notif_canal`), 1.4 (diagnóstico de fila),
  1.5 (`avisos_ausencia.status`) — fontes canônicas já existem; só falta paridade
  de teste real.
- **Precisa correção:** 1.1 (`notif_status` sem união canônica), 1.2
  (`notif_evento` sem conjunto de referência completo; `aviso_ausencia_recebido`
  sem espelho).
- **Crítico:** nenhum (os críticos foram fechados em Q1-B2).

---

## 4. Proposta de fonte canônica (para a fase de implementação)

Centralizar contratos read-only espelhando o banco, **sem schema change**:

```text
NOTIF_STATUS    pendente|agendado|enviado|falha|cancelado          (novo)
NOTIF_EVENTO    16 valores do enum notif_evento (conjunto de referência) (novo)
NOTIF_CANAL     whatsapp                                            (novo, leve)
FILA_DIAGNOSTICO_MOTIVO  (já modelado como DiagnosticoPendencia — manter)
AVISO_AUSENCIA_STATUS    (já modelado como StatusAviso — manter)
```

- `NOTIF_*` em local único (ex.: estender `src/constants/status.ts` ou novo
  `src/constants/notificacoes.ts`), como `as const` + união derivada.
- Subconjuntos de finalidade (`EVENTOS_OPERACIONAIS`, `EVENTOS_SESSAO`, etc.)
  **permanecem** e passam a ser validados como ⊂ `NOTIF_EVENTO`.
- Itens **fora da allowlist por design** (governança no frontend, sem CHECK):
  `voluntarios.status`, `voluntarios.termo_status` (fora do escopo Q1-B3).

---

## 5. Proposta de correção segura (sem runtime change)

1. Criar as constantes/uniões `NOTIF_STATUS`, `NOTIF_EVENTO`, `NOTIF_CANAL`
   (apenas tipos/constantes — nenhuma chamada de runtime muda).
2. Refatorar literais de contrato para as constantes onde for seguro e óbvio
   (consumidores da Central), mantendo subconjuntos de finalidade intactos.
3. Adicionar `aviso_ausencia_recebido` ao conjunto de referência `NOTIF_EVENTO`
   (espelho) — sem criar comportamento novo.
4. Não tocar `fn_fila_diagnostico_pendentes`, RLS, grants/revokes nem
   `SECURITY DEFINER`.

---

## 6. Testes necessários

- **Puros (CI, `src/test/governanca`):**
  - paridade `NOTIF_STATUS`/`NOTIF_EVENTO`/`NOTIF_CANAL` × allowlist documentada;
  - subconjuntos de finalidade ⊂ `NOTIF_EVENTO` (trava de regressão);
  - estabilidade de `DiagnosticoPendencia` e `StatusAviso`.
- **Integração real (`npm run test:db`, `src/test/integration/db`):**
  - paridade `pg_enum` de `notif_status`, `notif_evento`, `notif_canal`
    (estender/complementar `q1a2-enums-paridade.dbtest.ts`);
  - paridade CHECK de `avisos_ausencia.status` via `pg_get_constraintdef`;
  - paridade de conjunto das classes de `fn_fila_diagnostico_pendentes`
    (somente leitura — função não alterada).

---

## 7. Riscos de regressão

- **Baixo:** introduzir constantes pode colidir com literais existentes se
  refator for amplo demais — mitigar limitando o refator a contratos de status
  (não a textos/labels de UI).
- **Baixo:** `notif_evento` é usado em triggers/dispatch no banco; o espelho TS é
  somente leitura/classificação — não há caminho de escrita que dependa do enum
  TS, então não há risco de runtime.
- **Médio se ignorado:** continuar sem `aviso_ausencia_recebido` no espelho deixa
  um evento real do banco invisível a futuros consumidores da Central.

---

## 8. Confirmação de não-alteração (S1 / P1 / Q1-A2 / Q1-B2)

Nesta etapa (somente desenho), **nada** foi alterado:
- RLS — inalterada.
- grants/revokes — inalterados.
- `SECURITY DEFINER` — inalterado (`fn_fila_diagnostico_pendentes` apenas lida).
- guardas de RPC já endurecidas — inalteradas.
- Runtime — sem mudança.
- Métricas de segurança mantidas: **0028=0, 0025=0, 0029=56**.

> Próximo passo só após aprovação: implementação do Q1-B3 conforme allowlist e
> testes acima, sem schema change e sem tocar segurança.
