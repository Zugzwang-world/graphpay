// Deterministic randomness for the synthetic city: mulberry32 and the draws built on it.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function draws(seed) {
  const next = mulberry32(seed);
  const int = (n) => Math.floor(next() * n);
  const normal = () => {
    const u = 1 - next();
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  // Picks an index by weight.
  const weighted = (weights) => {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = next() * total;
    for (let i = 0; i < weights.length; i += 1) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  };
  return { next, int, normal, weighted, chance: (p) => next() < p };
}

// Zipf weights for ranks 1..n with exponent s.
export function zipf(n, s) {
  return Array.from({ length: n }, (_, i) => 1 / (i + 1) ** s);
}
