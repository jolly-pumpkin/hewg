
import type { CreateJobInput } from "../types/job";
import { JobPriority } from "../types/job";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

const MAX_QUEUE_NAME_LENGTH = 128;
const QUEUE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.-]*$/;
const MAX_ATTEMPTS_LIMIT = 25;

export function validateCreateJobInput(
  input: CreateJobInput,
  maxPayloadBytes: number = 1_048_576,
): ValidationResult {
  const errors: string[] = [];

  if (!input.tenantId || input.tenantId.trim().length === 0) {
    errors.push("tenantId is required");
  }

  if (!input.queueName || input.queueName.trim().length === 0) {
    errors.push("queueName is required");
  } else if (input.queueName.length > MAX_QUEUE_NAME_LENGTH) {
    errors.push(
      `queueName exceeds maximum length of ${MAX_QUEUE_NAME_LENGTH}`,
    );
  } else if (!QUEUE_NAME_PATTERN.test(input.queueName)) {
    errors.push(
      "queueName must start with a letter and contain only alphanumeric characters, underscores, dots, or hyphens",
    );
  }

  if (input.payload === undefined || input.payload === null) {
    errors.push("payload is required");
  } else if (!validateJobPayload(input.payload, maxPayloadBytes)) {
    errors.push(
      `payload exceeds maximum size of ${maxPayloadBytes} bytes`,
    );
  }

  if (input.priority !== undefined) {
    const validPriorities = Object.values(JobPriority).filter(
      (v) => typeof v === "number",
    );
    if (!validPriorities.includes(input.priority)) {
      errors.push("priority must be a valid JobPriority value");
    }
  }

  if (input.maxAttempts !== undefined) {
    if (
      !Number.isInteger(input.maxAttempts) ||
      input.maxAttempts < 1 ||
      input.maxAttempts > MAX_ATTEMPTS_LIMIT
    ) {
      errors.push(
        `maxAttempts must be an integer between 1 and ${MAX_ATTEMPTS_LIMIT}`,
      );
    }
  }

  if (input.scheduledAt !== undefined) {
    if (!(input.scheduledAt instanceof Date) || isNaN(input.scheduledAt.getTime())) {
      errors.push("scheduledAt must be a valid Date");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateJobPayload(
  payload: unknown,
  maxBytes: number,
): boolean {
  try {
    const serialized = JSON.stringify(payload);
    const byteLength = new TextEncoder().encode(serialized).length;
    return byteLength <= maxBytes;
  } catch {
    return false;
  }
}
