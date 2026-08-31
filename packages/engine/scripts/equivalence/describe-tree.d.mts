/**
 * Declarations for the tree identifier, so the provenance test can import
 * `describeTree` under strict TypeScript without pulling `scripts/` into the
 * compiled package surface.
 */

export interface TreeDescription {
  src: string
  gitSha: string | null
  dirty: boolean | null
  dirtyPaths: string[]
  provenance: 'observed' | 'declared' | 'unknown'
  dirtyScope?: string
  declaredLabelIgnored?: string
}

export declare function normalizeDir(dir: string): string
export declare function describeTree(dir: string, declaredLabel?: string | null): TreeDescription
