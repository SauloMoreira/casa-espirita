# P1 — Revisão final de edge functions, storage e SECURITY DEFINER residual (desenho revisado)

> Desenho operacional revisado. **Sem implementação.** Padrão: desenho → revisão → implementação.
> Prioridades: segurança · qualidade de código · não regressão · consistência arquitetural · baixo risco operacional.

---

## 1. Resumo executivo da P1

**Objetivo.** Fechar a auditoria das superfícies privilegiadas remanescentes, separando com clareza: (a) **arquitetura intencional**, (b) **precisa correção**, (c) **deve ser revogado/endurecido**, (d) **aceito com justificativa formal**. Cobre edge functions, storage/buckets, residual `0029` e os grants/fronteiras de autorização.

**Risco que reduz.**
- Bypass de autenticação/autorização em edge functions e exposição indevida de operação privilegiada (não o mero uso de `service_role`, mas guarda inadequado).
- Vazamento de PII/conteúdo sigiloso por storage (enumeração, URL reutilizável, indexação, listagem desnecessária).
- Risco residual `0029`: as 65 funções `SECURITY DEFINER` chamáveis por `authenticated` hoje só têm justificativa em bloco — falta classificação e subpriorização nominal.

**Por que entra agora.** S1 zerou `0028` (anon) e `0025` (storage listing). O risco migrou para o uso **autenticado/intencional** de `SECURITY DEFINER` e para a superfície **externa privilegiada** (edge functions). É a continuação direta de S1, mesmo método (lotes, inventário nominal, doc formal, sem regressão), e independe do CI (pausado).

**Princípio orientador (ajuste 1).** `service_role` interno **não é vulnerabilidade por si**. O que importa é: *guarda adequado* + *ausência de bypass* + *operação privilegiada não exposta a quem não deveria*. Por isso o inventário separa **"usa service_role?"** de **"há risco de exposição/bypass desse privilégio?"**.

---

## 2. Inventário das superfícies

> Campos mínimos por item: nome · superfície · tipo de abertura · efeito (leitura/escrita/mista) · classe de dado (público/operacional/sensível/PII/sigiloso) · guarda atual · guarda desejada · caller esperado · risco principal. Para edge functions, adiciona-se **usa service_role?** e **risco de exposição/bypass do privilégio?**.

### 2.1 Edge functions

Tipos de abertura: **pública por design · webhook S2S · cron/staff · autenticada · administrativa privilegiada**.

| Nome | Tipo de abertura | Efeito | Classe de dado | service_role? | Guarda atual | Guarda desejada | Caller esperado | Risco de bypass/exposição do privilégio | Risco principal |
|---|---|---|---|---|---|---|---|---|---|
| `checkin-publico` | pública por design | mista | operacional/PII leve | sim | token de sessão + rate limit (`checkin_tentativas`) | idem + escopo mínimo de retorno | visitante anônimo | **médio** — superfície pública grava dados | dado retornado/gravado além do necessário |
| `request-signup` | pública por design | escrita | PII (solicitação) | sim | validação de input + anti-abuso | idem + rate limit confirmado | visitante anônimo | **médio** | abuso/flood, gravação indevida |
| `whatsapp-inbound` | webhook S2S | mista | operacional/PII | sim | validação de assinatura/segredo | assinatura forte obrigatória, fail-closed | provedor WhatsApp | **alto** se assinatura fraca | spoofing de webhook |
| `create-user` | administrativa privilegiada | escrita | PII + acesso | sim | role admin/master | idem confirmada | admin/master | **alto** se faltar checagem | criação de usuário por não-admin |
| `manage-user` | administrativa privilegiada | mista | PII + acesso | sim | role admin/master | idem | admin/master | **alto** | escalonamento de privilégio |
| `manage-signup` | administrativa privilegiada | escrita | PII + acesso | sim | role admin/master | idem | admin/master | **alto** | aprovação indevida |
| `mfa-manager` | autenticada (sensível) | mista | sigiloso (MFA) | sim | escopo por `auth.uid()` | idem; reset só master | dono / master | **alto** | manipulação de MFA de terceiro |
| `reset-password` | autenticada/admin | escrita | sigiloso (senha) | sim | guarda + logging sem senha | idem | admin / fluxo recuperação | **médio** | exposição de senha em log |
| `assistente-entrevista` | autenticada | mista | sigiloso (entrevista) | sim | role entrevistador/admin | idem confirmada | staff de entrevista | **alto** | tarefeiro/assistido acessando conteúdo sigiloso |
| `conteudo-imagem-ia` | autenticada | escrita | operacional | sim | role staff | idem | admin/staff | baixo | custo/abuso de geração |
| `whatsapp-responder` | autenticada/cron | escrita | operacional/PII | sim | role + guard | idem | staff/cron | médio | envio indevido |
| `insights-dashboard` | autenticada | leitura | operacional/agregado | **não** | role de leitura | idem confirmada | staff | baixo | leitura por perfil errado |
| `alertas-operacionais` | cron/staff | mista | operacional | sim | `guardCronOrStaff` + cron secret | idem | pg_cron / admin | médio | disparo por não-autorizado |
| `central-fila-alerta` | cron/staff | mista | operacional | sim | `guardCronOrStaff` | idem | pg_cron / admin | médio | idem |
| `comunicacao-dispatch` | cron/staff | escrita | PII (envio externo) | sim | `guardCronOrStaff` + consentimento/anti-spam | idem | pg_cron / admin | **médio-alto** | envio sem consentimento |
| `notificacoes-dispatch` | cron/staff | escrita | operacional/PII | sim | `guardCronOrStaff` + trava dispatch | idem | pg_cron / admin | médio | duplicidade/envio indevido |
| `ia-site-ingestao` | cron/staff | escrita | operacional | sim | `guardCronOrStaff` | idem | pg_cron / admin | baixo | ingestão indevida |
| `_shared/auth.ts` · `_shared/cors.ts` | fronteira compartilhada | — | — | n/a | `guardCronOrStaff` + allowlist CORS | revisar allowlist + fail-closed | todas as functions | base de todas | regressão central |

