/**
 * @hewg-module taskq/queue/rate-limiter
 *
 * Token-bucket rate limiter keyed by arbitrary string keys.
 * Reads the system clock to track bucket refills.
 */

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * A token-bucket rate limiter. Each key gets its own bucket
 * that refills at a configured rate.
 */
export class RateLimiter {
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly buckets: Map<string, TokenBucket> = new Map();

  constructor(maxTokens: number, refillRatePerSecond: number) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRatePerSecond;
  }

  /**
   * Try to consume one token from the bucket for the given key.
   * Returns true if a token was consumed, false if the bucket is empty.
   * @hewg-module taskq/queue/rate-limiter
   * @effects time.read
   */
  tryConsume(key: string): boolean {
    this.refill(key);
    const bucket = this.getBucket(key);
    if (bucket.tokens < 1) {
      return false;
    }
    bucket.tokens -= 1;
    return true;
  }

  /**
   * Return the number of tokens remaining in the bucket for a key.
   * @hewg-module taskq/queue/rate-limiter
   * @effects time.read
   */
  getRemainingTokens(key: string): number {
    this.refill(key);
    return Math.floor(this.getBucket(key).tokens);
  }

  /**
   * Reset the bucket for a key back to full capacity.
   * @hewg-module taskq/queue/rate-limiter
   * @effects time.read
   */
  resetBucket(key: string): void {
    this.buckets.set(key, {
      tokens: this.maxTokens,
      lastRefill: Date.now(),
    });
  }

  private getBucket(key: string): TokenBucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: Date.now() };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  private refill(key: string): void {
    const bucket = this.getBucket(key);
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    const newTokens = elapsed * this.refillRate;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + newTokens);
    bucket.lastRefill = now;
  }
}
