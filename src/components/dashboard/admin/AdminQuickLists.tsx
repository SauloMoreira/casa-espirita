import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getEntrevistaStatusLabel } from "@/constants/dashboard";
import type { DashboardEntrevistaRecente, DashboardGraficoSerie } from "@/types/adminDashboard";

interface Props {
  entRecentes: DashboardEntrevistaRecente[];
  ageData: DashboardGraficoSerie[];
  totalAssistidos: number;
}

export function AdminQuickLists({ entRecentes, ageData, totalAssistidos }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Entrevistas Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entRecentes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <BookOpen className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma entrevista registrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entRecentes.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{e.assistido_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(e.data), "dd/MM/yyyy HH:mm", { locale: ptBR })} • {e.entrevistador_nome}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{getEntrevistaStatusLabel(e.status)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Distribuição por Faixa Etária
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Faixa</TableHead>
                <TableHead className="text-center">Qtde</TableHead>
                <TableHead className="text-center">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ageData.map((a) => (
                <TableRow key={a.name}>
                  <TableCell className="text-sm font-medium">{a.name}</TableCell>
                  <TableCell className="text-center">{a.value}</TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {totalAssistidos > 0 ? ((a.value / totalAssistidos) * 100).toFixed(1) + "%" : "0%"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
