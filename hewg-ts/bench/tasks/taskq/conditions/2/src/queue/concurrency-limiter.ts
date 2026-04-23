/**
 *
 * Per-queue concurrency limiter that tracks active slots.
 */

/**
 * Tracks and limits the number of concurrently running jobs per queue.
 */
export class ConcurrencyLimiter {
  private readonly limits: Record<string, number>;
  private readonly active: Record<string, number> = {};

  constructor(limits: Record<string, number>) {
    this.limits = { ...limits };
  }

  /**
   * Try to acquire a concurrency slot for the given queue.
   * Returns true if a slot was acquired, false if at capacity.
   */
  tryAcquire(queueName: string): boolean {
    const limit = this.getLimit(queueName);
    const current = this.getActive(queueName);
    if (current >= limit) {
      return false;
    }
    this.active[queueName] = current + 1;
    return true;
  }

  /**
   * Release a concurrency slot for the given queue.
   */
  release(queueName: string): void {
    const current = this.getActive(queueName);
    if (current > 0) {
      this.active[queueName] = current - 1;
    }
  }

  /**
   * Return the number of active jobs for a queue.
   */
  getActive(queueName: string): number {
    return this.active[queueName] ?? 0;
  }

  /**
   * Return the concurrency limit for a queue.
   * Falls back to 1 if no limit is configured.
   */
  getLimit(queueName: string): number {
    return this.limits[queueName] ?? 1;
  }

  /**
   * Return true if the queue has reached its concurrency limit.
   */
  isAtCapacity(queueName: string): boolean {
    return this.getActive(queueName) >= this.getLimit(queueName);
  }
}
