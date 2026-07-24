/**
 * O cliente Supabase, ao falhar uma chamada a Edge Function, expõe só uma
 * mensagem genérica em error.message ("Edge Function returned a non-2xx
 * status code") — a mensagem real que a função devolveu fica no corpo da
 * resposta HTTP, acessível via error.context (um objeto Response).
 * Esta função tenta extrair essa mensagem real; se não conseguir, cai de
 * volta pro texto genérico.
 */
export async function extrairErroFuncao(
  error: unknown,
  fallback = "Não foi possível concluir a operação."
): Promise<string> {
  if (!error || typeof error !== "object") return fallback;

  const anyError = error as { context?: Response; message?: string };

  if (anyError.context && typeof anyError.context.json === "function") {
    try {
      const body = await anyError.context.clone().json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } catch {
      // corpo não era JSON válido — segue pro fallback abaixo
    }
  }

  if (
    anyError.message &&
    anyError.message !== "Edge Function returned a non-2xx status code"
  ) {
    return anyError.message;
  }

  return fallback;
}
