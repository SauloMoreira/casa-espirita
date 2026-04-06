
# Central de Apoio e Calibração da IA — Plano Faseado

## Fase 1 — Estrutura de Dados (Migração)
Criar todas as tabelas necessárias com RLS:
- `ia_queixas` — cadastro de queixas/dores/sinais
- `ia_queixa_tratamento` — relação queixa ↔ tratamento
- `ia_biblioteca` — materiais doutrinários
- `ia_biblioteca_relacoes` — relação material ↔ queixa/tratamento
- `ia_sugestoes` — histórico de sugestões da IA
- `ia_feedback` — feedback supervisionado
- `ia_configuracoes` — configurações da IA

**Acesso:** admin (total), entrevistador (leitura + feedback)

## Fase 2 — Subárea 1: Queixas e Tratamentos
- CRUD de queixas (nome, categoria, palavras-chave, sinônimos, etc.)
- CRUD de relações queixa ↔ tratamento (prioridade, peso, tipo)
- Tabelas filtráveis e formulários

## Fase 3 — Subárea 2: Biblioteca Doutrinária
- CRUD de materiais (título, autor, tipo, tema, upload de arquivo)
- Associação material ↔ queixas/tratamentos
- Toggle "usar na IA"

## Fase 4 — Subárea 3: Sugestões da IA
- Registro automático das sugestões ao usar o Assistente IA na entrevista
- Listagem histórica com filtros

## Fase 5 — Subárea 4: Feedback e Aprendizado
- Comparação sugestão IA × atribuição final
- Classificação (acertou totalmente / parcialmente / inadequada)
- Registro de motivo e observações

## Fase 6 — Subárea 5: Indicadores de Assertividade
- Cards-resumo e gráficos (taxa de aderência, divergência, evolução)

## Fase 7 — Subárea 6: Configurações da IA
- Painel de pesos, toggles e parâmetros

## Fase 8 — Integração com o Assistente IA
- Alterar a edge function `assistente-entrevista` para consultar a base de queixas, biblioteca e histórico supervisionado
- Gravar automaticamente as sugestões em `ia_sugestoes`

---

**Recomendação:** Implementar fase por fase, validando cada uma antes de avançar. Começar pela **Fase 1 (migração)** + **Fase 2 (Queixas e Tratamentos)**.

Deseja que eu inicie pela Fase 1 (criação das tabelas) e Fase 2 (tela de Queixas e Tratamentos)?
