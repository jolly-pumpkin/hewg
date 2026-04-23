
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly buckets: Map<string, TokenBucket> = new Map();

  constructor(maxTokens: number, refillRatePerSecond: number) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRatePerSecond;
  }

  tryConsume(key: string): boolean {
    this.refill(key);
    const bucket = this.getBucket(key);
    if (bucket.tokens < 1) {
      return false;
    }
    bucket.tokens -= 1;
    return true;
  }

  getRemainingTokens(key: string): number {
    this.refill(key);
    return Math.floor(this.getBucket(key).tokens);
  }

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
