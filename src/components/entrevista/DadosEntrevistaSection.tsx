import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Mic, MicOff } from "lucide-react";
import type { TipoEntrevista } from "@/types/fazerEntrevista";

interface Props {
  dataEntrevista: string;
  onDataChange: (value: string) => void;
  tipoEntrevista: TipoEntrevista;
  onTipoChange: (value: TipoEntrevista) => void;
  permitirLivre: boolean;
  minPalestras: number;
  observacoes: string;
  onObservacoesChange: (value: string) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  onAiAssistant: () => void;
  aiLoading: boolean;
}

export function DadosEntrevistaSection({
  dataEntrevista,
  onDataChange,
  tipoEntrevista,
  onTipoChange,
  permitirLivre,
  minPalestras,
  observacoes,
  onObservacoesChange,
  isRecording,
  onToggleRecording,
  onAiAssistant,
  aiLoading,
}: Props) {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Dados da Entrevista</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data da Entrevista *</Label>
            <Input type="date" value={dataEntrevista} onChange={(e) => onDataChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipoEntrevista} onValueChange={(v) => onTipoChange(v as TipoEntrevista)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular (mín. {minPalestras} palestras)</SelectItem>
                {permitirLivre && <SelectItem value="livre">Livre</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Observações</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={isRecording ? "destructive" : "outline"}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={onToggleRecording}
              >
                {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {isRecording ? "Parar Gravação" : "Gravar Voz"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={onAiAssistant}
                disabled={aiLoading || !observacoes.trim()}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Assistente IA
              </Button>
            </div>
          </div>
          {isRecording && (
            <div className="flex items-center gap-2 text-xs text-destructive animate-pulse">
              <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
              Gravando... fale normalmente
            </div>
          )}
          <Textarea
            value={observacoes}
            onChange={(e) => onObservacoesChange(e.target.value)}
            rows={5}
            placeholder="Registre observações importantes da entrevista ou use o botão Gravar Voz..."
          />
        </div>
      </CardContent>
    </Card>
  );
}
