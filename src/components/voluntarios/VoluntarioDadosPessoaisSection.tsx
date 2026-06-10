import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoUpload } from "@/components/PhotoUpload";
import { maskCPF, maskPhone } from "@/lib/validators";
import type { VoluntarioFormErrors, VoluntarioFormState } from "@/types/voluntarios";

interface Props {
  form: VoluntarioFormState;
  errors: VoluntarioFormErrors;
  onChange: (patch: Partial<VoluntarioFormState>) => void;
}

export function VoluntarioDadosPessoaisSection({ form, errors, onChange }: Props) {
  return (
    <>
      <div className="flex justify-center">
        <PhotoUpload
          currentUrl={form.foto_url}
          onUrlChange={(url) => onChange({ foto_url: url })}
          folder="voluntarios"
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Dados Pessoais
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <Label>Nome Completo *</Label>
            <Input
              value={form.nome_completo}
              onChange={(e) => onChange({ nome_completo: e.target.value })}
              className={errors.nome_completo ? "border-destructive" : ""}
            />
            {errors.nome_completo && <p className="text-xs text-destructive">{errors.nome_completo}</p>}
          </div>
          <div className="space-y-1">
            <Label>CPF *</Label>
            <Input
              value={form.cpf}
              onChange={(e) => onChange({ cpf: maskCPF(e.target.value) })}
              placeholder="000.000.000-00"
              maxLength={14}
              className={errors.cpf ? "border-destructive" : ""}
            />
            {errors.cpf && <p className="text-xs text-destructive">{errors.cpf}</p>}
          </div>
          <div className="space-y-1">
            <Label>RG</Label>
            <Input value={form.rg} onChange={(e) => onChange({ rg: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Celular *</Label>
            <Input
              value={form.celular}
              onChange={(e) => onChange({ celular: maskPhone(e.target.value) })}
              placeholder="(00) 00000-0000"
              maxLength={15}
              className={errors.celular ? "border-destructive" : ""}
            />
            {errors.celular && <p className="text-xs text-destructive">{errors.celular}</p>}
          </div>
          <div className="space-y-1">
            <Label>E-mail *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => onChange({ email: e.target.value })}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1">
            <Label>Data de Nascimento *</Label>
            <Input
              type="date"
              value={form.data_nascimento}
              onChange={(e) => onChange({ data_nascimento: e.target.value })}
              className={errors.data_nascimento ? "border-destructive" : ""}
            />
            {errors.data_nascimento && <p className="text-xs text-destructive">{errors.data_nascimento}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
