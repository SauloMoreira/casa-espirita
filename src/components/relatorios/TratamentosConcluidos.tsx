import { useMemo, useState } from "react";
import ReportFilters, { FilterValues, defaultFilters } from "./ReportFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Download, CheckCircle, Users, Activity, Calendar, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { exportCsv } from "@/lib/exportCsv";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useTratamentosConcluidos } from "@/hooks/useTratamentosConcluidos";
import { fetchTratamentosConcluidosParaExport } from "@/services/relatorios/tratamentosConcluidos";
import type { TratamentosConcluidosFiltros } from "@/types/relatorios";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 220 70% 50%))",
  "hsl(var(--chart-3, 150 60% 45%))",
  "hsl(var(--chart-4, 40 80% 55%))",
  "hsl(var(--chart-5, 280 60% 55%))",
];

function toFiltros(f: FilterValues): TratamentosConcluidosFiltros {
  return {
    dataInicio: f.dataInicio,
    dataFim: f.dataFim,
    tratamentoId: f.tratamentoId,
    tipoTratamento: f.tipoTratamento,
    tarefeiroId: f.tarefeiroId,
    coordenadorId: f.coordenadorId,
  };
}

export default function TratamentosConcluidos() {
  const [filters, setFilters] = useState<FilterValues>(defaultFilters());
  const filtros = useMemo(() => toFiltros(filters), [filters]);
  const { data, page, pageSize, loading, setPage, onPageSizeChange } = useTratamentosConcluidos(filtros);

  const rows = data.rows;
  const totais = data.totais;

  const barData = data.porTratamento.map((t) => ({
    name: t.nome.length > 15 ? t.nome.slice(0, 15) + "…" : t.nome,
    Concluídos: t.count,
  }));
  const pieData = data.porTipo.map((t) => ({ name: t.nome, value: t.count }));
  const topTratamento = barData.length > 0 ? barData[0].name : "—";

  const handleExport = async () => {
    const all = await fetchTratamentosConcluidosParaExport(filtros);
    exportCsv(
      "tratamentos_concluidos.csv",
      ["Assistido", "Tratamento", "Tipo", "Início", "Conclusão", "Total", "Realizada", "Tarefeiro", "Coordenador", "Status"],
      all.rows.map((r) => [r.assistido, r.tratamento, r.tipoTratamento, r.dataInicio ?? "—", r.dataConclusao, String(r.total), String(r.realizada), r.tarefeiro, r.coordenador, "Concluído"]),
    );
  };

  return (
    <div className="space-y-6">
      <ReportFilters values={filters} onChange={setFilters} show={["dataInicio", "dataFim", "tratamentoId", "tipoTratamento", "tarefeiroId", "coordenadorId"]} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Concluídos" value={totais.total} icon={CheckCircle} />
        <StatCard title="Assistidos" value={totais.assistidos} icon={Users} />
        <StatCard title="Tipos Tratamento" value={totais.tipos} icon={Activity} />
        <StatCard title="Sessões Realizadas" value={totais.sessoes} icon={Calendar} />
        <StatCard title="Mais Concluído" value={topTratamento} icon={Trophy} />
      </div>

      {(barData.length > 0 || pieData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {barData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Concluídos por Tratamento</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="Concluídos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {pieData.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Distribuição por Tipo</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Conclusão</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Realiz.</TableHead>
                  <TableHead>Tarefeiro</TableHead>
                  <TableHead>Coordenador</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">{loading ? "Carregando..." : "Nenhum dado encontrado"}</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.assistido}</TableCell>
                    <TableCell className="text-sm">{r.tratamento}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.tipoTratamento}</TableCell>
                    <TableCell className="text-sm">{r.dataInicio}</TableCell>
                    <TableCell className="text-sm">{r.dataConclusao}</TableCell>
                    <TableCell className="text-center">{r.total}</TableCell>
                    <TableCell className="text-center">{r.realizada}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.tarefeiro}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.coordenador}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">Concluído</Badge></TableCell>
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
