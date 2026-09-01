/**
 * Declarations for operator-input failures, so the CLI-usage tests can import
 * them under strict TypeScript without pulling `scripts/` into the compiled
 * package surface.
 */

export declare class UsageError extends Error {}
export declare const REACH_SPEC_SCHEMA: 'retiregolden.equivalence-reach-spec/1'
export declare function modesFromFlag(flag: string): readonly { id: string }[]
export declare function assertReachSpecSchema(spec: { schema?: unknown }, path: string): void
export interface ReachEntryAnchor {
  line: number
  text: string
}
export interface AnchoredReachEntry {
  id: string
  file: string
  lines: [number, number]
  anchors?: readonly ReachEntryAnchor[]
}
export declare function assertReachEntryAnchors(
  entries: readonly AnchoredReachEntry[],
  path: string,
  readSource: (file: string) => string,
): void
