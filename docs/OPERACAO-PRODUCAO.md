# Operação em Produção — Runbook (Fase 5: Prontidão de Produção)

Documento operacional final da plataforma de gestão da casa espírita. Consolida
**backup, restore, rollback, monitoramento, alertas, responsáveis, checklist de
go-live e procedimentos de contingência**.

- **Última revisão:** 2026-06-18
- **Escopo:** prontidão operacional (não cria funcionalidade de negócio).
- **Ambiente:** Lovable Cloud (frontend hospedado + backend Supabase gerenciado:
  Auth, PostgreSQL, Storage, Edge Functions, pg_cron).
- **Documentos relacionados:** `docs/SECURITY.md`, `docs/ARCHITECTURE.md`,
  `docs/TESTING.md`.

> Nota de plataforma: backups gerenciados, restore point-in-time e rotação de
> chaves são executados pela infraestrutura do Lovable Cloud. Este runbook
> documenta **o que é gerenciado pela plataforma** e **o que é responsabilidade
> operacional da casa** (exportações, validações e procedimentos de decisão).

---

## 1. Backup

### 1.1 O que entra no backup
| Categoria | Conteúdo | Mecanismo |
|---|---|---|
| Banco de dados | Todas as tabelas `public` (assistidos, agenda, tratamentos, presenças, WhatsApp, IA, auditoria, usuários/roles) | Backup gerenciado da plataforma (PostgreSQL) |
| Arquivos/documentos | Buckets de Storage (fotos, base doutrinária da IA, anexos) | Backup gerenciado de Storage |
| Configurações críticas | `instituicao_config`, `configuracoes_gerais`, `regras_operacionais`, `programacao_padrao`, `ia_configuracoes`, `notificacoes_templates` | Incluídas no backup de banco |
| Segredos/integrações | Secrets de edge functions (Z-API, webhook WhatsApp, Lovable AI) | Gerenciados em Secrets do projeto (não ficam no código) |
| Dados operacionais | `audit_logs`, `notificacoes_log`, `whatsapp_conversas/handoffs` | Incluídos no backup de banco |

### 1.2 Como é executado / frequência / armazenamento
- **Banco e Storage:** backup automático contínuo da plataforma Lovable Cloud
  (point-in-time recovery dentro da janela de retenção do plano).
- **Exportações operacionais (responsabilidade da casa):** export CSV das tabelas
  sensíveis a cada marco relevante, usando os relatórios existentes e o
  `src/lib/exportCsv.ts`. Recomendado **semanal** para dados cadastrais e de
  agenda, e antes de qualquer migração de schema relevante.
- **Armazenamento das exportações:** local seguro e controlado pela
  administração (acesso restrito a admin/master).

### 1.3 Quem pode acessar
- Backups gerenciados: acessíveis apenas via plataforma pela administração com
  acesso ao projeto.
- Exportações CSV: somente perfis `admin` / `administrador_master`
  (RLS já restringe relatórios sensíveis — ver `docs/SECURITY.md`).

### 1.4 Como verificar sucesso do backup
- **Exportações:** confirmar arquivo gerado, contagem de linhas coerente e
  abertura sem erro. Registrar data/responsável.
- **Plataforma:** confirmar disponibilidade de ponto de restauração recente na
  área de banco do Lovable Cloud antes de qualquer mudança de risco.

---

## 2. Restore

### 2.1 Restaurar o banco
1. Interromper publicações/mudanças (congelamento).
2. Restaurar via point-in-time recovery da plataforma para o instante imediatamente
   anterior ao incidente, **ou** reimportar exportações CSV pontuais para tabelas
   específicas (usando o tool de inserção / fluxo administrativo).
3. Reaplicar migrações pendentes apenas se necessário.

### 2.2 Restaurar arquivos/documentos
- Restaurar buckets de Storage pela plataforma. Para perdas pontuais, reenviar o
  arquivo pela tela correspondente (foto de perfil, base doutrinária, etc.).

