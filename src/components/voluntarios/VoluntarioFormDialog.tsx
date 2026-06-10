import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VoluntarioDadosPessoaisSection } from "./VoluntarioDadosPessoaisSection";
import { VoluntarioEnderecoSection } from "./VoluntarioEnderecoSection";
import { VoluntarioTipoFuncaoSection } from "./VoluntarioTipoFuncaoSection";
import type {
  FuncaoVoluntariado,
  VoluntarioFormErrors,
  VoluntarioFormState,
} from "@/types/voluntarios";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId: string | null;
  form: VoluntarioFormState;
  errors: VoluntarioFormErrors;
  loading: boolean;
  availableFuncoes: FuncaoVoluntariado[];
  onChange: (patch: Partial<VoluntarioFormState>) => void;
  onToggleTipo: (tipo: string) => void;
  onToggleFuncao: (funcaoId: string) => void;
  onSave: () => void;
}

export function VoluntarioFormDialog({
  open,
  onOpenChange,
  editId,
  form,
  errors,
  loading,
  availableFuncoes,
  onChange,
  onToggleTipo,
  onToggleFuncao,
  onSave,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editId ? "Editar Voluntário" : "Novo Voluntário"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <VoluntarioDadosPessoaisSection form={form} errors={errors} onChange={onChange} />
          <VoluntarioEnderecoSection form={form} errors={errors} onChange={onChange} />
          <VoluntarioTipoFuncaoSection
            form={form}
            errors={errors}
            availableFuncoes={availableFuncoes}
            onChange={onChange}
            onToggleTipo={onToggleTipo}
            onToggleFuncao={onToggleFuncao}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={onSave} disabled={loading}>
              {loading ? "Salvando..." : editId ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
