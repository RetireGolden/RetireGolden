/**
 * Seedable RNG for Monte Carlo (roadmap V4). Engine purity requires injected
 * randomness; mulberry32 is fast, tiny, and good enough for simulation
 * sampling (not cryptography). Per-path seeds are derived from (seed, index)
 * so results are reproducible regardless of how paths are split across
 * workers.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number
  /** Standard normal (Box–Muller). */
  nextNormal(): number
  /** Uniform integer in [0, n). */
  nextInt(n: number): number
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  let spareNormal: number | null = null
  return {
    next,
    nextNormal() {
      if (spareNormal !== null) {
        const v = spareNormal
        spareNormal = null
        return v
      }
      // Box–Muller; u clamped away from 0 so log() stays finite.
      const u = Math.max(next(), 1e-12)
      const v = next()
      const r = Math.sqrt(-2 * Math.log(u))
      spareNormal = r * Math.sin(2 * Math.PI * v)
      return r * Math.cos(2 * Math.PI * v)
    },
    nextInt(n: number) {
      return Math.min(n - 1, Math.floor(next() * n))
    },
  }
}

/** SplitMix32-style hash so path i's stream is independent of path i−1's length. */
export function derivePathSeed(seed: number, pathIndex: number): number {
  let h = (seed ^ Math.imul(pathIndex + 1, 0x9e3779b9)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad)
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97)
  return (h ^ (h >>> 15)) >>> 0
}
