/**
 * Pure analytics for public works (trabalhos públicos). All functions are
 * deterministic and side-effect free so they can be unit-tested and reused by
 * both the report page and the admin dashboard. Operates strictly on REAL
 * check-in records — no theoretical projections.
 */
import { parseISO, format } from "date-fns";
import { calcAge } from "./ageGroups";
import { normalizeCelular, normalizeNome } from "./normalize";
import type {
  ClassifiedRecord,
  FaixaStat,
  ParticipanteFrequencia,
  PeriodGranularity,
  PeriodoPonto,
  PublicCheckinRecord,
  PublicWorksAnalytics,
  PublicWorksFilters,
  TrabalhoStat,
} from "@/types/trabalhosPublicos";

/**
 * Age buckets that match what the system can actually capture: exact age from
 * a linked assistido's birthdate OR the quick-registration faixa options
 * (menor_18 / 18_29 / 30_44 / 45_59 / 60_mais). Keeping them aligned avoids
 * inventing precision the data does not have.
 */
export const PUBLIC_AGE_GROUPS = [
  "Até 17",
  "18–29",
  "30–44",
  "45–59",
  "60+",
] as const;

export const FAIXA_NAO_INFORMADA = "Não informado";

export const FAIXA_ORDER = [...PUBLIC_AGE_GROUPS, FAIXA_NAO_INFORMADA];

/** Map an exact age to a public faixa label. */
export function publicFaixaFromAge(age: number | null): string {
  if (age === null) return FAIXA_NAO_INFORMADA;
  if (age <= 17) return "Até 17";
  if (age <= 29) return "18–29";
  if (age <= 44) return "30–44";
  if (age <= 59) return "45–59";
  return "60+";
}

/** Map a raw quick-registration faixa value to a public faixa label. */
export function publicFaixaFromRaw(raw: string | null | undefined): string {
  switch (raw) {
    case "menor_18":
      return "Até 17";
    case "18_29":
      return "18–29";
    case "30_44":
      return "30–44";
    case "45_59":
      return "45–59";
    case "60_mais":
      return "60+";
    default:
      return FAIXA_NAO_INFORMADA;
  }
}

/** Resolve a record's faixa, preferring an exact birthdate when available. */
export function resolveFaixa(r: PublicCheckinRecord): string {
  if (r.assistidoId && r.dataNascimento) {
    return publicFaixaFromAge(calcAge(r.dataNascimento));
  }
  return publicFaixaFromRaw(r.faixaRaw);
}

/**
 * Stable identity for a participant across sessions: prefer the linked
 * assistido, then a normalized phone, then a normalized name; fall back to the
 * check-in id so anonymous records are never merged incorrectly.
 */
export function participantKey(r: PublicCheckinRecord): string {
  if (r.assistidoId) return `a:${r.assistidoId}`;
  const cel = normalizeCelular(r.celular);
  if (cel) return `c:${cel}`;
  const nome = normalizeNome(r.nome);
  if (nome) return `n:${nome}`;
  return `x:${r.id}`;
}

/** Group filtered records into a temporal series by the chosen granularity. */
export function buildPeriodSeries(
  records: ClassifiedRecord[],
  granularity: PeriodGranularity,
): PeriodoPonto[] {
  const keyer = (dateStr: string): string => {
    const d = parseISO(dateStr);
    if (granularity === "ano") return format(d, "yyyy");
    if (granularity === "semana") return format(d, "RRRR-'S'II");
    return format(d, "yyyy-MM");
  };

  const map = new Map<string, { presencas: number; keys: Set<string> }>();
  for (const r of records) {
    const k = keyer(r.dataSessao);
    if (!map.has(k)) map.set(k, { presencas: 0, keys: new Set() });
    const bucket = map.get(k)!;
    bucket.presencas += 1;
    bucket.keys.add(r.participantKey);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, v]) => ({
      periodo,
      presencas: v.presencas,
      participantes: v.keys.size,
    }));
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * Main entry point. Takes the FULL history of public check-ins (needed to
 * decide new vs recurrent) plus the active filters, and returns the complete
 * analytics view model for the selected period.
 */
