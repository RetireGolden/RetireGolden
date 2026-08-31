/**
 * Declarations for the equivalence encoder, so the engine suite can pin its
 * behaviour under strict TypeScript without pulling `scripts/` into the
 * compiled package surface.
 *
 * Exact precedent: `scripts/rules-coverage.d.mts`, consumed by
 * `src/rules/coverageReport.freshness.test.ts`.
 */

/** A losslessly encoded tree: plain JSON, hashable and diffable. */
export type Encoded = unknown

export interface Mismatch {
  path: string
  base: string
  head: string
}

/**
 * Losslessly encode an arbitrary result tree. Distinguishes `-0`, `NaN`,
 * `±Infinity`, present-but-`undefined`, key order, Map/Set insertion order and
 * array length; throws on functions, symbol values, symbol-keyed or
 * non-enumerable own properties, and cycles.
 */
export declare function encode(value: unknown, path?: string, seen?: Set<object>): Encoded

/** Canonical text form of an encoded tree. Deterministic by construction. */
export declare function encodeToText(value: unknown): string

/**
 * Recursive walk over two ENCODED trees comparing every leaf with `Object.is`.
 * Returns at most `limit` mismatches; an empty array means the two trees are
 * leaf-for-leaf identical.
 */
export declare function diffEncoded(
  base: Encoded,
  head: Encoded,
  limit?: number,
  path?: string,
  out?: Mismatch[],
): Mismatch[]
