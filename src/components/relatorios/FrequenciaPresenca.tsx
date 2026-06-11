import { useMemo, useState } from "react";
import ReportFilters, { FilterValues, defaultFilters } from "./ReportFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Download, CalendarCheck, CalendarX, Percent, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { exportCsv } from "@/lib/exportCsv";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useFrequenciaPresenca } from "@/hooks/useFrequenciaPresenca";
import { fetchFrequenciaParaExport } from "@/services/relatorios/frequencia";
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

export default function FrequenciaPresenca() {
  const [filters, setFilters] = useState<FilterValues>(defaultFilters());
  const filtros = useMemo(() => toFiltros(filters), [filters]);
  const { data, page, pageSize, loading, setPage, onPageSizeChange } = useFrequenciaPresenca(filtros);

  const rows = data.rows;
  const totals = data.totais;
  const pctGeral = totals.total > 0 ? Math.round((totals.presencas / totals.total) * 100) : 0;

  const chartData = rows.slice(0, 10).map((r) => ({ name: r.nome.split(" ")[0], Presenças: r.presencas, Ausências: r.ausencias }));

  const handleExport = async () => {
    const all = await fetchFrequenciaParaExport(filtros);
    exportCsv(
      "frequencia_presenca.csv",
      ["Assistido", "Tratamento", "Presenças", "Ausências", "Total", "% Presença"],
      all.rows.map((r) => [r.nome, r.tratamento, String(r.presencas), String(r.ausencias), String(r.total), `${r.percentual}%`]),
    );
  };

  return (
    <div className="space-y-6">
      <ReportFilters values={filters} onChange={setFilters} show={["dataInicio", "dataFim", "tratamentoId", "assistidoId", "tarefeiroId", "coordenadorId"]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Sessões" value={totals.total} icon={Calendar} />
        <StatCard title="Presenças" value={totals.presencas} icon={CalendarCheck} />
        <StatCard title="Ausências" value={totals.ausencias} icon={CalendarX} />
        <StatCard title="% Presença" value={`${pctGeral}%`} icon={Percent} />
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Presenças" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
                  <TableHead>Assistido</TableHead>
                  <TableHead>Tratamento</TableHead>
                  <TableHead className="text-center">Presenças</TableHead>
                  <TableHead className="text-center">Ausências</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">% Presença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{loading ? "Carregando..." : "Nenhum dado encontrado"}</TableCell></TableRow>
                ) : rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.tratamento}</TableCell>
                    <TableCell className="text-center">{r.presencas}</TableCell>
                    <TableCell className="text-center">{r.ausencias}</TableCell>
                    <TableCell className="text-center">{r.total}</TableCell>
                    <TableCell className="text-center font-medium">{r.percentual}%</TableCell>
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
