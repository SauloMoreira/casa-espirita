import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import minhasNotificacoesTool from "./tools/minhas-notificacoes";

// The OAuth issuer MUST be the direct Supabase host, built from the project ref
// (Vite inlines this literal at build time, keeping the module import-safe).
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "fer-mcp",
  title: "FER — Gestão de Tratamentos MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas da plataforma FER de gestão de tratamentos. Use `whoami` para confirmar quem é o usuário conectado e `minhas_notificacoes` para consultar avisos internos. Todas as ferramentas operam apenas sobre os dados do próprio usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, minhasNotificacoesTool],
});
