/**
 *
 * Loads JSON configuration from disk and merges with environment
 * variables to produce a complete AppConfig.
 */

import * as fs from "node:fs";
import type { EnvConfig } from "./env";
import { loadEnv } from "./env";

/**
 * Load configuration from an optional JSON file path and merge it
 * with environment variables. File settings are overridden by env.
 *
 */
export function loadConfig(configPath?: string): AppConfig {
  let fileConfig: FileConfig = {};

  if (configPath) {
    const raw = fs.readFileSync(configPath, "utf-8");
    fileConfig = JSON.parse(raw) as FileConfig;
  }

  const envConfig = loadEnv();

  return {
    ...envConfig,
    databasePath: envConfig.databasePath !== "./data/taskq.json"
      ? envConfig.databasePath
      : fileConfig.databasePath ?? envConfig.databasePath,
    retryBaseDelay: fileConfig.retryBaseDelay ?? DEFAULT_RETRY_BASE_DELAY,
    maxRetries: fileConfig.maxRetries ?? DEFAULT_MAX_RETRIES,
    deadLetterThreshold:
      fileConfig.deadLetterThreshold ?? DEFAULT_DEAD_LETTER_THRESHOLD,
    billingPeriod: fileConfig.billingPeriod ?? DEFAULT_BILLING_PERIOD,
  };
}

/**
 * Validate an AppConfig and return an array of human-readable error
 * strings. An empty array means the config is valid.
 *
 */
export function validateConfig(config: AppConfig): string[] {
  const errors: string[] = [];

  if (config.port < 1 || config.port > 65535) {
    errors.push(`Invalid port: ${config.port}`);
  }
  if (config.maxWorkers < 1) {
    errors.push(`maxWorkers must be at least 1, got ${config.maxWorkers}`);
  }
  if (config.maxRetries < 0) {
    errors.push(`maxRetries must be non-negative, got ${config.maxRetries}`);
  }
  if (config.retryBaseDelay < 0) {
    errors.push(`retryBaseDelay must be non-negative`);
  }
  if (config.deadLetterThreshold < 1) {
    errors.push(`deadLetterThreshold must be at least 1`);
  }
  if (!config.jwksUrl.startsWith("https://")) {
    errors.push(`jwksUrl must use HTTPS: ${config.jwksUrl}`);
  }

  return errors;
}
