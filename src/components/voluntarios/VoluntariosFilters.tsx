import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { STATUS_LABELS, TIPOS_VOLUNTARIO, FILTER_TODOS } from "@/constants/voluntarios";
import type { FuncaoVoluntariado, VoluntarioFilterState } from "@/types/voluntarios";

interface Props {
  filters: VoluntarioFilterState;
  onChange: <K extends keyof VoluntarioFilterState>(key: K, value: VoluntarioFilterState[K]) => void;
  funcoes: FuncaoVoluntariado[];
}

export function VoluntariosFilters({ filters, onChange, funcoes }: Props) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => onChange("search", e.target.value)}
              placeholder="Buscar por nome, CPF, celular ou e-mail..."
              className="pl-10"
            />
          </div>
          <Select value={filters.status} onValueChange={(v) => onChange("status", v)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_TODOS}>Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.tipo} onValueChange={(v) => onChange("tipo", v)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_TODOS}>Todos</SelectItem>
              {TIPOS_VOLUNTARIO.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.funcao} onValueChange={(v) => onChange("funcao", v)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Função" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_TODOS}>Todas as Funções</SelectItem>
              {funcoes.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome_funcao} ({f.tipo_voluntario})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
