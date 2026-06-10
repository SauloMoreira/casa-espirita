import { Button } from "@/components/ui/button";

interface Props {
  onCancelar: () => void;
  onSalvar: () => void;
  saving: boolean;
  isApto: boolean;
}

export function EntrevistaActionsFooter({ onCancelar, onSalvar, saving, isApto }: Props) {
  return (
    <div className="flex gap-3 pb-6">
      <Button variant="outline" onClick={onCancelar} className="flex-1 sm:flex-none">
        Cancelar
      </Button>
      <Button onClick={onSalvar} disabled={saving || !isApto} className="flex-1 sm:flex-none gap-2">
        {saving ? "Salvando..." : "Concluir Entrevista"}
      </Button>
    </div>
  );
}
