/**
 * Deterministic, namespaced fixtures for the E2E RLS suite (P1.1).
 *
 * Namespace marker: every synthetic row carries the literal `e2e_rls` in a
 * human-visible field, so a namespace-wide cleanup can always recover from a
 * mid-run failure.
 *
 * Creation is done through the REAL access path (admin JWT for staff-owned
 * rows, the assistido's own RPC for the aviso) so the fixtures themselves also
 * exercise authorized writes. Cleanup uses the service role ONLY because some
 * sensitive tables (e.g. avisos_ausencia) intentionally expose no DELETE policy
 * to any interactive role — there is no standing endpoint, the key is read from
 * the environment and never committed or logged.
 */
import { SUPABASE_URL, ANON_KEY, rest, rpc, signIn, uidOf } from "./_rlsClient";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const NS = "e2e_rls";

export interface SeedData {
  assistidoId: string;
  assistidoUid: string;
  entrevistaId: string;
  avisoId: string;
  observacoesSensiveis: string;
  decisoesSensiveis: string;
}

async function serviceRest<T = unknown>(path: string, init: RequestInit = {}): Promise<{ status: number; ok: boolean; body: T }> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const body = (await r.json().catch(() => null)) as T;
  return { status: r.status, ok: r.ok, body };
}

/** Remove every namespaced fixture row. Idempotent; safe to call repeatedly. */
export async function cleanupNamespace(): Promise<void> {
  // avisos first (FK-free but logically dependent), then entrevistas, assistidos.
  await serviceRest(`avisos_ausencia?motivo=like.${NS}%25`, { method: "DELETE" });
  await serviceRest(`entrevistas_fraternas?observacoes=like.${NS}%25`, { method: "DELETE" });
  await serviceRest(`assistidos?nome=like.${NS}%25`, { method: "DELETE" });
}

function futureDateISO(daysAhead = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

/** Build the full fixture set through the real access path. */
export async function seed(): Promise<SeedData> {
  await cleanupNamespace();

  const adminUid = await uidOf("admin");
  const assistidoUid = await uidOf("assistido");
  const entrevistadorUid = await uidOf("entrevistador");

  const observacoesSensiveis = `${NS} OBSERVACAO SENSIVEL FAKE - relato sintetico do assistido`;
  const decisoesSensiveis = `${NS} DECISAO SENSIVEL FAKE - encaminhamento sintetico`;

  // 1) Synthetic assistido linked to the assistido test account (admin-authorized write).
  const a = await rest<Array<{ id: string }>>("admin", "assistidos", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      nome: `${NS} Assistido Sintetico`,
      status: "em_tratamento",
      user_id: assistidoUid,
      created_by: adminUid,
    }),
  });
  if (!a.ok || !a.body?.[0]?.id) {
    throw new Error(`Seed assistido falhou: ${a.status} ${JSON.stringify(a.body)}`);
  }
  const assistidoId = a.body[0].id;

  // 2) Synthetic interview with sensitive content (admin-authorized write).
  const e = await rest<Array<{ id: string }>>("admin", "entrevistas_fraternas", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      assistido_id: assistidoId,
      entrevistador_id: entrevistadorUid,
      data: futureDateISO(),
      tipo_entrevista: "regular",
      status: "agendada",
      observacoes: observacoesSensiveis,
      decisoes: decisoesSensiveis,
      created_by: adminUid,
    }),
  });
  if (!e.ok || !e.body?.[0]?.id) {
    throw new Error(`Seed entrevista falhou: ${e.status} ${JSON.stringify(e.body)}`);
  }
  const entrevistaId = e.body[0].id;

  // 3) Aviso de ausência created via the assistido's OWN real RPC path.
  await signIn("assistido");
  const av = await rpc<{ aviso_id?: string; id?: string }>("assistido", "fn_registrar_aviso_ausencia", {
    p_tipo_compromisso: "entrevista",
    p_compromisso_id: entrevistaId,
    p_motivo: `${NS} motivo fake de ausencia`,
  });
  if (!av.ok) {
    throw new Error(`Seed aviso falhou: ${av.status} ${JSON.stringify(av.body)}`);
  }
  // Recover the aviso id deterministically by namespace.
  const found = await serviceRest<Array<{ id: string }>>(
    `avisos_ausencia?entrevista_id=eq.${entrevistaId}&select=id`,
  );
  const avisoId = found.body?.[0]?.id ?? "";

  return {
    assistidoId,
    assistidoUid,
    entrevistaId,
    avisoId,
    observacoesSensiveis,
    decisoesSensiveis,
  };
}

export const HAS_SERVICE = !!SERVICE_KEY;
export { ANON_KEY };
