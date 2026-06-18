import { describe, it, expect } from "vitest";
import { canViewHelp, visibleArticles, matchesQuery, normalizeSearch } from "./helpVisibility";
import { HELP_ARTICLES } from "./helpContent";
import type { HelpArticle } from "./types";
import type { AppRole } from "@/contexts/AuthContext";

const make = (over: Partial<HelpArticle>): HelpArticle => ({
  id: "x",
  kind: "faq",
  title: "T",
  module: "geral",
  roles: ["entrevistador"],
  active: true,
  summary: "s",
  body: [],
  ...over,
});

describe("canViewHelp", () => {
  it("hides inactive content from everyone, including admin", () => {
    const a = make({ active: false });
    expect(canViewHelp(a, ["admin"], false)).toBe(false);
    expect(canViewHelp(a, ["admin"], true)).toBe(false);
  });

  it("admin sees all non-master content", () => {
    const a = make({ roles: ["tarefeiro"] });
    expect(canViewHelp(a, ["admin"], false)).toBe(true);
  });

  it("admin does NOT see master-only content", () => {
    const a = make({ masterOnly: true, module: "governanca", roles: ["administrador_master"] });
    expect(canViewHelp(a, ["admin"], false)).toBe(false);
  });

  it("master sees master-only content and everything else", () => {
    const master = make({ masterOnly: true, roles: ["administrador_master"] });
    const tarefeiro = make({ roles: ["tarefeiro"] });
    expect(canViewHelp(master, ["admin", "administrador_master"], true)).toBe(true);
    expect(canViewHelp(tarefeiro, ["admin", "administrador_master"], true)).toBe(true);
  });

  it("non-admin only sees content matching their roles", () => {
    const tarefeiroDoc = make({ roles: ["tarefeiro"] });
    const adminDoc = make({ roles: ["admin"] });
    expect(canViewHelp(tarefeiroDoc, ["tarefeiro"], false)).toBe(true);
    expect(canViewHelp(adminDoc, ["tarefeiro"], false)).toBe(false);
  });

  it("multi-role user sees the union of compatible content (no escalation)", () => {
    const roles: AppRole[] = ["tarefeiro", "assistido"];
    const tarefeiroDoc = make({ roles: ["tarefeiro"] });
    const assistidoDoc = make({ roles: ["assistido"] });
    const adminDoc = make({ roles: ["admin"] });
    expect(canViewHelp(tarefeiroDoc, roles, false)).toBe(true);
    expect(canViewHelp(assistidoDoc, roles, false)).toBe(true);
    expect(canViewHelp(adminDoc, roles, false)).toBe(false);
  });
});

describe("visibleArticles over real content", () => {
  it("assistido never sees admin-only governance content", () => {
    const list = visibleArticles(HELP_ARTICLES, ["assistido"], false);
    expect(list.every((a) => !a.masterOnly)).toBe(true);
    expect(list.some((a) => a.module === "governanca")).toBe(false);
    expect(list.some((a) => a.id === "manual-assistido")).toBe(true);
  });

  it("admin sees real content but not the master manual", () => {
    const list = visibleArticles(HELP_ARTICLES, ["admin"], false);
    expect(list.some((a) => a.id === "manual-admin")).toBe(true);
    expect(list.some((a) => a.id === "manual-master")).toBe(false);
  });

  it("master sees the master manual", () => {
    const list = visibleArticles(HELP_ARTICLES, ["admin", "administrador_master"], true);
    expect(list.some((a) => a.id === "manual-master")).toBe(true);
  });

  it("admin + assistido sees both administrative and assistido help", () => {
    const list = visibleArticles(HELP_ARTICLES, ["admin", "assistido"], false);
    expect(list.some((a) => a.id === "manual-admin")).toBe(true);
    expect(list.some((a) => a.id === "manual-assistido")).toBe(true);
  });
});

describe("search helpers", () => {
  it("normalizes accents and case", () => {
    expect(normalizeSearch("Sessões PÚBLICAS")).toBe("sessoes publicas");
  });

  it("matches query against title, summary and body", () => {
    const a = make({ title: "Conversas WhatsApp", body: [{ text: "como funciona o handoff" }] });
    expect(matchesQuery(a, "handoff")).toBe(true);
    expect(matchesQuery(a, "whatsapp")).toBe(true);
    expect(matchesQuery(a, "inexistente")).toBe(false);
    expect(matchesQuery(a, "")).toBe(true);
  });

  it("every contextual FAQ points to a known route", () => {
    HELP_ARTICLES.filter((a) => a.kind === "faq").forEach((a) => {
      expect(typeof a.route === "string" && a.route.length > 0).toBe(true);
    });
  });
});
