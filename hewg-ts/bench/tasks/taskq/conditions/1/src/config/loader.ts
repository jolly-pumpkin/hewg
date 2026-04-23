
import * as fs from "node:fs";
import type { EnvConfig } from "./env";
import { loadEnv } from "./env";

export interface AppConfig extends EnvConfig {
  readonly retryBaseDelay: number;
  readonly maxRetries: number;
  readonly deadLetterThreshold: number;
  readonly billingPeriod: string;
}

interface FileConfig {
  retryBaseDelay?: number;
  maxRetries?: number;
  deadLetterThreshold?: number;
  billingPeriod?: string;
  databasePath?: string;
  port?: number;
  logLevel?: string;
}

const DEFAULT_RETRY_BASE_DELAY = 1000;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_DEAD_LETTER_THRESHOLD = 3;
const DEFAULT_BILLING_PERIOD = "monthly";

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
