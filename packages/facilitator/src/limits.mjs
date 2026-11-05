// In-memory limits. They are per instance (Fluid compute runs several, and an instance restarts
// with fresh counters): the on-chain caps and the relayer-balance floor are the real bounds.

// A sliding one-minute window per key.
export class RateLimiter {
  constructor(max, windowMs, clock = () => Date.now()) {
    this.max = max;
    this.windowMs = windowMs;
    this.clock = clock;
    this.hits = new Map();
  }

  #recent(key) {
    const since = this.clock() - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > since);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.hits.delete(this.hits.keys().next().value);
    return list;
  }

  peek(key) {
    return this.#recent(key).length < this.max;
  }

  take(key) {
    const list = this.#recent(key);
    if (list.length >= this.max) return false;
    list.push(this.clock());
    return true;
  }
}

// A total that resets at 00:00 UTC (the contract's day).
export class DailyCounter {
  constructor(clock = () => Date.now()) {
    this.clock = clock;
    this.day = -1;
    this.total = 0n;
  }

  #roll() {
    const day = Math.floor(this.clock() / 86_400_000);
    if (day !== this.day) {
      this.day = day;
      this.total = 0n;
    }
  }

  value() {
    this.#roll();
    return this.total;
  }

  add(n) {
    this.#roll();
    this.total += BigInt(n);
    if (this.total < 0n) this.total = 0n;
  }
}
