import { useAuth } from "@/contexts/AuthContext";
import AdminDashboard from "./dashboard/AdminDashboard";
import EntrevistadorDashboard from "./dashboard/EntrevistadorDashboard";
import TarefeiroDashboard from "./dashboard/TarefeiroDashboard";
import AssistidoDashboard from "./dashboard/AssistidoDashboard";
import CoordenadorDashboard from "./dashboard/CoordenadorDashboard";

export default function Dashboard() {
  const { role } = useAuth();

  switch (role) {
    case "admin":
      return <AdminDashboard />;
    case "entrevistador":
      return <EntrevistadorDashboard />;
    case "tarefeiro":
      return <TarefeiroDashboard />;
    case "assistido":
      return <AssistidoDashboard />;
    case "coordenador_de_tratamento":
      return <CoordenadorDashboard />;
    default:
      return <AssistidoDashboard />;
  }
}
