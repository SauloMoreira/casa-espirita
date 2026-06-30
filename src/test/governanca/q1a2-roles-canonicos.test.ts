import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { APP_ROLES, ROLE, GERENCIAL_ROLES } from "@/constants/roles";

/**
 * Q1-A2 — Consolidação segura de roles/enums (teste PURO de governança).
 *
 * Não acessa banco vivo. Confronta:
 *  1) Paridade `app_role` (gerado em types.ts) × fonte canônica TS (APP_ROLES/ROLE).
 *  2) Trava de regressão: arquivos consolidados no Q1-A2 não voltam a usar
 *     literais de role soltos (devem usar `ROLE`/grupos de `roles.ts`).
 *  3) Allowlist explícita: arquivos que, por arquitetura, ainda podem conter
 *     literais de role (consumidores de menu/rota/ajuda) — documentado, não falha.
 *
 * Paridade `notif_evento` real e check constraints ficam na suíte de integração
 * de banco (`src/test/integration/db`), pois exigem schema vivo.
 */

const root = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

/** Extrai os valores reais do enum `app_role` do arquivo gerado types.ts. */
function appRoleFromTypes(): string[] {
  const src = read("src/integrations/supabase/types.ts");
  const block = src.slice(src.indexOf("app_role:"));
  const values: string[] = [];
  for (const line of block.split("\n").slice(1)) {
    const m = line.match(/^\s*\|\s*"([a-z_]+)"\s*$/);
    if (m) {
      values.push(m[1]);
      continue;
    }
    // primeira linha do enum vem sem o pipe inicial
    const first = line.match(/^\s*"([a-z_]+)"\s*$/);
    if (first && values.length === 0) {
      values.push(first[1]);
      continue;
    }
    if (values.length > 0 && !/^\s*\|/.test(line)) break;
  }
  return values;
}

describe("Q1-A2 — paridade canônica de roles (puro)", () => {
  it("app_role (types.ts) == APP_ROLES (fonte canônica TS)", () => {
    const fromTypes = new Set(appRoleFromTypes());
    const fromTs = new Set(APP_ROLES);
    expect([...fromTs].sort()).toEqual([...fromTypes].sort());
  });

  it("constantes ROLE.* refletem exatamente o conjunto canônico", () => {
    expect(new Set(Object.values(ROLE))).toEqual(new Set(APP_ROLES));
  });

  it("GERENCIAL_ROLES é subconjunto válido de APP_ROLES", () => {
    for (const r of GERENCIAL_ROLES) expect(APP_ROLES).toContain(r);
  });
});

/**
 * Arquivos consolidados nesta etapa — não podem reintroduzir literal de role
 * em decisão de visibilidade/roteamento/troca de view. Devem usar `ROLE`/grupos.
 */
const CONSOLIDATED_FILES = [
  "src/components/ProtectedRoute.tsx",
  "src/pages/Dashboard.tsx",
  "src/pages/Relatorios.tsx",
];

const ROLE_VALUES = [...APP_ROLES];

/** Remove comentários de linha/bloco e literais de label óbvios. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");
}

describe("Q1-A2 — trava de regressão de literais de role", () => {
  for (const file of CONSOLIDATED_FILES) {
    it(`${file} não usa literal de role solto (usa ROLE/grupos)`, () => {
      const src = stripComments(read(file));
      const offenders = ROLE_VALUES.filter((r) =>
        new RegExp(`["']${r}["']`).test(src),
      );
      expect(offenders).toEqual([]);
    });
  }
});

/**
 * Allowlist explícita (Q1-A1 §5) — consumidores que, por arquitetura, ainda
 * carregam literais de role. NÃO são fronteira de autorização: a guarda real
 * permanece no backend (RLS/SECURITY DEFINER/RPC). Documentado para o Q1-B.
 *
 * Observação: `notificacoesService.ts` foi reclassificado como FALSO POSITIVO —
 * as ocorrências de "assistido" ali são tipo de autor de mensagem
 * (`autor: "assistido" | "ia" | ...`), não papel de acesso. Portanto não entra
 * em correção nem em allowlist de role.
 */
const ROLE_LITERAL_ALLOWLIST = [
  "src/contexts/AuthContext.tsx", // declaração raiz do union AppRole
  "src/constants/roles.ts", // fonte única canônica
  "src/integrations/supabase/types.ts", // gerado
  "src/components/AppSidebar.tsx", // visibilidade de menu (consumidor)
  "src/App.tsx", // allowedRoles em route guards (consumidor)
  "src/lib/help/helpContent.ts", // configuração de conteúdo de ajuda
];

describe("Q1-A2 — allowlist documentada (não falha)", () => {
  it("allowlist permanece declarada e não vazia", () => {
    expect(ROLE_LITERAL_ALLOWLIST.length).toBeGreaterThan(0);
  });

  it("arquivos consolidados não estão na allowlist (foram corrigidos)", () => {
    for (const f of CONSOLIDATED_FILES) {
      expect(ROLE_LITERAL_ALLOWLIST).not.toContain(f);
    }
  });
});
