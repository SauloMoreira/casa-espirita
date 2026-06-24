# Suíte de Governança — Invariantes & Contratos

Esta pasta converte a governança do projeto em **proteção executável**. Cada teste
aponta explicitamente a invariante (`INV-*`) ou o contrato que protege, de modo que,
quando um teste falha, fique claro **qual regra estrutural foi violada**.

Fontes oficiais confrontadas:

- `docs/INVARIANTES.md` (catálogo `INV-*`)
- `docs/MATRIZ-EVENTOS-EFEITOS.md` (eventos/efeitos)
- `docs/BACKLOG-GOVERNANCA.md` (lacunas e achados)

## Organização por blocos de governança

| Arquivo | Domínio | Invariantes / contratos |
| --- | --- | --- |
| `invariantes-agenda-tratamento.test.ts` | Agenda e tratamento | INV-AGD-002/003/004, INV-FILA-002/003 |
| `invariantes-fila-notificacoes.test.ts` | Fila / notificações | INV-FILA-001/004/005/006 |
| `invariantes-temporais.test.ts` | Semântica temporal | INV-TEMPO-001/002/003 |
| `invariantes-excecao-operacional.test.ts` | Exceção operacional | INV-EXC-001/002/003 |
| `invariantes-acao-manual.test.ts` | Ação manual / humana | INV-MANUAL-001/002/003 |
| `invariantes-presenca.test.ts` | Presença geral × operacional | INV-PRES-001/002 |
| `contratos-backend-critico.test.ts` | Contratos de backend | espelhos de `fn_fila_motivo_inelegivel`, `fn_presenca_classificacao` |
| `contratos-governanca-parametros.test.ts` | Governança de parâmetros | espelho de `fn_atualizar_parametro_operacional` |
| `contratos-central.test.ts` | Contratos da Central | diagnósticos, rótulos e motivos |
| `regressao-bugs-historicos.test.ts` | Regressão permanente | bugs já dolorosos que não podem voltar |

## Princípio anti-duplicação

Estes testes **não criam semântica paralela**. Eles exercitam os espelhos oficiais já
existentes (`notificacaoElegibilidade.ts`, `presencaClassificacao.ts`, `notificacoes.ts`,
`parametrosOperacionais.ts`), que por contrato refletem as funções de banco
(`fn_*`). Se backend e espelho divergirem, o contrato falha aqui.
