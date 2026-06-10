import { StatCard } from "@/components/StatCard";
import { Users, Heart, Calendar, ClipboardCheck, Hourglass, CheckCircle } from "lucide-react";

interface Props {
  assistidosCount: number;
  tratAtivos: number;
  entAgendadas: number;
  presencasHoje: number;
  listaEspera: number;
  tratConcluidos: number;
}

export function AdminMainCards({
  assistidosCount,
  tratAtivos,
  entAgendadas,
  presencasHoje,
  listaEspera,
  tratConcluidos,
}: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard title="Assistidos" value={assistidosCount} subtitle="Cadastrados" icon={Users} />
      <StatCard title="Trat. Ativos" value={tratAtivos} subtitle="Em andamento" icon={Heart} />
      <StatCard title="Entrev. Agendadas" value={entAgendadas} subtitle="Pendentes" icon={Calendar} />
      <StatCard title="Presenças Hoje" value={presencasHoje} subtitle="Registradas" icon={ClipboardCheck} />
      <StatCard title="Lista de Espera" value={listaEspera} subtitle="Aguardando" icon={Hourglass} />
      <StatCard title="Concluídos" value={tratConcluidos} subtitle="No período" icon={CheckCircle} />
    </div>
  );
}
