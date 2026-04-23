
export class ConcurrencyLimiter {
  private readonly limits: Record<string, number>;
  private readonly active: Record<string, number> = {};

  constructor(limits: Record<string, number>) {
    this.limits = { ...limits };
  }

  tryAcquire(queueName: string): boolean {
    const limit = this.getLimit(queueName);
    const current = this.getActive(queueName);
    if (current >= limit) {
      return false;
    }
    this.active[queueName] = current + 1;
    return true;
  }

  release(queueName: string): void {
    const current = this.getActive(queueName);
    if (current > 0) {
      this.active[queueName] = current - 1;
    }
  }

  getActive(queueName: string): number {
    return this.active[queueName] ?? 0;
  }

  getLimit(queueName: string): number {
    return this.limits[queueName] ?? 1;
  }

  isAtCapacity(queueName: string): boolean {
    return this.getActive(queueName) >= this.getLimit(queueName);
  }
}
