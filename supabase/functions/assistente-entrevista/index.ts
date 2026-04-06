import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const userRole = roles?.[0]?.role;
    if (!userRole || !["admin", "entrevistador"].includes(userRole)) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { observacoes, assistido_nome, tratamentos_disponiveis } = await req.json();

    if (!observacoes || !observacoes.trim()) {
      return new Response(JSON.stringify({ error: "Observações da entrevista são obrigatórias" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Chave de IA não configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Consultar base de conhecimento da Central de IA ──
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Configurações da IA
    const { data: configRows } = await serviceClient.from("ia_configuracoes").select("*").limit(1);
    const config = configRows?.[0] || null;

    // 2. Queixas ativas com palavras-chave e sinônimos
    const { data: queixas } = await serviceClient.from("ia_queixas").select("id, nome_queixa, categoria, descricao, palavras_chave, sinonimos, nivel_relevancia").eq("status", "ativo").order("nivel_relevancia");

    // 3. Vínculos queixa ↔ tratamento
    const { data: vinculos } = await serviceClient.from("ia_queixa_tratamento").select("queixa_id, tratamento_id, prioridade, peso, tipo_relacao, observacao_operacional, observacao_doutrinaria").eq("status", "ativo");

    // 4. Biblioteca doutrinária (apenas materiais marcados para uso na IA)
    let bibliotecaTexto = "";
    if (config?.usar_base_doutrinaria) {
      const { data: materiais } = await serviceClient.from("ia_biblioteca").select("titulo, autor, tema, resumo, texto_indexavel").eq("status", "ativo").eq("usar_na_ia", true).limit(20);
      if (materiais && materiais.length > 0) {
        bibliotecaTexto = materiais.map((m: any) => {
          let entry = `- "${m.titulo}"`;
          if (m.autor) entry += ` (${m.autor})`;
          entry += ` — Tema: ${m.tema}`;
          if (m.resumo) entry += `\n  Resumo: ${m.resumo}`;
          if (m.texto_indexavel) entry += `\n  Trecho: ${m.texto_indexavel.substring(0, 500)}`;
          return entry;
        }).join("\n\n");
      }
    }

    // ── Montar mapa de queixas e seus tratamentos recomendados ──
    const tratamentosMap: Record<string, string> = {};
    (tratamentos_disponiveis || []).forEach((t: any) => { tratamentosMap[t.id] = t.nome; });

    let queixasComTratamentos = "";
    if (queixas && queixas.length > 0) {
      queixasComTratamentos = queixas.map((q: any) => {
        const vinculosQueixa = (vinculos || []).filter((v: any) => v.queixa_id === q.id);
        let entry = `### ${q.nome_queixa} (categoria: ${q.categoria}, relevância: ${q.nivel_relevancia})`;
        if (q.descricao) entry += `\nDescrição: ${q.descricao}`;
        if (q.palavras_chave?.length) entry += `\nPalavras-chave: ${q.palavras_chave.join(", ")}`;
        if (q.sinonimos?.length) entry += `\nSinônimos: ${q.sinonimos.join(", ")}`;
        if (vinculosQueixa.length > 0) {
          entry += `\nTratamentos recomendados:`;
          vinculosQueixa
            .sort((a: any, b: any) => b.peso - a.peso)
            .forEach((v: any) => {
              const nomeT = tratamentosMap[v.tratamento_id] || v.tratamento_id;
              entry += `\n  - ${nomeT} (prioridade: ${v.prioridade}, peso: ${v.peso}, tipo: ${v.tipo_relacao})`;
              if (v.observacao_operacional) entry += ` | Obs operacional: ${v.observacao_operacional}`;
              if (v.observacao_doutrinaria) entry += ` | Obs doutrinária: ${v.observacao_doutrinaria}`;
            });
        }
        return entry;
      }).join("\n\n");
    }

    // ── Montar prompt ──
    const tratamentosLista = (tratamentos_disponiveis || [])
      .map((t: any) => `- ${t.nome} (tipo: ${t.tipo}, sessões padrão: ${t.quantidade_padrao_sessoes})`)
      .join("\n");

    const pesoOp = config?.peso_base_operacional ?? 7;
    const pesoDout = config?.peso_base_doutrinaria ?? 5;

    let systemPrompt = `Você é um assistente de apoio à equipe de entrevista fraterna de uma instituição espírita.
Sua função é analisar as observações registradas pelo entrevistador e fornecer:

1. **Resumo**: Um resumo objetivo e respeitoso das observações.
2. **Pontos de atenção**: Queixas, dores emocionais, físicas ou espirituais mencionadas.
3. **Sugestões de tratamentos**: Com base na BASE DE CONHECIMENTO abaixo (queixas cadastradas e seus tratamentos recomendados), sugira os tratamentos mais adequados e a quantidade de sessões.

REGRAS IMPORTANTES:
- Suas sugestões são apenas apoio. A decisão final é SEMPRE do entrevistador.
- Seja respeitoso e empático.
- Não faça diagnósticos médicos ou psicológicos.
- Baseie-se nas observações E na base de conhecimento cadastrada.
- PRIORIZE os tratamentos que estão vinculados às queixas identificadas na base de conhecimento.
- Considere o peso e a prioridade dos vínculos ao recomendar tratamentos.
- Peso da base operacional (queixas/tratamentos): ${pesoOp}/10
- Peso da base doutrinária: ${pesoDout}/10

## TRATAMENTOS DISPONÍVEIS NO SISTEMA
${tratamentosLista || "Nenhum tratamento cadastrado."}`;

    if (queixasComTratamentos) {
      systemPrompt += `

## BASE DE CONHECIMENTO — QUEIXAS E TRATAMENTOS RECOMENDADOS
Use esta base para identificar queixas nas observações e recomendar os tratamentos vinculados:

${queixasComTratamentos}`;
    }

    if (bibliotecaTexto) {
      systemPrompt += `

## REFERÊNCIAS DOUTRINÁRIAS
Considere estas referências ao elaborar sua análise:

${bibliotecaTexto}`;
    }

    if (config?.exibir_justificativa) {
      systemPrompt += `

Ao final, inclua uma seção **Justificativa** explicando brevemente por que cada tratamento foi sugerido, citando queixas identificadas e referências quando aplicável.`;
    }

    systemPrompt += `

Responda em formato estruturado com as seções: Resumo, Pontos de Atenção, Sugestões de Tratamento${config?.exibir_justificativa ? ", Justificativa" : ""}.
Para cada tratamento sugerido, indique o nome e a quantidade de sessões recomendada.`;

    const userMessage = `Assistido: ${assistido_nome || "Não informado"}

Observações da entrevista:
${observacoes}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "Erro ao consultar assistente de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "Sem resposta do assistente.";

    // Log audit
    await serviceClient.from("audit_logs").insert({
      user_id: user.id,
      tabela: "entrevistas_fraternas",
      acao: "ASSISTENTE_IA",
      registro_id: null,
      dados_novos: { assistido_nome, observacoes_length: observacoes.length, queixas_consultadas: queixas?.length || 0, biblioteca_consultada: config?.usar_base_doutrinaria || false },
    });

    return new Response(JSON.stringify({ sugestao: content }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("assistente-entrevista error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
