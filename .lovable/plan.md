# L-01 — Governança da confirmação imediata de entrevista

## Estado atual (já aplicado na migração anterior)

A camada de backend desta lacuna **já foi implementada e está no banco**:

- **Flag oficial** `entrevista_confirmacao_agendamento_ativa` em `regras_operacionais`
  - tipo `booleano`, **valor padrão `true`** (preserva o comportamento atual da casa, agora explícito e governado)
  - `governavel = true`, `sensivel = true`, `confirmacao_reforcada = true`
  - nome amigável e texto de impacto preenchidos
- **Helper** `fn_confirmacao_entrevista_ativa()` — `SECURITY DEFINER`, `SET search_path = public`, default `true` quando ausente
- **Trigger** `fn_notif_entrevista()` reescrita: a confirmação imediata `entrevista_criada` só é enfileirada se a flag estiver ligada; o **lembrete de 24h continua sempre** sendo gerado; remarcação/cancelamento inalterados; date-only preservado (sem horário fantasma, sem deslocamento UTC)
- Aparece **automaticamente** no painel de Governança de Parâmetros (lista via `fn_listar_parametros_operacionais` que filtra `governavel = true`), ao lado de `tratamento_confirmacao_agendamento_ativa`, `tratamento_lembrete_antecedencia_horas` e `excecao_notificacao_ativa`
- Alteração já é **auditada** por `fn_atualizar_parametro_operacional` (quem, quando, valor anterior/novo, origem `painel_governanca`, observação)

> Como o painel é data-driven, **não há mudança de frontend necessária** — a flag já surge com nome, descrição, valor atual, valor padrão, impacto e metadados de última alteração.

## O que falta para considerar L-01 concluído

### 1. Testes (TS / vitest)
- **Regressão temporal (guarda do bug já corrigido):** adicionar/garantir teste em `src/lib/notificacoes.test.ts` confirmando que o payload de entrevista date-only renderiza **sem inventar horário** e **sem deslocar o dia por UTC** (confirmação e lembrete).
- **Pré-validação da flag:** caso de `validarValor` booleano já cobre o tipo; adicionar asserção explícita do par chave/semântica em `parametrosOperacionais.test.ts` se fizer sentido (rótulo/format).
- Observação honesta: a decisão de enfileirar é **no trigger do banco** (fonte de verdade) e não em TS; a cobertura unitária TS protege a renderização/validação. A verificação funcional do liga/desliga é feita na etapa de validação manual via RPC (abaixo).

### 2. Documentação viva
- `docs/MATRIZ-EVENTOS-EFEITOS.md`: atualizar **EVT-08** para refletir confirmação governada (status ✅, citar `fn_confirmacao_entrevista_ativa` e a flag), mover **L-01** de lacuna para concluído na seção de lacunas/recomendações.
- `docs/BACKLOG-GOVERNANCA.md`: marcar **L-01 = ✅ Concluído** com entrega, default adotado (true) e invariantes preservadas; manter ordem L-03 → L-04.
- Registrar o **item futuro** solicitado: "Override manual auditado para limite diário" (prioridade baixa/média, status backlog, só se houver necessidade operacional recorrente real), como decorrência da decisão de L-02 (mensagem manual continua respeitando o limite diário por padrão).

### 3. Memória do projeto
- Atualizar `mem://funcionalidades/backlog-governanca-matriz` e o índice para refletir L-01 concluído e o novo item de backlog do override manual.

### 4. Validação / não regressão
- Rodar a suíte completa (`vitest run`) e confirmar verde.
- Validação funcional da flag via RPC autenticada (`fn_atualizar_parametro_operacional`) em ambiente de teste: ligar → confirmar que `entrevista_criada` é enfileirada no INSERT; desligar → confirmar que **só** o `entrevista_lembrete` (24h) é gerado; e que cancelamento/remarcação seguem corretos. Reverter ao default `true` ao final.
- Conferir que tratamento, Central, dispatch e mensagens manuais permanecem intactos.

## Detalhes técnicos / invariantes
- Backend é fonte única de verdade (INV-ARQ-001); sem lógica de decisão no frontend (INV-ARQ-003/004).
- Governança/auditoria: INV-GOV-001/002/003.
- Semântica temporal: INV-TEMPO-001/002/003 (date-only sem horário fantasma, sem shift UTC).
- Fila: INV-FILA-006 (lembrete real preservado).

## Critérios de aceite
- Flag oficial existe, governada, auditável e visível no painel — ✅ (backend aplicado).
- Comportamento previsível e explícito a partir da flag — validado funcionalmente.
- Date-only não regride — coberto por teste + validação.
- Docs e memória atualizados; suíte completa verde, sem regressão.
