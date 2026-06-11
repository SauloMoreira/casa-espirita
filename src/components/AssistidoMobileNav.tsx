import { NavLink } from "react-router-dom";
import { LayoutDashboard, Calendar, Heart, Bell, User } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { useAvisos } from "@/hooks/useAvisos";
import { cn } from "@/lib/utils";

const items = [
  { title: "Painel", url: ROUTES.dashboard, icon: LayoutDashboard },
  { title: "Agenda", url: ROUTES.minhaAgenda, icon: Calendar },
  { title: "Tratamentos", url: ROUTES.meusTratamentos, icon: Heart },
  { title: "Avisos", url: ROUTES.notificacoes, icon: Bell, badge: true },
  { title: "Perfil", url: ROUTES.meuPerfil, icon: User },
];

/**
 * Barra de navegação inferior exclusiva do assistido no mobile.
 * Visível apenas em telas pequenas; no desktop a sidebar continua sendo usada.
 */
export function AssistidoMobileNav() {
  const { naoLidos } = useAvisos();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação do assistido"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => (
          <li key={item.url}>
            <NavLink
              to={item.url}
              end={item.url === ROUTES.dashboard}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <item.icon className={cn("h-5 w-5", isActive && "scale-110 transition-transform")} />
                    {item.badge && naoLidos > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                        {naoLidos > 9 ? "9+" : naoLidos}
                      </span>
                    )}
                  </span>
                  <span>{item.title}</span>
                  {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
