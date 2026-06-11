/**
 * Channel adapter abstraction for the Central de Notificações.
 *
 * The notification engine talks to this interface only — never to a concrete
 * provider — so the WhatsApp provider (Evolution today) can be swapped for the
 * official Cloud API later without touching business rules.
 */

export interface SendResult {
  ok: boolean;
  externalMessageId?: string;
  error?: string;
  raw?: unknown;
}

export interface ChannelAdapter {
  readonly name: string;
  send(telefone: string, mensagem: string): Promise<SendResult>;
}

/**
 * Evolution API adapter. Reads configuration from environment secrets:
 *   EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE
 */
export class EvolutionAdapter implements ChannelAdapter {
  readonly name = "evolution";
  private url: string;
  private apiKey: string;
  private instance: string;

  constructor(env: {
    EVOLUTION_API_URL?: string;
    EVOLUTION_API_KEY?: string;
    EVOLUTION_INSTANCE?: string;
  }) {
    this.url = (env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
    this.apiKey = env.EVOLUTION_API_KEY || "";
    this.instance = env.EVOLUTION_INSTANCE || "";
  }

  isConfigured(): boolean {
    return Boolean(this.url && this.apiKey && this.instance);
  }

  async send(telefone: string, mensagem: string): Promise<SendResult> {
    if (!this.isConfigured()) {
      return { ok: false, error: "evolution_not_configured" };
    }
    try {
      const res = await fetch(`${this.url}/message/sendText/${this.instance}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.apiKey,
        },
        body: JSON.stringify({ number: telefone, text: mensagem }),
      });
      const raw = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: `evolution_http_${res.status}`, raw };
      }
      const externalMessageId =
        raw?.key?.id || raw?.message?.key?.id || raw?.id || undefined;
      return { ok: true, externalMessageId, raw };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
}

/** Resolve the active adapter. Single switch point for future providers. */
export function getAdapter(env: Record<string, string | undefined>): EvolutionAdapter {
  return new EvolutionAdapter(env);
}
