import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";
import { maskCPF, maskPhone } from "@/lib/validators";
import { ENTREVISTA_STATUS_LABELS } from "@/constants/fazerEntrevista";
import type { EntrevistaAssistido, TipoEntrevista } from "@/types/fazerEntrevista";

interface Props {
  assistido: EntrevistaAssistido;
  tipoEntrevista: TipoEntrevista;
  minPalestras: number;
  onTrocar: () => void;
}

export function AssistidoSummaryCard({ assistido, tipoEntrevista, minPalestras, onTrocar }: Props) {
  const apto = assistido.quantidade_palestras >= minPalestras;
  return (
    <Card className="glass-card border-primary/20">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold truncate">{assistido.nome}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
              <span>{assistido.cpf ? maskCPF(assistido.cpf) : "Sem CPF"}</span>
              <span>{assistido.celular ? maskPhone(assistido.celular) : "Sem celular"}</span>
              <span>{assistido.quantidade_palestras} palestra(s)</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {ENTREVISTA_STATUS_LABELS[assistido.status] || assistido.status}
              </Badge>
              {tipoEntrevista === "regular" && apto && (
                <Badge variant="default" className="text-xs gap-1">
                  <CheckCircle className="h-3 w-3" /> Apto
                </Badge>
              )}
              {tipoEntrevista === "regular" && !apto && (
                <Badge variant="destructive" className="text-xs">
                  Não apto (mín. {minPalestras} palestras)
                </Badge>
              )}
              {tipoEntrevista === "livre" && (
                <Badge variant="outline" className="text-xs">
                  Entrevista Livre
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onTrocar}
            className="shrink-0 text-muted-foreground"
          >
            Trocar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
