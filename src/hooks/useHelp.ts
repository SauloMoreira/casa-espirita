import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { HELP_ARTICLES, ONBOARDING_FLOWS } from "@/lib/help/helpContent";
import { visibleArticles, matchesQuery } from "@/lib/help/helpVisibility";
import type { HelpArticle, HelpModule, HelpKind } from "@/lib/help/types";

export interface UseHelpFilters {
  query?: string;
  module?: HelpModule | "all";
  kind?: HelpKind | "all";
}

/**
 * Central hook exposing role-aware help content. Visibility is based on the
 * user's effective access roles (the union of roles assigned to the account).
 */
export function useHelp() {
  const { roles, role, isMaster } = useAuth();

  // Effective roles: raw roles array, falling back to the resolved single role.
  const effectiveRoles = useMemo(() => {
    if (roles && roles.length > 0) return roles;
    return role ? [role] : [];
  }, [roles, role]);

  const allVisible = useMemo(
    () => visibleArticles(HELP_ARTICLES, effectiveRoles, isMaster),
    [effectiveRoles, isMaster],
  );

  const onboarding = useMemo(() => {
    // Prefer the most privileged onboarding the user qualifies for.
    const priority = [
      "administrador_master",
      "admin",
      "coordenador_de_tratamento",
      "entrevistador",
      "tarefeiro",
      "assistido",
    ] as const;
    for (const r of priority) {
      if (r === "administrador_master" && isMaster) {
        return ONBOARDING_FLOWS.find((f) => f.role === "admin") ?? null;
      }
      if (effectiveRoles.includes(r as any)) {
        return ONBOARDING_FLOWS.find((f) => f.role === r) ?? null;
      }
    }
    return null;
  }, [effectiveRoles, isMaster]);

  const filter = (filters: UseHelpFilters): HelpArticle[] => {
    return allVisible.filter((a) => {
      if (filters.module && filters.module !== "all" && a.module !== filters.module) return false;
      if (filters.kind && filters.kind !== "all" && a.kind !== filters.kind) return false;
      if (filters.query && !matchesQuery(a, filters.query)) return false;
      return true;
    });
  };

  /** Help articles contextual to a given screen route. */
  const forRoute = (route: string): HelpArticle[] =>
    allVisible.filter((a) => a.route === route);

  return { effectiveRoles, isMaster, articles: allVisible, onboarding, filter, forRoute };
}
