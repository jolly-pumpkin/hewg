/**
 * @hewg-module taskq/transforms/validate-tenant
 *
 * Validation logic for tenant registration fields.
 */

/** Result of a validation pass. */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

const MIN_TENANT_NAME_LENGTH = 2;
const MAX_TENANT_NAME_LENGTH = 64;
const TENANT_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9 _-]*[a-zA-Z0-9]$/;

const API_KEY_MIN_LENGTH = 32;
const API_KEY_MAX_LENGTH = 128;
const API_KEY_PATTERN = /^tq_[a-zA-Z0-9]{29,125}$/;

/**
 * Validate a tenant name for length and allowed characters.
 * Names must start and end with alphanumeric characters and may
 * contain spaces, underscores, or hyphens in between.
 * @hewg-module taskq/transforms/validate-tenant
 * @effects
 */
export function validateTenantName(name: string): ValidationResult {
  const errors: string[] = [];

  if (!name || name.trim().length === 0) {
    errors.push("tenant name is required");
    return { valid: false, errors };
  }

  const trimmed = name.trim();

  if (trimmed.length < MIN_TENANT_NAME_LENGTH) {
    errors.push(
      `tenant name must be at least ${MIN_TENANT_NAME_LENGTH} characters`,
    );
  }

  if (trimmed.length > MAX_TENANT_NAME_LENGTH) {
    errors.push(
      `tenant name must not exceed ${MAX_TENANT_NAME_LENGTH} characters`,
    );
  }

  if (!TENANT_NAME_PATTERN.test(trimmed)) {
    errors.push(
      "tenant name must start and end with an alphanumeric character and contain only letters, digits, spaces, underscores, or hyphens",
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an API key string for correct format.
 * Keys must be prefixed with "tq_" followed by 29-125 alphanumeric
 * characters, for a total length between 32 and 128 characters.
 * @hewg-module taskq/transforms/validate-tenant
 * @effects
 */
export function validateApiKey(key: string): ValidationResult {
  const errors: string[] = [];

  if (!key || key.length === 0) {
    errors.push("API key is required");
    return { valid: false, errors };
  }

  if (key.length < API_KEY_MIN_LENGTH) {
    errors.push(
      `API key must be at least ${API_KEY_MIN_LENGTH} characters`,
    );
  }

  if (key.length > API_KEY_MAX_LENGTH) {
    errors.push(
      `API key must not exceed ${API_KEY_MAX_LENGTH} characters`,
    );
  }

  if (!API_KEY_PATTERN.test(key)) {
    errors.push(
      'API key must match format: "tq_" followed by alphanumeric characters',
    );
  }

  return { valid: errors.length === 0, errors };
}
