# Migração / cadastro de assistidos já em tratamento (legado)

Entrada administrativa própria para cadastrar assistidos já em acompanhamento, preservando o estágio atual — sem entrevista normal e sem reconstruir histórico. Reaproveita `assistidos`, `assistido_tratamentos` e `agenda_tratamentos_assistido`, sem fluxo paralelo de tratamento.

## 1. Marcação de legado (banco)
Migração adicionando colunas (sem quebrar nada):
- `assistidos`: `origem_cadastro text NOT NULL DEFAULT 'normal'` ('normal'|'legado'), `migrado_legado boolean NOT NULL DEFAULT false`, `data_migracao timestamptz`, `observacao_migracao text`.
- `assistido_tratamentos`: `origem text NOT NULL DEFAULT 'normal'` ('normal'|'legado'), `observacao_migracao text`.

A RLS atual já restringe escrita a admin; as colunas herdam a proteção. Os `status` já são aceitos pelos CHECKs existentes.

## 2. Estado atual dos tratamentos (sem passado fictício)
Por tratamento o admin informa: tipo (`tipos_tratamento`), status atual, `quantidade_total`, `quantidade_realizada`, observação.
- Registro em `assistido_tratamentos` com `entrevista_id = null`, `origem = 'legado'`.
- `quantidade_realizada <= quantidade_total`; `quantidade_faltante` recalculado pelo trigger existente.
- **Nenhuma** entrevista em `entrevistas_fraternas`, **nenhuma** presença/sessão passada.

## 3. Próxima sessão / próximo passo
Opcional, por tratamento: data + horário.
- Se informada → insere **uma única** linha em `agenda_tratamentos_assistido` com `status = 'agendado'`.
- **Só permitida** quando o status do tratamento for compatível com continuidade: `aguardando_agendamento`, `liberado`, `em_andamento`. Bloqueada para `concluido`, `cancelado`, `suspenso` (salvo regra administrativa explícita e validada na interface).
- **Não pode colidir incoerentemente** com sessão já futura do mesmo tratamento para aquele assistido, salvo confirmação administrativa explícita na UI.
- Sem data/horário → o tratamento permanece no status lançado, aguardando o fluxo normal a partir dali.

## 4. Consistência
- Status apenas da lista real: `aguardando_inicio, aguardando_agendamento, liberado, em_andamento, concluido, suspenso, cancelado`.
- **Estado global do assistido**: só atualizar automaticamente se já existir regra consistente para isso. **Se não houver regra consolidada para atualização automática do estado global, persistir apenas a marcação de legado e os vínculos de tratamento, sem inferência extra** — sem automatismo "criativo".
- **Duplicidade**: se já existir vínculo ativo do mesmo tratamento, impedir duplicidade incoerente ou exigir **confirmação explícita e visível** do admin na UI (não falha silenciosa de backend).

## 5. Tela admin — `src/pages/MigrarAssistido.tsx`
Assistente em etapas, simples e rápido:
1. **Dados do assistido** — reusa campos existentes (nome, celular, e-mail, nascimento, endereço, CPF); criar novo ou selecionar existente. Para assistido existente, a UI deixa claro o que será reaproveitado, o que pode ser atualizado e o que não será sobrescrito sem confirmação. **Alterações em dados cadastrais sensíveis exigem confirmação explícita antes de sobrescrever o valor atual.**
2. **Legado** — `data_migracao` (default hoje), indicador "entrevista/triagem fora do sistema", `observacao_migracao`.
3. **Tratamentos atuais** — lista dinâmica: tipo, status, total, realizadas, observação.
4. **Próxima sessão** — por tratamento: data, horário (opcional).
5. **Observações administrativas** — campo livre consolidado.

## 6. Rota e navegação
- `src/App.tsx`: rota `/migrar-assistido` com `ProtectedRoute allowedRoles={["admin"]}`.
- `src/components/AppSidebar.tsx`: item "Migrar Assistido" no grupo **Atendimento**, role `admin`.
- `src/constants/routes.ts`: constante `migrarAssistido`.

## 7. Serviço — `src/services/assistidos/migracaoLegado.ts`
`migrarAssistidoLegado(params)`: cria/atualiza o assistido (origem legado), grava data/observação de migração, cria vínculos em `assistido_tratamentos`, cria a próxima sessão quando informada e válida. Não toca em entrevistas nem gera histórico. Não altera estado global do assistido sem regra consolidada.

## 8. Lógica pura e validações — `src/lib/migracaoLegado.ts` (+ `.test.ts`)
Monta payloads e valida: `quantidade_realizada <= quantidade_total`, status na lista real, data/hora da próxima sessão válida, coerência de `dia_semana` quando aplicável, incompatibilidade status×próxima sessão, colisão com sessão futura existente, bloqueio de payload inconsistente e de duplicidade incoerente.

## 9. Governança e relatórios
Legado distinguível por `assistidos.migrado_legado`/`origem_cadastro` e `assistido_tratamentos.origem`. Triggers de auditoria existentes (`fn_audit_trigger`) registram inserções/atualizações e a marcação de legado, permitindo relatórios futuros separarem origem normal × legado.

## 10. Não-objetivos
Não substitui a entrevista normal; não recria sessões/presenças passadas; não reexecuta entrevista; não cria fluxo paralelo nem status novos; não infere estado global sem regra consolidada.

## 11. Testes
- Unit (`migracaoLegado.test.ts`): payloads, validações, status, próxima sessão, duplicidade, múltiplos tratamentos, incompatibilidade status×agendamento, colisão com sessão futura.
- Funcional: cadastro legado; marcação de origem; tratamento em andamento com status e contadores; próxima sessão na agenda; operável a partir do estágio atual; sem reinício de jornada; confirmação ao sobrescrever dados sensíveis de assistido existente.
- Regra: migrado não gera entrevista; tratamento não volta ao início; sem histórico passado; permissões admin; sem duplicidade incoerente.
- Técnico: build, typecheck e suíte existentes sem regressão.

## 12. Critérios de aceite
Entrada administrativa específica; assistido cadastrável como legado; tratamentos em andamento com status e contadores; próxima sessão válida registrada; sistema opera a partir do estágio atual; sem entrevista/histórico artificial; sem inferência de estado global sem regra; migração auditável e distinta; build/typecheck/testes ok.
