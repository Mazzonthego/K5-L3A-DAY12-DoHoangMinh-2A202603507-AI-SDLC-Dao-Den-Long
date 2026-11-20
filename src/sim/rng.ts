/**
 * Deterministic PRNG (mulberry32).
 *
 * Requirement from the Test Contract: same --seed + same scenario + same
 * inputs must produce byte-identical output, including generated ids.
 * Never use Math.random() inside `src/sim`.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
