
# Fase 2 — Relatórios Operacionais e Gerenciais

## Arquitetura
- **Página hub** (`Relatorios.tsx`): grid de cards clicáveis que abrem cada relatório inline (tabs ou estado)
- **6 componentes de relatório** em `src/components/relatorios/`:
  1. `AssistidosPorTratamento.tsx`
  2. `FrequenciaPresenca.tsx`
  3. `EntrevistasRealizadas.tsx`
  4. `TratamentosConcluidos.tsx`
  5. `FaltasPorPeriodo.tsx`
  6. `CargaPorTarefeiro.tsx`
- **Componente reutilizável** `ReportFilters.tsx` para filtros de período, tratamento, tarefeiro, coordenador, assistido
- **Utilitário** `exportCsv.ts` para exportação CSV respeitando filtros

## Fontes de dados (sempre dados reais)
- `agenda_tratamentos_assistido` → sessões reais agendadas
- `presencas_tratamentos` → presenças/ausências registradas
- `assistido_tratamentos` → vínculos e status
- `tipos_tratamento` → dados do tratamento
- `assistidos` → dados do assistido
- `entrevistas_fraternas` → entrevistas realizadas
- `profiles` → nomes de tarefeiros/coordenadores/entrevistadores

## Cada relatório terá
- Filtros no topo (período + filtros específicos)
- Cards-resumo com totais
- Gráfico simples (barras ou pizza via Recharts, já instalado)
- Tabela detalhada
- Botão "Exportar CSV"

## Permissões
- Rota aberta para `admin`, `entrevistador`, `coordenador_de_tratamento`, `tarefeiro`
- Dados filtrados por role no frontend (coordenador vê só seus tratamentos, tarefeiro só os seus)
- Assistido não acessa

## Etapas de implementação
1. Criar utilitário de exportação CSV
2. Criar componente de filtros reutilizável
3. Criar os 6 componentes de relatório
4. Refatorar `Relatorios.tsx` como hub com navegação para cada relatório
5. Atualizar rota no `App.tsx` para incluir perfis permitidos
6. Validar build