### 2.3 Como validar a restauração
- Login funcional (admin + um perfil padrão).
- Agenda de um assistido conhecido confere (fonte única: `agenda_tratamentos_assistido`).
- Presenças recentes preservadas.
- Conversas/handoffs do WhatsApp acessíveis.
- `audit_logs` íntegro.
- Rodar `npx vitest run` (suite verde) como verificação de integridade da lógica.

### 2.4 Riscos e limitações
- Restore de banco é **destrutivo** para dados gravados após o ponto restaurado
  (perde-se a janela entre o ponto e o incidente).
- Restore parcial via CSV pode quebrar integridade referencial se feito fora de
  ordem — restaurar tabelas-pai antes das filhas.
- Secrets não são restaurados por backup de banco: reconfigurar se rotacionados.

---

## 3. Rollback

### 3.1 Rollback de aplicação (frontend)
- Mudanças de frontend só vão ao ar ao clicar **Update** no diálogo de publicação.
- Rollback = republicar a versão anterior conhecida como boa (histórico de
  versões do projeto). Rápido e **não destrutivo de dados**.

### 3.2 Rollback de configuração
- Reverter valores em `instituicao_config` / `configuracoes_gerais` /
  `regras_operacionais` / `programacao_padrao` para o estado anterior
  (consultar `audit_logs` para o valor original via JSON-diff).

### 3.3 Rollback de banco (schema)
- Edge functions e migrações fazem deploy **imediato**. Rollback de schema exige
  nova migração corretiva (forward-fix), pois migrações não são "desfeitas"
  automaticamente. Para dados, usar restore (seção 2).

### 3.4 Critérios de decisão
| Situação | Rollback permitido | Observação |
|---|---|---|
| Regressão funcional crítica pós-publicação de frontend | Sim | Republicar versão anterior |
| Configuração incorreta causando bloqueio operacional | Sim | Reverter via dados + auditoria |
| Bug de schema sem perda de dados | Preferir forward-fix | Migração corretiva |
| Incidente com corrupção/perda de dados | Restore (não rollback) | Ver seção 2 |
| Já houve gravação massiva de dados novos válidos | Rollback de banco **não** apropriado | Avaliar correção pontual |

### 3.5 Minimizar perda de dados
- Sempre exportar/checar ponto de restauração **antes** de mudança de risco.
- Preferir forward-fix a rollback de banco quando houver dados novos válidos.

---

## 4. Monitoramento

Visibilidade operacional mínima:

| Sinal | Onde olhar |
|---|---|
| Status geral da app | Preview/produção carregando; console sem erros |
| Funções críticas | Logs das edge functions (`whatsapp-inbound`, `whatsapp-responder`, `notificacoes-dispatch`, `mfa-manager`, `manage-signup`, `create-user`) |
| WhatsApp / Z-API | `whatsapp_conversas`, `whatsapp_handoffs`, logs de `whatsapp-inbound` (401 = spoofing/secret) |
| Fila / notificações | `notificacoes_fila` (itens presos em "pendente"), `notificacoes_log` |
| Erros relevantes | Logs de edge functions + `audit_logs` |
| Saúde das integrações | Resposta do provedor Z-API e do Lovable AI Gateway nos logs |
| Degradação | Crescimento anormal de handoffs, falhas repetidas, fila estagnada |

- A rotina `alertas-operacionais` (pg_cron) já detecta discrepâncias operacionais
  e gera avisos internos (ver memória "Alertas Operacionais Cron").

---

## 5. Alertas mínimos

Prioridade de incidentes a monitorar/alertar:

1. **Falha de webhook inbound do WhatsApp** — `whatsapp-inbound` retornando 401/5xx.
2. **Falha de envio relevante** — erros em `whatsapp-responder` / `notificacoes-dispatch`.
3. **Fila parada** — `notificacoes_fila` com pendentes antigos sem processamento.
4. **Erro repetido em edge function crítica** — picos de erro nos logs.
5. **Desconexão do provedor WhatsApp** — Z-API sem resposta / token inválido.
6. **Falhas críticas de autenticação** — picos de falha de login / MFA.
7. **Aumento anormal de handoffs/falhas operacionais** — `whatsapp_handoffs` acima do normal.
8. **Falha de backup/exportação** — exportação semanal não realizada.

