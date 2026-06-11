import { useMemo, useState } from "react";
import ReportFilters, { FilterValues, defaultFilters } from "./ReportFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Download, CalendarX, Users, Percent, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { exportCsv } from "@/lib/exportCsv";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useFaltasPorPeriodo } from "@/hooks/useFaltasPorPeriodo";
import { fetchFaltasParaExport } from "@/services/relatorios/faltas";
import type { RelatorioPresencaFiltros } from "@/types/relatorios";

function toFiltros(f: FilterValues): RelatorioPresencaFiltros {
  return {
    dataInicio: f.dataInicio,
    dataFim: f.dataFim,
    tratamentoId: f.tratamentoId,
    assistidoId: f.assistidoId,
    tarefeiroId: f.tarefeiroId,
    coordenadorId: f.coordenadorId,
  };
}

const fmtData = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

export default function FaltasPorPeriodo() {
  const [filters, setFilters] = useState<FilterValues>(defaultFilters());
  const filtros = useMemo(() => toFiltros(filters), [filters]);
  const { data, page, pageSize, loading, setPage, onPageSizeChange } = useFaltasPorPeriodo(filtros);

  const rows = data.rows;
  const totals = data.totais;

  const chartData = rows.slice(0, 8).map((r) => ({ name: r.assistido.split(" ")[0], faltas: r.totalFaltas }));
  const colors = ["hsl(var(--destructive))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

  const handleExport = async () => {
    const all = await fetchFaltasParaExport(filtros);
    exportCsv(
      "faltas_por_periodo.csv",
      ["Assistido", "Tratamento", "Total Faltas", "Datas", "Total Sessões", "% Faltas"],
      all.rows.map((r) => [r.assistido, r.tratamento, String(r.totalFaltas), r.datasFaltas.map(fmtData).join(", "), String(r.totalSessoes), `${r.percentual}%`]),
    );
  };

  return (
    <div className="space-y-6">
      <ReportFilters values={filters} onChange={setFilters} show={["dataInicio", "dataFim", "tratamentoId", "assistidoId", "tarefeiroId", "coordenadorId"]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total de Faltas" value={totals.totalFaltas} icon={CalendarX} />
        <StatCard title="Assistidos com Falta" value={totals.assistidosComFalta} icon={Users} />
        <StatCard title="% Médio de Faltas" value={`${totals.pctMedio}%`} icon={Percent} />
        <StatCard title="Vínculos com Falta" value={totals.vinculosComFalta} icon={AlertTriangle} />
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="faltas" name="Faltas" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Bar>
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
                  <TableHead>Assistido</TableHead>
                  <TableHead>Tratamento</TableHead>
                  <TableHead className="text-center">Faltas</TableHead>
                  <TableHead>Datas</TableHead>
                  <TableHead className="text-center">Total Sessões</TableHead>
                  <TableHead className="text-center">% Faltas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{loading ? "Carregando..." : "Nenhum dado encontrado"}</TableCell></TableRow>
                ) : rows.map((r, i) => {
                  const datasFmt = r.datasFaltas.map(fmtData).join(", ");
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.assistido}</TableCell>
                      <TableCell className="text-sm">{r.tratamento}</TableCell>
                      <TableCell className="text-center font-medium">{r.totalFaltas}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{datasFmt}</TableCell>
                      <TableCell className="text-center">{r.totalSessoes}</TableCell>
                      <TableCell className="text-center font-medium">{r.percentual}%</TableCell>
                    </TableRow>
                  );
                })}
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
