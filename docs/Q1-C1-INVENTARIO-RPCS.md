# Q1-C1 — Inventário de RPCs e payloads sensíveis

**Status:** ✅ Diagnóstico (sem implementação corretiva)
**Escopo:** mapear drift entre `supabase.rpc(...)` no frontend, a assinatura real no banco, o `types.ts` gerado, os wrappers/services TS, os payloads enviados e os retornos esperados.
**Pergunta central:** *o frontend está chamando cada RPC exatamente conforme o backend espera?*

> ⚠️ **Nada foi alterado** em runtime, RLS, grants/revokes, `SECURITY DEFINER`, guardas S1/P1, agenda, tratamento, WhatsApp, lógica funcional, schema ou edge functions. Este documento é apenas inventário/desenho.

---

## 1. Visão geral

- **53** chamadas `supabase.rpc(...)` no frontend.
- **43** funções RPC distintas mapeadas e confrontadas com `pg_proc` (assinatura real) e `src/integrations/supabase/types.ts`.
- **Todas as 43** estão presentes no `types.ts` gerado (nenhuma RPC "fantasma").
- **Todas** as RPCs sensíveis confrontadas são `SECURITY DEFINER` com guarda de papel no backend — **nenhum achado de risco de segurança/permissão (Crítico)**.
- Os achados concentram-se em **tipagem/centralização (Baixo)** e **um ponto de arquitetura (Alto por padronização)**: RPCs sensíveis de concessão de acesso chamadas direto na tela.

---

## 2. Inventário nominal (RPC → local → payload → assinatura → retorno)

### 2.1 Governança de acesso / promoção (sensível)

| RPC | Local | Payload FE | Assinatura banco | Retorno FE | Paridade |
|---|---|---|---|---|---|
| `solicitar_promocao_admin` | `pages/GovernancaAcessos.tsx:143` | `p_target_user_id, p_target_role, p_justificativa` | `(p_target_user_id uuid, p_target_role text, p_justificativa text)` → jsonb | `(data as any)?.error / status` | ✅ payload OK / ⚠️ retorno `as any` |
| `decidir_promocao_admin` | `GovernancaAcessos.tsx:164` | `p_request_id, p_decision, p_motivo\|null` | `(p_request_id uuid, p_decision text, p_motivo text DEFAULT NULL)` → jsonb | `(data as any)?.status` | ✅ / ⚠️ `as any` |
| `fn_conceder_acesso_operacional` | `GovernancaAcessos.tsx:192` | `p_target_user_id, p_role, p_motivo\|null` | `(p_target_user_id uuid, p_role app_role, p_motivo text DEFAULT NULL)` → jsonb | `(data as any)?.status` | ✅ / ⚠️ `as any` |
| `fn_revogar_acesso_operacional` | `GovernancaAcessos.tsx:219` | `p_target_user_id, p_role, p_motivo\|null` | idem conceder | `(data as any)` | ✅ / ⚠️ `as any` |

### 2.2 Coordenação (sensível)

| RPC | Local | Payload FE | Assinatura banco | Paridade |
|---|---|---|---|---|
| `fn_designar_coordenador` | `services/coordenacao/escopo.ts:40` | `p_tratamento_id, p_coordenador_id` | `(p_tratamento_id uuid, p_coordenador_id uuid)` → void | ✅ |
| `fn_remover_coordenador` | `escopo.ts:48` | `p_tratamento_id, p_coordenador_id` | idem → void | ✅ |
| `fn_tratamentos_do_coordenador` | `escopo.ts:12` | `_user_id` | `(_user_id uuid DEFAULT auth.uid())` → SETOF uuid | ✅ |
| `fn_listar_coordenacao_tratamentos` | `escopo.ts:34` | — | `()` → jsonb | ✅ |

### 2.3 Presença / agenda / tratamento (escrita sensível)

