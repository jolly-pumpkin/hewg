/**
 * @hewg-module taskq/workers/registry
 *
 * Worker factory registry that maps worker types to their
 * construction functions. Pure data structure, no side effects.
 */

import type { WorkerConfig, WorkerType } from "../types/worker";
import type { BaseWorker } from "./base";

/** A factory function that creates a worker from a config. */
export type WorkerFactory = (config: WorkerConfig) => BaseWorker;

/**
 * Registry that maps WorkerType values to factory functions.
 */
export class WorkerRegistry {
  private readonly factories: Map<WorkerType, WorkerFactory> = new Map();

  /**
   * Register a factory function for a given worker type.
   * Replaces any existing factory for that type.
   * @hewg-module taskq/workers/registry
   * @effects
   */
  register(type: WorkerType, factory: WorkerFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * Retrieve the factory function for a given worker type.
   * Returns undefined if no factory is registered.
   * @hewg-module taskq/workers/registry
   * @effects
   */
  getFactory(type: WorkerType): WorkerFactory | undefined {
    return this.factories.get(type);
  }

  /**
   * List all registered worker types.
   * @hewg-module taskq/workers/registry
   * @effects
   */
  listTypes(): WorkerType[] {
    return Array.from(this.factories.keys());
  }
}
