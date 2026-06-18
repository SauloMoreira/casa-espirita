import type { AppRole } from "@/contexts/AuthContext";

/** Functional modules used to group and filter help content. */
export type HelpModule =
  | "geral"
  | "entrevista"
  | "agenda"
  | "presenca"
  | "sessoes_publicas"
  | "whatsapp"
  | "excecoes"
  | "programacao"
  | "central_ia"
  | "assistido"
  | "voluntarios"
  | "usuarios"
  | "relatorios"
  | "governanca";

export type HelpKind = "manual" | "faq" | "guia";

/** A single block of rendered help content. */
export interface HelpBlock {
  /** Optional section heading. */
  heading?: string;
  /** Free paragraph text. */
  text?: string;
  /** Bullet list items. */
  bullets?: string[];
  /** Ordered step-by-step list. */
  steps?: string[];
  /** Highlighted attention callout. */
  note?: string;
}

export interface HelpArticle {
  id: string;
  kind: HelpKind;
  title: string;
  module: HelpModule;
  /** Roles allowed to see this article (effective access roles). */
  roles: AppRole[];
  /** When true, only Administrador Master can see it (governance/security). */
  masterOnly?: boolean;
  /** Short one-line summary shown in lists. */
  summary: string;
  /** Searchable keywords. */
  tags?: string[];
  /** Route this content is contextual to (for in-screen FAQ). */
  route?: string;
  /** Whether the content is active (governance toggle). */
  active: boolean;
  body: HelpBlock[];
}

export interface OnboardingStep {
  title: string;
  description: string;
}

export interface OnboardingFlow {
  /** Role this onboarding targets. */
  role: AppRole;
  steps: OnboardingStep[];
}

export const MODULE_LABELS: Record<HelpModule, string> = {
  geral: "Geral",
  entrevista: "Entrevistas",
  agenda: "Agenda",
  presenca: "Presença",
  sessoes_publicas: "Sessões Públicas",
  whatsapp: "Conversas WhatsApp",
  excecoes: "Exceções Operacionais",
  programacao: "Programação Padrão",
  central_ia: "Central de IA",
  assistido: "Área do Assistido",
  voluntarios: "Voluntários",
  usuarios: "Gestão de Usuários",
  relatorios: "Relatórios",
  governanca: "Governança e Segurança",
};

export const KIND_LABELS: Record<HelpKind, string> = {
  manual: "Manual",
  faq: "FAQ",
  guia: "Guia",
};
