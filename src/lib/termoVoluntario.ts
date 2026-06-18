// Pure, testable helpers for the Voluntário "Termo de Adesão" flow.
import { TERMO_STATUS, TERMO_UPLOAD } from "@/constants/voluntarios";

export interface TermoFields {
  termo_status?: string | null;
  termo_assinado_path?: string | null;
}

/** Whether the signed term can be downloaded/viewed. */
export function hasSignedTermo(v: TermoFields): boolean {
  return !!v.termo_assinado_path;
}

/** Whether the admin may validate/reject (only after a signed term arrives). */
export function canReviewTermo(v: TermoFields): boolean {
  return v.termo_status === TERMO_STATUS.ASSINADO_ENVIADO;
}

/** Whether sending a signed term is currently the expected next step. */
export function canSendSigned(v: TermoFields): boolean {
  return v.termo_status !== TERMO_STATUS.VALIDADO;
}

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

/** Validate a signed-term file by type and size. */
export function validateTermoFile(file: { type: string; size: number }): FileValidationResult {
  if (!TERMO_UPLOAD.accepted.includes(file.type)) {
    return { ok: false, error: "Formato inválido. Envie um PDF ou imagem (JPG, PNG, WEBP)." };
  }
  if (file.size > TERMO_UPLOAD.maxBytes) {
    return { ok: false, error: "Arquivo muito grande. Tamanho máximo: 15MB." };
  }
  return { ok: true };
}

/** Build the storage path for a volunteer's signed term. */
export function buildTermoPath(voluntarioId: string, fileName: string): string {
  const safeExt = (fileName.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  return `${voluntarioId}/${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
}
