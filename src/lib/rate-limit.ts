/**
 * Single-instance in-memory rate limiter, extracted from the contact
 * action so every lead-generating Server Action shares one implementation.
 * The app runs as one container; if it is ever scaled horizontally this
 * must move to Redis, because each instance keeps its own allowance.
 */
export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();
  return function limited(key: string): boolean {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) {
      for (const [k, times] of hits) {
        if (times.every((t) => now - t >= windowMs)) hits.delete(k);
      }
    }
    return recent.length > max;
  };
}
