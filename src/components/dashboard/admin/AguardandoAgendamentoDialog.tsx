import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DashboardAguardandoItem } from "@/types/adminDashboard";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: DashboardAguardandoItem[];
}

const prioridadeLabel = (p: string | null) =>
  p === "alta" ? "Alta" : p === "urgente" ? "Urgente" : "Normal";

export function AguardandoAgendamentoDialog({ open, onOpenChange, items }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Assistidos Aguardando Agendamento
          </DialogTitle>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum item aguardando agendamento.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assistido</TableHead>
                <TableHead>Tratamento</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Desde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.assistido_nome}</TableCell>
                  <TableCell>{item.tratamento_nome}</TableCell>
                  <TableCell>
                    <Badge variant={item.prioridade === "alta" || item.prioridade === "urgente" ? "destructive" : "secondary"}>
                      {prioridadeLabel(item.prioridade)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
