import { useAuth } from "@/contexts/AuthContext";
import { ROLE } from "@/constants/roles";
import AdminDashboard from "./dashboard/AdminDashboard";
import EntrevistadorDashboard from "./dashboard/EntrevistadorDashboard";
import TarefeiroDashboard from "./dashboard/TarefeiroDashboard";
import AssistidoDashboard from "./dashboard/AssistidoDashboard";
import CoordenadorDashboard from "./dashboard/CoordenadorDashboard";

export default function Dashboard() {
  const { role } = useAuth();

  switch (role) {
    case ROLE.ADMIN:
      return <AdminDashboard />;
    case ROLE.ENTREVISTADOR:
      return <EntrevistadorDashboard />;
    case ROLE.TAREFEIRO:
      return <TarefeiroDashboard />;
    case ROLE.ASSISTIDO:
      return <AssistidoDashboard />;
    case ROLE.COORDENADOR_DE_TRATAMENTO:
      return <CoordenadorDashboard />;
    default:
      return <AssistidoDashboard />;
  }
}
