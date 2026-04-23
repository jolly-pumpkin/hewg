/**
 *
 * Authentication middleware helpers for extracting tenant identity,
 * validating scopes, and producing structured auth results.
 */

import type { TenantId } from "../types/tenant";
import type { TokenPayload } from "./token";

/**
 * Extract the tenant identifier from a decoded token payload.
 * Returns null if the tenantId claim is missing or empty.
 *
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
