import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getAdapter } from "../_shared/channel-adapter.ts";
import { guardCronOrStaff } from "../_shared/auth.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const TIMEZONE_OFICIAL = "America/Sao_Paulo";

function localDateISO(instant: Date, timeZone = TIMEZONE_OFICIAL): string {
  return instant.toLocaleDateString("en-CA", { timeZone });
}

function diaDoMes(instant: Date, timeZone = TIMEZONE_OFICIAL): number {
  return Number(localDateISO(instant, timeZone).split("-")[2]);
}

function primeiroDiaDoMes(instant: Date, timeZone = TIMEZONE_OFICIAL): string {
  const iso = localDateISO(instant, timeZone);
  return `${iso.slice(0, 7)}-01`;
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req, "authorization, x-client-info, apikey, content-type, x-cron-secret");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await guardCronOrStaff(req, ["admin"]);
  if (!guard.ok) return guard.response!;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const adapter = getAdapter({
    ZAPI_INSTANCE_ID: Deno.env.get("ZAPI_INSTANCE_ID"),
    ZAPI_INSTANCE_TOKEN: Deno.env.get("ZAPI_INSTANCE_TOKEN"),
    ZAPI_BASE_URL: Deno.env.get("ZAPI_BASE_URL"),
    ZAPI_CLIENT_TOKEN: Deno.env.get("ZAPI_CLIENT_TOKEN"),
  });

  const result = { enviados: 0, bloqueados: 0, ignorado: false, motivo: "" };

  const { data: config } = await admin
    .from("acao_social_cesta_aviso_config")
    .select("dia_inicio_aviso, dias_duracao_aviso, ativo")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!config || !config.ativo) {
    result.ignorado = true;
    result.motivo = "config_inativa";
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const agora = new Date();
  const hoje = diaDoMes(agora);
  const inicio = config.dia_inicio_aviso;
  const fim = config.dia_inicio_aviso + config.dias_duracao_aviso - 1;

  if (hoje < inicio || hoje > fim) {
    result.ignorado = true;
    result.motivo = "fora_da_janela";
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const competencia = primeiroDiaDoMes(agora);

  const { data: beneficiarios } = await admin
    .from("acao_social_beneficiarios")
    .select("id, nome, celular, assistido_id")
    .eq("ativo", true)
    .not("celular", "is", null);

  for (const b of beneficiarios || []) {
    const { data: entregaExistente } = await admin
      .from("acao_social_entregas")
      .select("id, entregue, aviso_enviado_em")
      .eq("beneficiario_id", b.id)
      .eq("competencia", competencia)
      .maybeSingle();

    if (entregaExistente?.entregue) continue;
    if (entregaExistente?.aviso_enviado_em) continue;

    if (b.assistido_id) {
      const { data: pref } = await admin
        .from("notificacoes_preferencias")
        .select("whatsapp_ativo, consentimento_status")
        .eq("assistido_id", b.assistido_id)
        .maybeSingle();
      const bloqueado = pref && (pref.whatsapp_ativo === false || pref.consentimento_status === "revogado");
      if (bloqueado) {
        result.bloqueados++;
        continue;
      }
    }

    const primeiroNome = (b.nome || "").split(" ")[0];
    const mensagem =
      `Olá, ${primeiroNome}! 🧺 Passando para lembrar que a cesta básica deste mês já está disponível para retirada. ` +
      `Assim que possível, procure a recepção da casa. Qualquer dúvida, estamos à disposição.`;

    const send = await adapter.send(b.celular, mensagem);

    if (send.ok) {
      await admin.from("acao_social_entregas").upsert(
        {
          beneficiario_id: b.id,
          competencia,
          aviso_enviado_em: new Date().toISOString(),
        },
        { onConflict: "beneficiario_id,competencia" },
      );
      result.enviados++;
    }
  }

  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
