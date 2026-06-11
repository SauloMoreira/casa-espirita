# Central de Notificações + WhatsApp (Evolution API)

Integração de WhatsApp como canal operacional, desacoplada do provedor, com fila, templates, opt-out, triagem por IA e handoff humano. Nenhum fluxo atual é alterado — tudo novo é aditivo.

## Visão da arquitetura

```text
Evento do sistema (entrevista/sessão criada, lembrete, remarcação, cancelamento)
        │  (trigger de DB grava na fila, com dedupe_key)
        ▼
notificacoes_fila ──► motor de envio (edge function "notificacoes-dispatch", cron a cada X min)
        │  valida: opt-out, janela horária, limite diário, 1 lembrete/evento, dedupe
        ▼
   Adaptador de canal (interface ChannelAdapter) ──► EvolutionAdapter ──► Evolution API
        │                                            (troca futura = novo adaptador)
        ▼
notificacoes_log (saída) + atualização de status/retry/external_message_id

Inbound: Evolution webhook ──► edge function "whatsapp-inbound"
   identifica conversa/assistido ► classifica intenção (IA) ►
     caso simples: IA responde   │  caso complexo: cria whatsapp_handoffs (humano)
```

A camada de negócio nunca chama a Evolution diretamente: fala com o **motor de notificações** e com um **adaptador de canal** atrás de uma interface, garantindo a troca futura (ex.: Cloud API oficial) sem reescrever regras.

## Banco de dados (migração aditiva)

Novas tabelas (com GRANTs + RLS):
- `notificacoes_preferencias` (assistido_id, whatsapp_ativo, opt_out_at, opt_out_motivo, horario_inicio_envio default 08:00, horario_fim_envio default 20:00)
- `notificacoes_templates` (codigo_template, tipo_evento, canal, titulo_interno, corpo_template, ativo)
- `notificacoes_fila` (evento_origem, assistido_id, telefone_normalizado, canal, template_codigo, payload_json, status, scheduled_at, sent_at, retry_count, dedupe_key UNIQUE, external_message_id)
- `notificacoes_log` (fila_id, direcao, payload_enviado, payload_recebido, status, erro)
- `whatsapp_conversas` (assistido_id, telefone, status_conversa, ultimo_contato_em, em_handoff, atendente_responsavel)
- `whatsapp_handoffs` (conversa_id, motivo, classificado_por_ia, status, atendente_id, opened_at, closed_at)

Enums: `notif_status` (pendente, agendado, enviado, falha, cancelado), `notif_canal` (whatsapp), `notif_evento`, `conversa_status`, `handoff_status`.

Triggers de enfileiramento (aditivos, não alteram lógica existente):
- `entrevistas_fraternas` AFTER INSERT → evento "entrevista_criada" + agenda lembrete 24h antes
- `agenda_tratamentos_assistido` AFTER INSERT → "sessao_criada" + lembrete 24h; AFTER UPDATE de data/horário → "remarcacao"; status→cancelado → "cancelamento"

Regras anti-spam aplicadas no motor de envio (não no trigger): janela horária, limite diário, 1 lembrete por evento, `dedupe_key` único por evento+destinatário+janela, respeito a opt-out.

Seed dos 6 templates (acolhedores, curtos, sem cobrança).

## Edge functions
- `notificacoes-dispatch` — lê fila elegível, renderiza template, chama adaptador, grava log/status/retry. Disparada por pg_cron (a cada 5 min) e invocável manualmente.
- `whatsapp-inbound` — webhook da Evolution: identifica conversa/assistido, classifica intenção via Lovable AI, responde casos simples (próxima sessão, horário entrevista, confirmação, onde ver no app, opt-out) ou abre handoff.
- `_shared/channel-adapter.ts` — interface `ChannelAdapter` + `EvolutionAdapter` (envio via Evolution).

## Frontend
- `src/services/notificacoes/*` + `src/lib/notificacoes.ts` (lógica pura: dedupe_key, validação de janela, limite diário, render de template) com testes.
- Perfil do assistido (`MeuPerfil.tsx`): card "WhatsApp" com toggle opt-in/opt-out, status ativo, motivo.
- Central de Notificações para staff (admin/coordenação): aba/página com fila, status, conversas e handoffs (abrir/atribuir/fechar). Reaproveita padrão visual premium existente.

## Testes (Vitest)
Lógica pura: geração de fila, dedupe, opt-out, render de template, janela horária, limite diário, classificação de intenção (helper puro), decisão de handoff, auditoria.

## Decisões que preciso de você

1. **Credenciais Evolution API** — vou precisar de 3 segredos para o adaptador e webhook funcionarem de verdade:
   - `EVOLUTION_API_URL` (URL base da sua instância Evolution)
   - `EVOLUTION_API_KEY` (apikey)
   - `EVOLUTION_INSTANCE` (nome da instância conectada ao número da empresa)
   Posso construir tudo e deixar o adaptador pronto; o envio real só funciona após você inserir esses segredos. Confirma que tem acesso a uma instância Evolution?

2. **Quem acessa a Central de Notificações** (fila/conversas/handoffs)? Sugiro admin + coordenação. Atendentes de handoff = mesmos perfis ou um perfil específico?

3. **Limite diário de mensagens operacionais por assistido** — sugiro 3/dia. Ok?

## Garantias
- Tudo aditivo; nenhum trigger/fluxo existente é modificado.
- RLS rigoroso (assistido vê só suas preferências; staff conforme perfil).
- Adaptador desacoplado para troca futura de provedor.
- typecheck/build limpos e testes passando.
