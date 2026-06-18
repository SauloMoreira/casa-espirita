import type { AppRole } from "@/contexts/AuthContext";
import type { HelpArticle } from "./types";

/**
 * Decide whether a user with the given effective access roles can see a help
 * article. The rule is based on *system access roles*, not on institutional
 * classification or volunteer type.
 *
 * - Inactive content is never shown.
 * - Master-only content (governance/security) is shown only to Master.
 * - Administrador sees everything (except, naturally, nothing extra is hidden).
 * - Administrador Master sees everything, including master-only content.
 * - Other roles see the union of content matching any of their roles.
 */
export function canViewHelp(
  article: HelpArticle,
  roles: AppRole[],
  isMaster: boolean,
): boolean {
  if (!article.active) return false;
  if (article.masterOnly) return isMaster;
  if (isMaster) return true;
  if (roles.includes("admin")) return true;
  return article.roles.some((r) => roles.includes(r));
}

/** Filter a list of articles to those visible for the user's roles. */
export function visibleArticles(
  articles: HelpArticle[],
  roles: AppRole[],
  isMaster: boolean,
): HelpArticle[] {
  return articles.filter((a) => canViewHelp(a, roles, isMaster));
}

/** Normalize a string for accent-insensitive search. */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Match an article against a free-text query (title, summary, tags, body). */
export function matchesQuery(article: HelpArticle, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const haystack = normalizeSearch(
    [
      article.title,
      article.summary,
      ...(article.tags ?? []),
      ...article.body.flatMap((b) => [
        b.heading ?? "",
        b.text ?? "",
        b.note ?? "",
        ...(b.bullets ?? []),
        ...(b.steps ?? []),
      ]),
    ].join(" "),
  );
  return haystack.includes(q);
}
