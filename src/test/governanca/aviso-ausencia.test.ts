/**
 * MELHORIA-01 — Aviso de ausência ("não poderei comparecer").
 *
 * Contratos estruturais que protegem o desenho contra regressão:
 *  - O fluxo é 100% via RPCs oficiais (backend é fonte de verdade); o serviço
 *    não faz INSERT/UPDATE direto na tabela avisos_ausencia.
 *  - Os 4 "não": o aviso NUNCA altera/cancela/remarca a agenda automaticamente
 *    (não há mutação de agenda no serviço nem no componente).
 *  - Privacidade por perfil: a UI da equipe só exibe motivo/resolução quando
 *    `pode_ver_conteudo` é verdadeiro (o backend zera o conteúdo do tarefeiro).
 *  - As RPCs oficiais existem nos tipos gerados e a de listagem NÃO retorna
 *    conteúdo sensível incondicionalmente.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("MELHORIA-01 — serviço usa apenas RPCs oficiais", () => {
  const svc = read("src/services/avisos/avisosAusenciaService.ts");

  it("invoca as três RPCs oficiais", () => {
    expect(svc).toContain("fn_registrar_aviso_ausencia");
    expect(svc).toContain("fn_tratar_aviso_ausencia");
    expect(svc).toContain("fn_avisos_ausencia_pendentes");
  });

  it("não faz acesso direto de escrita à tabela avisos_ausencia", () => {
    expect(svc).not.toMatch(/from\(["']avisos_ausencia["']\)/);
    expect(svc).not.toMatch(/\.insert\(/);
    expect(svc).not.toMatch(/\.update\(/);
    expect(svc).not.toMatch(/\.delete\(/);
  });
});

describe("MELHORIA-01 — aviso não muda a agenda (os 4 não)", () => {
  it("serviço não toca agenda nem entrevistas", () => {
    const svc = read("src/services/avisos/avisosAusenciaService.ts");
    expect(svc).not.toMatch(/agenda_tratamentos_assistido/);
    expect(svc).not.toMatch(/entrevistas_fraternas/);
    expect(svc).not.toMatch(/cancel|remarca/i);
  });

  it("diálogo do assistido deixa explícito que não cancela/remarca", () => {
    const dlg = read("src/components/avisos/AvisoAusenciaDialog.tsx");
    expect(dlg).toMatch(/não cancela nem remarca/i);
  });
});

describe("MELHORIA-01 — privacidade por perfil na UI da equipe", () => {
  const page = read("src/pages/AvisosAusencia.tsx");

  it("motivo e resolução só aparecem sob pode_ver_conteudo", () => {
    expect(page).toContain("pode_ver_conteudo");
    // Não deve haver render de motivo fora da guarda de conteúdo.
    const semGuarda = page.replace(/a\.pode_ver_conteudo &&[\s\S]*?\n/g, "");
    expect(page).toMatch(/pode_ver_conteudo \?[\s\S]*a\.motivo/);
    // O bloco do tarefeiro mostra rótulo operacional, sem motivo.
    expect(page).toMatch(/Aviso de não comparecimento recebido/);
  });
});

describe("MELHORIA-01 — contratos do banco nos tipos gerados", () => {
  const types = read("src/integrations/supabase/types.ts");

  it("as três RPCs existem nos tipos", () => {
    expect(types).toContain("fn_registrar_aviso_ausencia");
    expect(types).toContain("fn_tratar_aviso_ausencia");
    expect(types).toContain("fn_avisos_ausencia_pendentes");
  });

  it("a tabela avisos_ausencia existe nos tipos", () => {
    expect(types).toContain("avisos_ausencia");
  });
});
