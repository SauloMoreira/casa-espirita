import { useAuth, AppRole } from "@/contexts/AuthContext";
import AdminDashboard from "./dashboard/AdminDashboard";
import EntrevistadorDashboard from "./dashboard/EntrevistadorDashboard";
import TarefeiroDashboard from "./dashboard/TarefeiroDashboard";
import AssistidoDashboard from "./dashboard/AssistidoDashboard";
import CoordenadorDashboard from "./dashboard/CoordenadorDashboard";

const DASHBOARD_BY_ROLE: Partial<Record<AppRole, JSX.Element>> = {
  admin: <AdminDashboard />,
  coordenador_de_tratamento: <CoordenadorDashboard />,
  entrevistador: <EntrevistadorDashboard />,
  tarefeiro: <TarefeiroDashboard />,
  assistido: <AssistidoDashboard />,
};

export default function Dashboard() {
  const { visibleRoles } = useAuth();

  const sections = visibleRoles
    .map((r) => DASHBOARD_BY_ROLE[r])
    .filter(Boolean) as JSX.Element[];

  if (sections.length === 0) return <AssistidoDashboard />;
  if (sections.length === 1) return sections[0];

  return (
    <div className="space-y-10">
      {sections.map((section, i) => (
        <section key={i}>{section}</section>
      ))}
    </div>
  );
}
