# Performance & Escalabilidade — Documentação Final

Resumo consolidado da frente de performance (Sprints 1–5). Esta frente está
**encerrada**, com os pontos residuais considerados aceitáveis.

## 1. O que foi otimizado

- **Índices** nas consultas críticas (assistidos, tratamentos, entrevistas,
  presenças, agenda).
- **Paginação real (server-side)** em listas e relatórios de maior volume,
  com utilitários puros testados (`src/lib/pagination.ts`) e componente
  reutilizável (`src/components/ui/pagination-controls.tsx`).
- **Agregações movidas para o backend** via RPCs `SECURITY DEFINER`, eliminando
  recomputações pesadas no frontend.
- **Dashboard Administrativo** consolidado em uma única RPC (`dashboard_admin`),
  substituindo ~14 consultas e agregações no cliente.

## 2. Áreas paginadas (server-side)

- Assistidos
- Voluntários
- Relatório de Frequência de Presença
- Relatório de Faltas por Período
- Relatório de Tratamentos Concluídos
- Relatório de Carga por Tarefeiro

## 3. Relatórios/painéis que passaram a usar backend

| Área                       | RPC                               |
| -------------------------- | --------------------------------- |
| Frequência de Presença     | `relatorio_frequencia_presenca`   |
| Faltas por Período         | `relatorio_faltas_periodo`        |
| Tratamentos Concluídos     | `relatorio_tratamentos_concluidos`|
| Carga por Tarefeiro        | `relatorio_carga_tarefeiro`       |
| Dashboard Administrativo   | `dashboard_admin`                 |

Todas respeitam visibilidade por perfil (admin, coordenador, tarefeiro) e os
filtros de UI. Exportações usam `EXPORT_PAGE_SIZE` para manter o CSV coerente
com a tabela filtrada.

## 4. Observabilidade de performance (Sprint 5)

- Utilitário leve em `src/lib/perfMonitor.ts`:
  - `measureAsync(label, fn)` mede o tempo de resposta de operações
    assíncronas (RPCs/consultas) e registra a métrica.
  - Operações acima de `SLOW_THRESHOLD_MS` (800ms) ou com erro são logadas
    como aviso no console (`[perf] ...`).
  - `getSummary()` agrega por rótulo (média, máximo, lentas, erros) a partir de
    um buffer circular das últimas `METRICS_CAPACITY` (100) medições.
- Instrumentado nas RPCs mais críticas:
  - `rpc:dashboard_admin`
  - `rpc:relatorio_frequencia_presenca`

## 5. Latências observadas (snapshot)

A partir do `pg_stat_statements` no momento do fechamento da frente:

- `assistido_tratamentos` (listagens paginadas): média ~50–110ms, máx ~328ms.
- `entrevistas_fraternas` (por status): média ~58ms, máx ~190ms.
- RPCs de relatório/dashboard: dentro do limiar aceitável para o volume atual.

Valores variam com o volume e a concorrência; usar `perfMonitor` no cliente e
`slow_queries` no backend para acompanhamento contínuo.

## 6. Ajustes de UX (maior volume)

- `PaginationControls` exibe estado de carregamento ("Carregando...") e o
  intervalo "X–Y de Z".
- `TableSkeleton` (`src/components/ui/table-skeleton.tsx`) disponível para
  estados de carregamento estáveis (sem "saltos" de layout) em tabelas/listas.

## 7. Pontos residuais aceitáveis

- Listagens de `assistido_tratamentos` com picos pontuais (<330ms) sob
  concorrência — dentro do esperado e mitigado por índices e paginação.
- Sob crescimento expressivo da base, considerar aumentar o tamanho da
  instância do Lovable Cloud (Backend → Advanced settings).
