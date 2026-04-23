/**
 * @hewg-module taskq/auth/middleware
 *
 * Authentication middleware helpers for extracting tenant identity,
 * validating scopes, and producing structured auth results.
 */

import type { TenantId } from "../types/tenant";
import type { TokenPayload } from "./token";

/** Structured result of an authentication attempt. */
export interface AuthResult {
  readonly success: boolean;
  readonly tenantId?: TenantId;
  readonly error?: string;
}

/** Error class for authentication failures. */
export class AuthError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

/**
 * Extract the tenant identifier from a decoded token payload.
 * Returns null if the tenantId claim is missing or empty.
 *
 * @hewg-module taskq/auth/middleware
 * @effects
 */
export function extractTenantId(
  tokenPayload: TokenPayload,
): TenantId | null {
  if (!tokenPayload.tenantId || tokenPayload.tenantId.trim() === "") {
    return null;
  }
  return tokenPayload.tenantId as TenantId;
}

/**
 * Validate that the token's scopes satisfy the required set. Every
 * scope in the required list must appear in the actual list.
 *
 * @hewg-module taskq/auth/middleware
 * @effects
 */
export function validateScopes(
  required: string[],
  actual: string[],
): boolean {
  const actualSet = new Set(actual);
  return required.every((scope) => actualSet.has(scope));
}

/**
 * Build a structured AuthResult indicating success or failure.
 * This provides a uniform shape for auth outcomes across the
 * request pipeline.
 *
 * @hewg-module taskq/auth/middleware
 * @effects
 */
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
