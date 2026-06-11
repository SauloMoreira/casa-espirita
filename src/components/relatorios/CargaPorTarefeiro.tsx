import { useMemo, useState } from "react";
import ReportFilters, { FilterValues, defaultFilters } from "./ReportFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Download, Users, Calendar, CalendarCheck, CalendarX, Trophy, Activity, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { exportCsv } from "@/lib/exportCsv";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useCargaTarefeiro } from "@/hooks/useCargaTarefeiro";
import { fetchCargaTarefeiroParaExport } from "@/services/relatorios/cargaTarefeiro";
import type { CargaTarefeiroFiltros } from "@/types/relatorios";

function toFiltros(f: FilterValues): CargaTarefeiroFiltros {
  return {
    dataInicio: f.dataInicio,
    dataFim: f.dataFim,
    tratamentoId: f.tratamentoId,
    tarefeiroId: f.tarefeiroId,
  };
}

export default function CargaPorTarefeiro() {
  const [filters, setFilters] = useState<FilterValues>(defaultFilters());
  const filtros = useMemo(() => toFiltros(filters), [filters]);
  const { data, page, pageSize, loading, setPage, onPageSizeChange } = useCargaTarefeiro(filtros);

  const rows = data.rows;
  const totals = data.totais;
  const mediaSessoes = data.registros > 0 ? Math.round(totals.sessoes / data.registros) : 0;
  const maiorCarga = totals.maiorCarga ? totals.maiorCarga.split(" ")[0] : "—";

  const chartData = rows.map((r) => ({
    name: r.tarefeiro.split(" ")[0],
    Sessões: r.totalSessoes,
    Presenças: r.presencas,
    Ausências: r.ausencias,
  }));

  const handleExport = async () => {
    const all = await fetchCargaTarefeiroParaExport(filtros);
    exportCsv(
      "carga_por_tarefeiro.csv",
      ["Tarefeiro", "Assistidos", "Sessões", "Presenças", "Ausências", "Em Andamento", "Concluídos", "Tratamentos"],
      all.rows.map((r) => [r.tarefeiro, String(r.totalAssistidos), String(r.totalSessoes), String(r.presencas), String(r.ausencias), String(r.emAndamento), String(r.concluidos), r.tratamentos.join(", ")]),
    );
  };

  return (
    <div className="space-y-6">
      <ReportFilters values={filters} onChange={setFilters} show={["dataInicio", "dataFim", "tratamentoId", "tarefeiroId"]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Sessões" value={totals.sessoes} icon={Calendar} />
        <StatCard title="Assistidos Atendidos" value={totals.assistidos} icon={Users} />
        <StatCard title="Maior Carga" value={maiorCarga} icon={Trophy} />
        <StatCard title="Média Sessões/Taref." value={mediaSessoes} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Presenças" value={totals.presencas} icon={CalendarCheck} />
        <StatCard title="Ausências" value={totals.ausencias} icon={CalendarX} />
        <StatCard title="Em Andamento" value={totals.emAndamento} icon={Activity} />
        <StatCard title="Concluídos" value={totals.concluidos} icon={Activity} />
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Carga por Tarefeiro</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Sessões" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Presenças" fill="hsl(var(--chart-2, 150 60% 45%))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Ausências" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">Detalhamento</CardTitle>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarefeiro</TableHead>
                  <TableHead className="text-center">Assistidos</TableHead>
                  <TableHead className="text-center">Sessões</TableHead>
                  <TableHead className="text-center">Presenças</TableHead>
                  <TableHead className="text-center">Ausências</TableHead>
                  <TableHead className="text-center">Em Andam.</TableHead>
                  <TableHead className="text-center">Concluídos</TableHead>
                  <TableHead>Tratamentos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{loading ? "Carregando..." : "Nenhum dado encontrado"}</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.tarefeiroId}>
                    <TableCell className="font-medium">{r.tarefeiro}</TableCell>
                    <TableCell className="text-center">{r.totalAssistidos}</TableCell>
                    <TableCell className="text-center">{r.totalSessoes}</TableCell>
                    <TableCell className="text-center">{r.presencas}</TableCell>
                    <TableCell className="text-center">{r.ausencias}</TableCell>
                    <TableCell className="text-center">{r.emAndamento}</TableCell>
                    <TableCell className="text-center">{r.concluidos}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.tratamentos.join(", ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={data.registros}
            loading={loading}
            onPageChange={setPage}
            onPageSizeChange={onPageSizeChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}
