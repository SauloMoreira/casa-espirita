// Pure, testable business rules for user lifecycle management.
// The authoritative enforcement lives in the `manage-user` edge function;
// this module mirrors the same rules so they can be unit-tested and reused.

export const DELETE_CONFIRM_WORD = "EXCLUIR";

export function isDeleteConfirmed(input: string): boolean {
  return input.trim().toUpperCase() === DELETE_CONFIRM_WORD;
}

export interface DeletionContext {
  /** Target is the same user performing the action. */
  isSelf: boolean;
  /** Target holds the admin role. */
  isTargetAdmin: boolean;
  /** Number of currently active (status=ativo) admins in the system. */
  activeAdminCount: number;
  /** Map of human-readable link label -> number of referencing records. */
  linkCounts: Record<string, number>;
}

export interface DeletionDecision {
  canDelete: boolean;
  blockers: string[];
}

/**
 * Decide whether a user can be physically deleted.
 * Deletion is allowed ONLY when there are no critical links, the target is not
 * the acting user, and the target is not the last active administrator.
 */
export function evaluateDeletion(ctx: DeletionContext): DeletionDecision {
  const blockers: string[] = [];

  if (ctx.isSelf) blockers.push("não é permitido excluir o próprio usuário");
  if (ctx.isTargetAdmin && ctx.activeAdminCount <= 1) blockers.push("é o último administrador ativo");

  for (const [label, count] of Object.entries(ctx.linkCounts)) {
    if (count > 0) blockers.push(label);
  }

  return { canDelete: blockers.length === 0, blockers };
}

export interface InactivationContext {
  isSelf: boolean;
  isTargetAdmin: boolean;
  activeAdminCount: number;
}

/** Decide whether a user can be inactivated. */
export function canInactivate(ctx: InactivationContext): { allowed: boolean; reason?: string } {
  if (ctx.isSelf) return { allowed: false, reason: "Você não pode inativar seu próprio usuário." };
  if (ctx.isTargetAdmin && ctx.activeAdminCount <= 1) {
    return { allowed: false, reason: "Não é possível inativar o último administrador ativo." };
  }
  return { allowed: true };
}
