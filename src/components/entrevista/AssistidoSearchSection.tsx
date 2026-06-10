import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus } from "lucide-react";
import { maskCPF, maskPhone } from "@/lib/validators";
import { ENTREVISTA_STATUS_LABELS } from "@/constants/fazerEntrevista";
import type { EntrevistaAssistido } from "@/types/fazerEntrevista";

interface Props {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  filteredAssistidos: EntrevistaAssistido[];
  onSelect: (a: EntrevistaAssistido) => void;
  onNovo: () => void;
}

export function AssistidoSearchSection({
  searchTerm,
  onSearchTermChange,
  filteredAssistidos,
  onSelect,
  onNovo,
}: Props) {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Buscar Assistido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou celular..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" className="gap-1 shrink-0" onClick={onNovo}>
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo</span>
          </Button>
        </div>

        {filteredAssistidos.length > 0 && (
          <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
            {filteredAssistidos.map((a) => (
              <button
                key={a.id}
                className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-center justify-between gap-2"
                onClick={() => onSelect(a)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.cpf ? maskCPF(a.cpf) : "Sem CPF"} ·{" "}
                    {a.celular ? maskPhone(a.celular) : "Sem celular"}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {ENTREVISTA_STATUS_LABELS[a.status] || a.status}
                </Badge>
              </button>
            ))}
          </div>
        )}

        {searchTerm.trim() && filteredAssistidos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-3">
            Nenhum assistido encontrado
          </p>
        )}
      </CardContent>
    </Card>
  );
}
