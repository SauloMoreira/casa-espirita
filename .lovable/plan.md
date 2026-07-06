# Q1-C2 — Wrapper tipado para Governança de Acesso (achado A-1)

## Pré-condição funcional (validada)
Bug do assistido recém-cadastrado **não existe mais**. Verificação no banco:
- profiles com `status='pendente'`: **0**
- profiles sem papel base `assistido`: **0**
- `cadastro_solicitacoes` com `status='pendente'`: **0**

Q1-C2 pode ser consolidado.

## Diagnóstico técnico (GovernancaAcessos.tsx)
4 RPCs chamadas inline com `(data as any)`:
- `handleSolicitar` → `solicitar_promocao_admin` (linhas 143, 149)
- `handleDecidir` → `decidir_promocao_admin` (linhas 164, 170, 171)
- `handleConcederOperacional` → `fn_conceder_acesso_operacional` (linhas 192, 198, 199)
- `handleRevogarOperacional` → `fn_revogar_acesso_operacional` (linhas 219, 225)

Sem risco de segurança (backend `SECURITY DEFINER` com guarda de papel). O problema é tipagem ausente e contratos de retorno espalhados na UI — drift futuro seria silencioso.

## Contratos reais de retorno (jsonb, extraídos do banco)
- `solicitar_promocao_admin`: `{ error }` ou `{ success, id, required_approvals, excecao_master }`
- `decidir_promocao_admin`: `{ error }` ou `{ success, status: 'aprovado'|'aprovado_parcialmente'|'rejeitado', aprovacoes?, necessarias? }`
- `fn_conceder_acesso_operacional`: `{ error }` ou `{ success, status: 'concedido'|'ja_concedido', role }`
- `fn_revogar_acesso_operacional`: `{ error }` ou `{ success, status: 'revogado'|'inexistente', role }`

## Desenho operacional (somente frontend)
1. **Novo:** `src/services/governanca/acessoService.ts`
   - Tipos de resultado (uniões discriminadas): `PromocaoResult`, `DecisaoPromocaoResult`, `AcessoOperacionalResult`.
   - 4 wrappers assíncronos que chamam `supabase.rpc`, normalizam o `jsonb` e propagam `Error(result.error)` em caso de erro de negócio.
2. **Refatorar:** `src/pages/GovernancaAcessos.tsx`
   - Substituir as 4 chamadas inline pelos wrappers, remover todos os `(data as any)`.
   - Manter idênticos: textos dos toasts, estados dos diálogos, `fetchAll()`, fluxos.
3. **Teste:** `src/test/governanca/q1c2-acesso-service.test.ts`
   - Teste puro com mock do `supabase.rpc` verificando payload enviado e mapeamento de `error`/`success`/`status`.

## Fora de escopo (regras obrigatórias respeitadas)
S1, P1, RLS, grants/revokes, `SECURITY DEFINER`, policies, schema, edge functions, guardas de rota. **Zero mudança de comportamento.** `0028=0`, `0025=0`, `0029=56` inalterados.

## Validação
- `tsgo` sem erros e sem `any` no arquivo refatorado.
- Suíte de governança passando (incluindo o novo teste).