### 2.2 Storage / buckets

| Nome | Conteúdo esperado | Público/Privado | URL direta? | Necessita listagem? | Dono do upload | Risco de enumeração | Risco de indexação/reuso de URL | Risco de conteúdo sensível | Veredito preliminar |
|---|---|---|---|---|---|---|---|---|---|
| `avatars` | fotos de perfil + imagens institucionais | **público** (exibição) | sim (`getPublicUrl`) | **não** (removida no S1) | `auth.uid()` (1º segmento do path) | baixo (listagem pública removida) | **médio** — URL pública estável/reutilizável | baixo (foto não é sigilo) | manter público só p/ exibição; revisar se URL deveria ser não-adivinhável |
| `ia-biblioteca` | base de conhecimento IA | **privado** | não | só staff | staff/admin | baixo | baixo | operacional | manter privado; confirmar policies SELECT/UPDATE staff |
| `termos-voluntarios` | termo de adesão assinado | **privado** | não | restrito | gestão/voluntário | baixo | **alto se vazasse** (documento pessoal) | **sensível/PII** | confirmar 100% privado, acesso só por dono+admin, sem URL pública |

Eixos a fechar: necessidade real de listagem, leitura pública direta, upload por dono, enumeração, reuso/indexação de URL, anexos/documentos sensíveis.

### 2.3 Residual `0029` (SECURITY DEFINER executável por `authenticated`) — 65 funções

Subpriorização exigida (ajuste 5), além da classificação nominal:

- **A1 — dado sensível / privilégio alto:** funções que tocam PII/sigilo ou concedem/checam privilégio elevado (ex.: gestão de acesso, e-mail/diretório, entrevista). *Foco máximo.*
- **A2 — efeito de escrita ou governança:** RPCs que escrevem estado operacional ou alteram parâmetros/governança (ex.: presença, fila, parâmetros operacionais, coordenação N:N).
- **B — helpers de RLS / booleanos de suporte:** `has_role`, `is_active_*`, `*_belongs_to_coordinator`, `fn_coordena_tratamento` — **precisam** ser executáveis por `authenticated` para as policies funcionarem.
- **C — aceitáveis e bem justificados:** funções que só leem/operam sobre o próprio `auth.uid()` ou cálculo local sem dado sensível.

Cada função recebe os campos do inventário (nome · superfície=RPC `SECURITY DEFINER` · efeito · classe de dado · guarda atual = checagem interna? · guarda desejada · caller esperado · risco principal) + balde (A1/A2/B/C).

### 2.4 Grants relevantes
- Confirmar invariante: **nenhum** `EXECUTE` para `anon`/`PUBLIC` (manter `0028`=0).
- Funções 100% internas só com `service_role`/owner (sem `authenticated`).
- Helpers de RLS (balde B) devem manter `authenticated` por necessidade — registrar como esperado.

---

## 3. Plano por etapas

### Etapa 1 — Inventário técnico consolidado e orientado a risco
- **Objetivo:** mapa nominal único das 3 superfícies + grants, com todos os campos de risco.
- **Entregas:** tabelas 2.1/2.2/2.3 totalmente preenchidas; 65 funções com balde A1/A2/B/C; verificação de grants.
- **Critério de aceite:** cada item privilegiado aparece uma vez, com classe de dado e risco; zero agrupamento opaco; `service_role` vs risco de bypass separados explicitamente.