| RPC | Local | Payload FE | Assinatura banco | Paridade |
|---|---|---|---|---|
| `registrar_presenca` (legado) | `services/agendaPlano/orquestracao.ts:507` | `p_assistido_tratamento_id, p_data, p_status_presenca, p_registrado_por` **`as never`** | `(...,p_observacao text DEFAULT NULL)` → jsonb | ✅ obrigatórios / ⚠️ `as never` |
| `pts_registrar_presenca` | `orquestracao.ts:316` | `p_vinculo_id, p_data, p_registrado_por, p_proxima_*: undefined` **`as never`** | `(...,p_proxima_numero_etapa int, p_proxima_data date, p_proxima_horario time DEFAULT NULL)` → jsonb | ✅ / ⚠️ `as never` + chaves com `undefined` |
| `pts_registrar_ausencia` | `orquestracao.ts:403` | `p_vinculo_id, p_data, p_registrado_por, p_nova_*: undefined` **`as never`** | `(...,p_nova_data date, p_nova_horario time DEFAULT NULL)` → jsonb | ✅ / ⚠️ `as never` |
| `pts_persistir_plano` | `orquestracao.ts:227` | `p_vinculo_id, p_etapas (jsonb) **as never**, p_sessao_ativa (jsonb) **as never**` | `(p_vinculo_id uuid, p_etapas jsonb, p_sessao_ativa jsonb DEFAULT NULL)` → jsonb | ✅ / ⚠️ `as never` em jsonb |
| `pts_converter_assistido` | `orquestracao.ts:187` | `p_assistido_id, p_planos (jsonb) **as never**` | `(p_assistido_id uuid, p_planos jsonb)` → jsonb | ✅ / ⚠️ `as never` |
| `pts_rollback_piloto` | `orquestracao.ts:204` | `p_assistido_id` | `(p_assistido_id uuid)` → jsonb | ✅ |
| `pts_homologacao_auditar` | `orquestracao.ts:660,741` | nome **`as never`** + `p_assistido_id, p_acao, p_resultado` **`as never`** | `(p_assistido_id uuid, p_acao text, p_resultado jsonb DEFAULT '{}')` → jsonb | ✅ / ⚠️ cast de nome desnecessário (já está em `types.ts`) |
| `migrar_assistido_legado_tratamento` | `services/assistidos/migracaoLegado.ts:262,357` | `p_assistido_id, p_tratamentos (jsonb) **as never**` | `(p_assistido_id uuid, p_tratamentos jsonb)` → jsonb | ✅ / ⚠️ `as never` |
| `registrar_auditoria_reconciliacao` | `migracaoLegado.ts:644` | `p_assistido_id, p_dados` | `(p_assistido_id uuid, p_dados jsonb)` → uuid | ✅ |

### 2.4 Entrevista fraterna (sensível — sigilo)

| RPC | Local | Payload FE | Assinatura banco | Paridade |
|---|---|---|---|---|
| `agendar_entrevista_fraterna` | `pages/Entrevistas.tsx:174` | `_assistido_id, _data, _tipo, _observacoes` | `(_assistido_id uuid, _data timestamptz, _tipo text, _observacoes text)` → uuid | ✅ |
| `fn_entrevistas_operacional` | `Entrevistas.tsx:138`, `services/agenda/agendaEntrevistas.ts:25`, `components/CartaAgendamento.tsx:77` | `()` / `{_start,_end?}` / `{_id}` | `(_start tstz DEFAULT NULL, _end tstz DEFAULT NULL, _id uuid DEFAULT NULL)` → TABLE | ✅ (todos opcionais) |

### 2.5 Comunicação / fila / notificação (disparo sensível)