export function computePublicWorksAnalytics(
  allRecords: PublicCheckinRecord[],
  filters: PublicWorksFilters,
): PublicWorksAnalytics {
  // First-ever participation date per participant across ALL history.
  const firstSeen = new Map<string, string>();
  for (const r of allRecords) {
    const key = participantKey(r);
    const prev = firstSeen.get(key);
    if (!prev || r.dataSessao < prev) firstSeen.set(key, r.dataSessao);
  }

  // Classify + apply period and field filters.
  const filtered: ClassifiedRecord[] = [];
  for (const r of allRecords) {
    if (r.dataSessao < filters.dataInicio || r.dataSessao > filters.dataFim) continue;
    if (filters.tratamentoId !== "todos" && r.tratamentoId !== filters.tratamentoId) continue;
    if (filters.modoCheckin !== "todos" && r.modoCheckin !== filters.modoCheckin) continue;

    const key = participantKey(r);
    const faixa = resolveFaixa(r);
    const tipoParticipante: "novo" | "recorrente" =
      (firstSeen.get(key) ?? r.dataSessao) >= filters.dataInicio ? "novo" : "recorrente";

    if (filters.faixa !== "todos" && faixa !== filters.faixa) continue;
    if (filters.tipoParticipante !== "todos" && tipoParticipante !== filters.tipoParticipante) continue;

    filtered.push({ ...r, participantKey: key, faixa, tipoParticipante });
  }

  // Totals.
  const distinctParticipants = new Set(filtered.map((r) => r.participantKey));
  const distinctSessions = new Set(filtered.map((r) => r.sessaoId));
  const totalPresencas = filtered.length;
  const totalParticipantes = distinctParticipants.size;
  const totalSessoes = distinctSessions.size;

  // New vs recurrent (per distinct participant).
  const tipoByKey = new Map<string, "novo" | "recorrente">();
  filtered.forEach((r) => tipoByKey.set(r.participantKey, r.tipoParticipante));
  let novos = 0;
  let recorrentes = 0;
  tipoByKey.forEach((t) => (t === "novo" ? novos++ : recorrentes++));

  // Per-participant participation counts (recurrence).
  const partCount = new Map<string, ParticipanteFrequencia>();
  for (const r of filtered) {
    if (!partCount.has(r.participantKey)) {
      partCount.set(r.participantKey, {
        participantKey: r.participantKey,
        nome: r.nome || "Participante",
        participacoes: 0,
        faixa: r.faixa,
      });
    }
    partCount.get(r.participantKey)!.participacoes += 1;
  }
  const participantes = [...partCount.values()];
  const comRetorno = participantes.filter((p) => p.participacoes > 1).length;
  const retornoMedio = totalParticipantes > 0 ? totalPresencas / totalParticipantes : 0;
  const taxaRetornoGeral = pct(comRetorno, totalParticipantes);

  // Per public work.
  const trabMap = new Map<
    string,
    { nome: string; keys: Set<string>; presencas: number; sessoes: Set<string>; counts: Map<string, number> }
  >();
  for (const r of filtered) {
    if (!trabMap.has(r.tratamentoId)) {
      trabMap.set(r.tratamentoId, {
        nome: r.tratamentoNome,
        keys: new Set(),
        presencas: 0,
        sessoes: new Set(),
        counts: new Map(),
      });
    }
    const t = trabMap.get(r.tratamentoId)!;
    t.keys.add(r.participantKey);
    t.presencas += 1;
    t.sessoes.add(r.sessaoId);
    t.counts.set(r.participantKey, (t.counts.get(r.participantKey) || 0) + 1);
  }
  const porTrabalho: TrabalhoStat[] = [...trabMap.entries()]
    .map(([tratamentoId, t]) => {
      const retornaram = [...t.counts.values()].filter((c) => c > 1).length;
      return {
        tratamentoId,
        tratamentoNome: t.nome,
        participantes: t.keys.size,
        presencas: t.presencas,
        sessoes: t.sessoes.size,
        mediaPorSessao: t.sessoes.size > 0 ? Math.round((t.presencas / t.sessoes.size) * 10) / 10 : 0,
        taxaRetorno: pct(retornaram, t.keys.size),
      };
    })
    .sort((a, b) => b.presencas - a.presencas);

  // Per faixa.
  const faixaMap = new Map<string, { keys: Set<string>; presencas: number }>();
  for (const r of filtered) {
    if (!faixaMap.has(r.faixa)) faixaMap.set(r.faixa, { keys: new Set(), presencas: 0 });
    const f = faixaMap.get(r.faixa)!;
    f.keys.add(r.participantKey);
    f.presencas += 1;
  }
  const porFaixa: FaixaStat[] = FAIXA_ORDER.filter((f) => faixaMap.has(f)).map((faixa) => {
    const f = faixaMap.get(faixa)!;
    return {
      faixa,
      participantes: f.keys.size,
      presencas: f.presencas,
      percentual: pct(f.keys.size, totalParticipantes),
    };
  });

  const topParticipantes = [...participantes]
    .sort((a, b) => b.participacoes - a.participacoes)
    .slice(0, 10);

  // Highlights (ignore "Não informado" for faixa min/max).
  const faixaReais = porFaixa.filter((f) => f.faixa !== FAIXA_NAO_INFORMADA);
  const topFaixa = faixaReais.length
    ? faixaReais.reduce((a, b) => (b.participantes > a.participantes ? b : a))
    : null;
  const bottomFaixa = faixaReais.length
    ? faixaReais.reduce((a, b) => (b.participantes < a.participantes ? b : a))
    : null;
  const topTrabalho = porTrabalho[0] ?? null;
  const bottomTrabalho = porTrabalho.length ? porTrabalho[porTrabalho.length - 1] : null;

  // Managerial insights from real aggregates.
  const insights: string[] = [];
  if (totalPresencas === 0) {
    insights.push("Nenhuma presença pública registrada no período e filtros selecionados.");
  } else {
    if (topTrabalho) {
      insights.push(
        `"${topTrabalho.tratamentoNome}" lidera a participação com ${topTrabalho.presencas} presenças (${topTrabalho.participantes} participantes).`,
      );
    }
    if (bottomTrabalho && porTrabalho.length > 1 && bottomTrabalho.tratamentoId !== topTrabalho?.tratamentoId) {
      insights.push(
        `"${bottomTrabalho.tratamentoNome}" está em baixa demanda, com apenas ${bottomTrabalho.presencas} presenças no período.`,
      );
    }
    insights.push(
      `${pct(novos, totalParticipantes)}% dos participantes são novos e ${pct(recorrentes, totalParticipantes)}% já tinham histórico anterior.`,
    );
    if (taxaRetornoGeral < 25) {
      insights.push(
        `Baixa fidelização: somente ${taxaRetornoGeral}% dos participantes retornaram mais de uma vez. Considere ações de acolhimento.`,
      );
    }
    if (bottomFaixa && topFaixa && bottomFaixa.faixa !== topFaixa.faixa) {
      insights.push(
        `Faixa etária sub-representada: "${bottomFaixa.faixa}" (${bottomFaixa.participantes}). Maior presença em "${topFaixa.faixa}" (${topFaixa.participantes}).`,
      );
    }
  }

  return {
    totalParticipantes,
    totalPresencas,
    totalSessoes,
    mediaPorSessao: totalSessoes > 0 ? Math.round((totalPresencas / totalSessoes) * 10) / 10 : 0,
    novos,
    recorrentes,
    percentualNovos: pct(novos, totalParticipantes),
    percentualRecorrentes: pct(recorrentes, totalParticipantes),
    retornoMedio: Math.round(retornoMedio * 10) / 10,
    taxaRetornoGeral,
    porTrabalho,
    porFaixa,
    topParticipantes,
    topTrabalho,
    bottomTrabalho,
    topFaixa,
    bottomFaixa,
    insights,
    filtered,
  };
}