Canal de alerta atual: **avisos internos** (realtime) gerados pelo cron, visíveis
aos perfis administrativos. Escalonamento manual conforme seção 6.

---

## 6. Responsáveis e operação

> Preencher nomes reais antes do go-live. Estrutura mínima:

| Tipo de incidente | Responsável principal | Contingência |
|---|---|---|
| WhatsApp / Z-API | _Responsável técnico WhatsApp_ | Administração |
| Login / autenticação / MFA | _Responsável técnico_ | Administrador Master |
| Agenda / presença | _Coordenação operacional_ | Administração |
| IA / handoff | _Responsável IA_ | Administração |
| Produção geral (app fora do ar) | _Responsável técnico_ | Administrador Master |
| Rollback | Administrador Master | Responsável técnico |
| Restore | Administrador Master | Responsável técnico |

---

## 7. Checklist de Go-Live

- [ ] Autenticação validada (login, reset de senha, sessões, MFA admin)
- [ ] Permissões revisadas (RLS + `ProtectedRoute` por papel)
- [ ] Cadastro com aprovação administrativa funcionando (sem signup público)
- [ ] IA / WhatsApp / handoff funcionando (ordem: exceção → agenda real → padrão)
- [ ] Agenda e presença validadas (fonte única `agenda_tratamentos_assistido`)
- [ ] Dashboards e relatórios validados (dados reais, escopo por papel)
- [ ] Backup pronto (gerenciado + exportação inicial verificada)
- [ ] Restore definido e ponto de restauração disponível
- [ ] Rollback definido (frontend + config + critérios)
- [ ] Monitoramento ativo (logs + cron de alertas)
- [ ] Alertas mínimos configurados (seção 5)
- [ ] Central de Ajuda / FAQ por papel disponível
- [ ] Equipe minimamente orientada (onboarding em tela ativo)
- [ ] Responsáveis operacionais preenchidos (seção 6)
- [ ] `tsc --noEmit` limpo, build limpo, `vitest` verde

---

## 8. Documentação operacional / contingência

### Visão geral
Plataforma fechada, acesso provisionado por gestores; backend gerenciado (Lovable
Cloud). Lógica crítica em triggers/RPCs e edge functions.

### Incidentes comuns e como agir

**Falha de WhatsApp**
1. Verificar logs de `whatsapp-inbound` (401 = secret/webhook inválido).
2. Conferir conexão/token Z-API.
3. Checar `notificacoes_fila` por acúmulo de pendentes.
4. Acionar responsável WhatsApp (seção 6).

**Falha de login**
1. Confirmar status da Auth e do app.
2. Verificar se usuário está ativo e com role válida (`user_roles`).
3. Senha temporária força `/reset-password` — orientar.
4. MFA: usar códigos de recuperação; reset por Master se necessário.

**Falha de agenda**
1. Conferir `agenda_tratamentos_assistido` (fonte única) para o assistido.
2. Verificar reconciliação (não afeta sessões passadas).
3. Conferir validação de dia da semana e modo do tratamento.

**Falha de handoff / IA**
1. Verificar logs de `assistente-entrevista` / `whatsapp-responder`.
2. Confirmar resposta do Lovable AI Gateway.
3. Conferir ordem de consulta (exceção → agenda → padrão → fallback).
4. Em falha de IA, atendimento humano via handoff permanece disponível.

**App fora do ar**
1. Confirmar publicação ativa.
2. Se regressão recente, rollback de frontend (seção 3.1).
3. Acionar responsável técnico / Master.

### Onde olhar
- Logs de edge functions (funções críticas).
- `audit_logs` (ações sensíveis com JSON-diff).
- `notificacoes_fila` / `notificacoes_log`.
- `whatsapp_conversas` / `whatsapp_handoffs`.

### Quando escalar
- Indisponibilidade total > 15 min, suspeita de perda/corrupção de dados,
  falha de autenticação generalizada, ou incidente de segurança → escalar ao
  Administrador Master imediatamente.

---

## 9. Pré-validação para piloto

Avaliação consolidada apresentada na conclusão da Fase 5 (ver resposta de entrega).