| RPC | Local | Payload FE | Assinatura banco | Paridade |
|---|---|---|---|---|
| `fn_enfileirar_mensagem_manual` | `services/notificacoes/notificacoesService.ts:413` | `p_assistido_id, p_mensagem, p_observacao` | `(p_assistido_id uuid, p_mensagem text, p_observacao text DEFAULT NULL)` → jsonb | ✅ |
| `fn_encerrar_item_fila_erro_cadastro` | `notificacoesService.ts:342` | `p_fila_id, p_motivo, p_observacao\|null` | `(p_fila_id uuid, p_motivo text DEFAULT 'erro_cadastro', p_observacao text DEFAULT NULL)` → jsonb | ✅ |
| `fn_fila_diagnostico_pendentes` | `notificacoesService.ts:299` | — | `()` → TABLE(id, motivo) | ✅ |
| `painel_whatsapp` | `notificacoesService.ts:827` | `p_inicio, p_fim` | `(p_inicio date, p_fim date)` → jsonb | ✅ |
| `painel_whatsapp_v2` | `notificacoesService.ts:897` | `p_inicio, p_fim, p_template?, p_status?, p_assistido?, p_resolucao?, p_optout?` | assinatura idêntica c/ defaults | ✅ |
| `painel_conversas` | `notificacoesService.ts:677` | `(supabase.rpc **as any**)("painel_conversas", {...})` | `(p_inicio date,...,p_limit int DEFAULT 200)` → … | ⚠️ `rpc as any` (RPC **existe** em `types.ts`) |
| `contar_publico_elegivel` | `services/comunicacaoInstitucional.ts:66` | `p_versao` | `(p_versao text)` → integer | ✅ |
| `preparar_envio_institucional` | `comunicacaoInstitucional.ts:85` | `p_comunicacao_id, p_versao, p_janela_dias` | `(p_comunicacao_id uuid, p_versao text, p_janela_dias int DEFAULT 7)` → jsonb | ✅ |
| `fn_monitor_excecao_notificacoes` | `services/programacao/excecoesService.ts:142` | `p_desde` | `(p_desde tstz DEFAULT now()-14d)` → jsonb | ✅ |
| `fn_processar_excecao_notificacoes` | `excecoesService.ts:80` | `p_excecao_id` | `(p_excecao_id uuid)` → jsonb | ✅ |

### 2.6 Voluntários (sensível)

| RPC | Local | Payload FE | Assinatura banco | Paridade |
|---|---|---|---|---|
| `gerenciar_voluntario` | `services/voluntarios/voluntariosService.ts:121` | `p_action, p_voluntario_id, p_motivo\|null` | `(p_action text, p_voluntario_id uuid, p_motivo text DEFAULT NULL)` → jsonb | ✅ |
| `gerenciar_termo_voluntario` | `voluntariosService.ts:159` | `p_action, p_voluntario_id, p_path, p_nome, p_motivo` | `(p_action, p_voluntario_id, p_path DEFAULT NULL, p_nome DEFAULT NULL, p_motivo DEFAULT NULL)` → jsonb | ✅ |
| `fn_buscar_pessoa_para_voluntario` | `voluntariosService.ts:207` | `p_termo` | `(p_termo text)` → TABLE | ✅ |

### 2.7 Relatórios / dashboards / parâmetros / staff (leitura)

| RPC | Local | Paridade |
|---|---|---|
| `relatorio_carga_tarefeiro` | `services/relatorios/cargaTarefeiro.ts:23` | ✅ |
| `relatorio_faltas_periodo` | `services/relatorios/faltas.ts:23` | ✅ |
| `relatorio_frequencia_presenca` | `services/relatorios/frequencia.ts:28` | ✅ |
| `relatorio_tratamentos_concluidos` | `services/relatorios/tratamentosConcluidos.ts:30` | ✅ |
| `dashboard_admin` | `services/dashboard/adminDashboard.ts:62` | ✅ |
| `fn_observabilidade_operacional` | `services/observabilidade/observabilidadeService.ts:18` | ✅ |
| `metricas_ia_whatsapp` | `components/central-ia/MetricasWhatsApp.tsx:60-61` | ✅ |
| `fn_listar_parametros_operacionais` | `services/configuracao/parametrosOperacionaisService.ts:12` | ✅ |
| `fn_atualizar_parametro_operacional` | `parametrosOperacionaisService.ts:52` | ✅ |
| `staff_names` | 6 chamadas (relatórios, entrevistas, notificações) | ✅ |
| `lista_usuarios_email` | `pages/Usuarios.tsx:127` | ✅ |

---

## 3. Problemas encontrados (classificados)

### 🔴 Crítico
**Nenhum.** Nenhum payload diverge da assinatura em parâmetro obrigatório; nenhuma RPC sensível é chamada sem guarda de papel no backend; nenhuma escrita sensível ocorre por caminho não-`SECURITY DEFINER`.

### 🟠 Alto
- **A-1 — RPCs sensíveis de concessão/revogação chamadas direto na tela, sem service.**
  `fn_conceder_acesso_operacional`, `fn_revogar_acesso_operacional`, `solicitar_promocao_admin`, `decidir_promocao_admin` são invocadas inline em `pages/GovernancaAcessos.tsx`, sem wrapper em `services/` e com retorno tratado via `(data as any)?.error/status`.
  *Impacto:* não há risco de segurança (backend protege), mas é o ponto de maior fragilidade de contrato: o shape do retorno (`error`/`status`/`PromotionStatus`) não é tipado e está espalhado na UI. Drift futuro no retorno passaria silencioso.

