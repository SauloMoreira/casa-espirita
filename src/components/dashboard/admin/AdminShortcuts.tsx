import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, ListChecks, Calendar, AlertTriangle, Users, type LucideIcon } from "lucide-react";

interface Props {
  onNavigate: (path: string) => void;
}

const SHORTCUTS: { label: string; path: string; icon: LucideIcon }[] = [
  { label: "Relatórios", path: "/relatorios", icon: FileText },
  { label: "Lista de Espera", path: "/lista-espera", icon: ListChecks },
  { label: "Agenda", path: "/agenda", icon: Calendar },
  { label: "Exceções", path: "/excecoes", icon: AlertTriangle },
  { label: "Assistidos", path: "/assistidos", icon: Users },
];

export function AdminShortcuts({ onNavigate }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-primary" /> Acesso Rápido
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {SHORTCUTS.map(({ label, path, icon: Icon }) => (
            <Button key={path} variant="outline" size="sm" className="gap-2 text-xs" onClick={() => onNavigate(path)}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
