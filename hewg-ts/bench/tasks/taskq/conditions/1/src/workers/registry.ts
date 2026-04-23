
import type { WorkerConfig, WorkerType } from "../types/worker";
import type { BaseWorker } from "./base";

export type WorkerFactory = (config: WorkerConfig) => BaseWorker;

export class WorkerRegistry {
  private readonly factories: Map<WorkerType, WorkerFactory> = new Map();

  register(type: WorkerType, factory: WorkerFactory): void {
    this.factories.set(type, factory);
  }

  getFactory(type: WorkerType): WorkerFactory | undefined {
    return this.factories.get(type);
  }

  listTypes(): WorkerType[] {
    return Array.from(this.factories.keys());
  }
}
