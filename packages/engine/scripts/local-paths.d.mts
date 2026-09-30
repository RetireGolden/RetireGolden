/**
 * Declarations for the local-path scan, so its conformance test can import it
 * under strict TypeScript without pulling scripts/ into the compiled package.
 */

/** Every local machine path in `text`, with its 1-based line and the whole path token. */
export declare function findLocalPaths(text: string): { line: number; token: string }[]

/** The files the rule covers, from git's index or (a copy with no repository of its own, or `disk`) from the disk. */
export declare function listScopedFiles(
  root?: string,
  options?: { disk?: boolean },
): { source: 'git' | 'disk'; paths: string[] }

/** Every local machine path in the covered text files. */
export declare function scanForLocalPaths(root?: string): {
  source: 'git' | 'disk'
  paths: string[]
  found: { path: string; line: number; token: string }[]
}
