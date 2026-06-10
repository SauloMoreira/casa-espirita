import { useVoluntarios } from "@/hooks/useVoluntarios";
import { VoluntariosHeader } from "@/components/voluntarios/VoluntariosHeader";
import { VoluntariosFilters } from "@/components/voluntarios/VoluntariosFilters";
import { VoluntariosList } from "@/components/voluntarios/VoluntariosList";
import { VoluntarioFormDialog } from "@/components/voluntarios/VoluntarioFormDialog";
import { TermoAdesao } from "@/components/voluntarios/TermoAdesao";
import { FichaVoluntario } from "@/components/voluntarios/FichaVoluntario";

export default function Voluntarios() {
  const v = useVoluntarios();

  return (
    <div className="space-y-6">
      <VoluntariosHeader onNew={v.openNew} />

      <VoluntariosFilters filters={v.filters} onChange={v.setFilter} funcoes={v.allFuncoes} />

      <VoluntariosList
        voluntarios={v.filtered}
        onEdit={v.openEdit}
        onFicha={v.openFicha}
        onTermo={v.openTermo}
      />

      <VoluntarioFormDialog
        open={v.open}
        onOpenChange={v.setOpen}
        editId={v.editId}
        form={v.form}
        errors={v.errors}
        loading={v.loading}
        availableFuncoes={v.availableFuncoes}
        onChange={(patch) => v.setForm((prev) => ({ ...prev, ...patch }))}
        onToggleTipo={v.toggleTipo}
        onToggleFuncao={v.toggleFuncao}
        onSave={v.handleSave}
      />

      {v.selectedVoluntario && (
        <TermoAdesao
          open={v.termoOpen}
          onClose={() => v.setTermoOpen(false)}
          voluntario={v.selectedVoluntario}
          instituicao={v.instData}
          funcoesNomes={v.getFuncaoNames(v.selectedVoluntario.id)}
        />
      )}

      {v.selectedVoluntario && (
        <FichaVoluntario
          open={v.fichaOpen}
          onClose={() => v.setFichaOpen(false)}
          voluntario={v.selectedVoluntario}
          funcoesNomes={v.getFuncaoNames(v.selectedVoluntario.id)}
        />
      )}
    </div>
  );
}
