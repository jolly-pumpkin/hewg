
import type { TenantId } from "../types/tenant";
import type { TokenPayload } from "./token";

export interface AuthResult {
  readonly success: boolean;
  readonly tenantId?: TenantId;
  readonly error?: string;
}

export class AuthError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

export function extractTenantId(
  tokenPayload: TokenPayload,
): TenantId | null {
  if (!tokenPayload.tenantId || tokenPayload.tenantId.trim() === "") {
    return null;
  }
  return tokenPayload.tenantId as TenantId;
}

export function validateScopes(
  required: string[],
  actual: string[],
): boolean {
  const actualSet = new Set(actual);
  return required.every((scope) => actualSet.has(scope));
}

export function createAuthResult(
  success: boolean,
  tenantId?: TenantId,
  error?: string,
): AuthResult {
  return {
    success,
    ...(tenantId !== undefined ? { tenantId } : {}),
    ...(error !== undefined ? { error } : {}),
  };
}