### Etapa 2 — Revisão das edge functions
- **Objetivo:** validar guarda real por função (foco em públicas, webhook e administrativas privilegiadas).
- **Entregas:** veredito OK/corrigir por função; achados `AVM-*`; confirmação de allowlist CORS, validação de assinatura (webhook) e não-exposição de segredo/`service_role`.
- **Critério de aceite:** toda pública/webhook tem proteção não-CORS (token/assinatura/rate limit); toda administrativa exige role; nenhum privilégio exposto sem guarda.

### Etapa 3 — Revisão profunda de storage
- **Objetivo:** mínimo de exposição por bucket nos 9 eixos do 2.2.
- **Entregas:** veredito por bucket com decisão sobre listagem, URL direta, enumeração, reuso de URL e conteúdo sensível.
- **Critério de aceite:** nenhum bucket público sem necessidade; documentos sensíveis 100% privados (sem URL pública); upload por dono confirmado; sem enumeração.

### Etapa 4 — Consolidação e subpriorização do `0029`
- **Objetivo:** classificar nominalmente as 65 funções nos baldes A1/A2/B/C e propor ações (sem aplicar).
- **Entregas:** tabela nominal completa; lista de correções/endurecimentos propostos para A1/A2; justificativa formal para B/C.
- **Critério de aceite:** zero funções "indeterminadas"; cada A1/A2 com ação concreta; cada B/C com justificativa arquitetural registrada.

### Etapa 5 — Padrão formal, testes e fechamento
- **Objetivo:** consolidar "`SECURITY DEFINER` como fronteira de autorização" e a estratégia de teste.
- **Entregas:** `docs/SECURITY.md` (padrão + veredito P1 + warnings aceitos registrados); estratégia de teste (governança + e2e-rls/db onde aplicável); invariante(s) nova(s) se necessário (ex.: `INV-SEG-006`); `@security-memory` alinhada.
- **Critério de aceite:** doc revisado; warnings aceitos formalmente registrados como arquitetura intencional; testes mapeados; seção 5 atendida.

---

## 4. Priorização interna

**Lote A — mais crítico**
- Edge functions: públicas (`checkin-publico`, `request-signup`, `whatsapp-inbound`) e administrativas privilegiadas + sensíveis (`create-user`, `manage-user`, `manage-signup`, `mfa-manager`, `reset-password`, `assistente-entrevista`).
- `0029`: baldes **A1** e **A2**.

**Lote B — consolidação**
- Edge functions de cron/staff e IA (`alertas-operacionais`, `central-fila-alerta`, `comunicacao-dispatch`, `notificacoes-dispatch`, `ia-site-ingestao`, `conteudo-imagem-ia`, `whatsapp-responder`, `insights-dashboard`) + `_shared`.
- Revisão de storage (todos os buckets).
- `0029`: balde **B** (helpers de RLS — justificar manter).

**Lote C — fechamento**
- `0029`: balde **C** (aceitos por arquitetura).
- Padrão formal em `docs/SECURITY.md`, testes, invariantes, `@security-memory`, critério de pronto.

---

## 5. Critério de pronto da P1

A P1 está concluída quando **todos** verdadeiros:
1. **Nenhum item privilegiado sem decisão** — toda edge function, bucket e função `0029` tem veredito (OK / corrigir / revogar / aceito).
2. **Nenhuma superfície pública sem justificativa explícita** — cada rota pública/webhook tem proteção não-CORS documentada.
3. **Edge functions:** `service_role` separado de risco de bypass; administrativas exigem role; públicas/webhook com token/assinatura/rate limit.
4. **Storage:** nenhum bucket público desnecessário; documentos sensíveis privados; sem enumeração; upload por dono confirmado.
5. **Residual `0029`:** todas as 65 funções **classificadas** (A1/A2/B/C), **justificadas**, **documentadas** e, quando aplicável, **protegidas por teste/regra**.
6. **Warnings aceitos** estão **formalmente registrados** em `docs/SECURITY.md` como arquitetura intencional — não como pendência esquecida.
7. `0028`=0 e `0025`=0 mantidos; nenhuma nova superfície anônima.
8. Suíte de governança/integração verde — **ausência de regressão** confirmada.

---

**Escopo.** Entra: edge functions, storage, `0029`, grants/fronteiras, doc de segurança, testes/critério de aceite. Fica fora: GitHub/CI, multi-tenancy, UX do tarefeiro, observabilidade acionável, novas features, refactors grandes não motivados por risco.

**Próximo passo (sob aprovação):** iniciar a **Etapa 1 (inventário consolidado)** e o **Lote A**. Nada implementado até aqui.