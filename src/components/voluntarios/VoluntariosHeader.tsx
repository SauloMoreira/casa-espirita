import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface Props {
  onNew: () => void;
}

export function VoluntariosHeader({ onNew }: Props) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Voluntários</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro e gestão de voluntários da instituição
        </p>
      </div>
      <Button onClick={onNew} className="gap-2">
        <Plus className="h-4 w-4" /> Novo Voluntário
      </Button>
    </div>
  );
}