### 🟡 Médio
- **M-1 — `(supabase.rpc as any)("painel_conversas", …)`** em `notificacoesService.ts:677`: a RPC **já existe** no `types.ts`, então o `as any` é desnecessário e desliga a checagem de payload/retorno de uma função que retorna dados de conversas WhatsApp (sensível).
- **M-2 — Retornos jsonb de RPCs sensíveis tratados via `as any`/`as unknown as`** sem interface de contrato compartilhada (governança de acesso e parte de notificações). Não quebra runtime, mas remove a rede de segurança de tipos.

### 🟢 Baixo (tipagem / centralização / padronização)
- **B-1 — `as never` em payloads jsonb** já tipados no `types.ts`: `pts_persistir_plano`, `pts_converter_assistido`, `migrar_assistido_legado_tratamento` (e os `p_etapas`/`p_planos`/`p_tratamentos`).
- **B-2 — `as never` no objeto inteiro** de `pts_registrar_presenca`, `pts_registrar_ausencia`, `registrar_presenca` — herança defensiva; os tipos hoje existem.
- **B-3 — Nome da RPC `"pts_homologacao_auditar" as never`** (orquestracao.ts:660,741): cast de nome desnecessário; a função está no `types.ts`.
- **B-4 — Chaves opcionais enviadas com `undefined`** (`p_proxima_*`, `p_nova_*`): funcionalmente equivalente a omitir, mas inconsistente; preferir omissão condicional.
- **B-5 — `map((a: any) => …)`** em `buscarDestinatariosManual` e em vários mapeamentos de `notificacoesService.ts` (linhas 381, 456, 515, 522, 529, 574): perda de tipagem em transformação de dados de leitura.

---

## 4. Confirmação de paridade de parâmetros obrigatórios/opcionais

Conferência item a item: **não há divergência de obrigatoriedade**. Todos os parâmetros sem `DEFAULT` no banco são enviados pelo frontend; todos os enviados como `null`/`undefined`/omitidos correspondem a parâmetros com `DEFAULT` no banco. Nenhum tipo manual duplicado conflitante com `types.ts` foi encontrado (os tipos de retorno em TS são interfaces de leitura sobre `jsonb`, não redefinições do enum/assinatura).

---

## 5. Proposta de sublotes para correção (Q1-C2+, **não executar agora**)

- **Q1-C2 — Wrapper de governança de acesso (Alto):** criar `services/governanca/acessoService.ts` com funções tipadas para `solicitar_promocao_admin`, `decidir_promocao_admin`, `fn_conceder_acesso_operacional`, `fn_revogar_acesso_operacional`, retornando tipos de contrato (`PromotionResult`, `AcessoOperacionalResult`); migrar `GovernancaAcessos.tsx` para consumir o service (apenas frontend/apresentação).
- **Q1-C3 — Limpeza de casts (Baixo/Médio):** remover `as never`/`as any` desnecessários (B-1..B-3, M-1) agora que as RPCs estão em `types.ts`; tipar mapeamentos `(a: any)` (B-5).
- **Q1-C4 — Interfaces de retorno jsonb (Médio):** centralizar shapes de retorno das RPCs jsonb sensíveis em `types/` e reutilizar nos services.

## 6. Proposta de testes de contrato (Q1-C, **não executar agora**)

- **Testes puros (`src/test/governanca`):** para cada RPC sensível, asserir que o payload montado pelo wrapper contém exatamente as chaves esperadas (snapshot de chaves) e que parâmetros obrigatórios nunca saem `undefined`.
- **Integração real (`src/test/integration/db`, `npm run test:db`):** invocar cada RPC sensível com payload mínimo válido (em `withRollback`) e validar o shape do retorno contra a interface de contrato — detecta drift de assinatura no banco automaticamente.

---

## 7. Confirmação final (escopo Q1-C1)

✅ Inventário concluído. **Nenhuma alteração** foi feita em runtime, RLS, grants/revokes, `SECURITY DEFINER`, guardas S1/P1, fluxo de agenda, tratamento, WhatsApp, lógica funcional, schema ou edge functions.
Métricas de segurança preservadas: **0028=0, 0025=0, 0029=56**.
