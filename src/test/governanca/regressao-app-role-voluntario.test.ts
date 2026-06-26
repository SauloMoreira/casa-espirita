import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { APP_ROLES } from "@/constants/roles";

/**
 * REG-VOL-ROLE — Regressão do bug "invalid input value for enum app_role:
 * 'coordenador'" na frente de Voluntário.
 *
 * Causa raiz: fn_buscar_pessoa_para_voluntario usava has_role(..., 'coordenador'),
 * apelido inexistente. O valor correto no enum app_role é
 * 'coordenador_de_tratamento'.
 *
 * Estes testes são estruturais: garantem que NENHUMA migração passe a has_role
 * (ou faça cast ::app_role) com um valor fora do enum real do banco.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const VALID_ROLES = new Set<string>(APP_ROLES);

function allMigrationSql(): { file: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({ file: f, sql: readFileSync(join(MIGRATIONS_DIR, f), "utf8") }));
}

/** Extrai todos os literais de papel usados em has_role(..., '<role>'). */
function extractHasRoleLiterals(sql: string): string[] {
  const re = /has_role\s*\([^,]+,\s*'([^']+)'/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) out.push(m[1]);
  return out;
}

/** Extrai literais com cast explícito '<x>'::app_role. */
function extractAppRoleCasts(sql: string): string[] {
  const re = /'([^']+)'\s*::\s*app_role/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) out.push(m[1]);
  return out;
}

describe("REG-VOL-ROLE — papéis app_role nas migrações", () => {
  const migrations = allMigrationSql();

  it("o enum app_role conhecido pelo app contém o papel real de coordenador", () => {
    expect(VALID_ROLES.has("coordenador_de_tratamento")).toBe(true);
    expect(VALID_ROLES.has("coordenador")).toBe(false);
  });

  it("nenhuma migração usa o apelido inválido 'coordenador' em has_role/cast", () => {
    const ofensores: string[] = [];
    for (const { file, sql } of migrations) {
      for (const role of [...extractHasRoleLiterals(sql), ...extractAppRoleCasts(sql)]) {
        if (role === "coordenador") ofensores.push(`${file}: '${role}'`);
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("todo papel passado a has_role pertence ao enum app_role real", () => {
    const invalidos: string[] = [];
    for (const { file, sql } of migrations) {
      for (const role of extractHasRoleLiterals(sql)) {
        if (!VALID_ROLES.has(role)) invalidos.push(`${file}: has_role '${role}'`);
      }
    }
    expect(invalidos).toEqual([]);
  });

  it("todo cast ::app_role usa um valor real do enum", () => {
    const invalidos: string[] = [];
    for (const { file, sql } of migrations) {
      for (const role of extractAppRoleCasts(sql)) {
        if (!VALID_ROLES.has(role)) invalidos.push(`${file}: '${role}'::app_role`);
      }
    }
    expect(invalidos).toEqual([]);
  });

  it("a busca de pessoa para voluntário autoriza pelo papel real de coordenador", () => {
    const fn = migrations.find((m) =>
      m.sql.includes("fn_buscar_pessoa_para_voluntario"),
    );
    expect(fn).toBeDefined();
    expect(fn!.sql).toContain("coordenador_de_tratamento");
  });
});
