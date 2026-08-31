/**
 * Identify an engine source tree for a capture manifest.
 *
 * Split out of `engine-tree.mjs` so provenance can be tested without
 * registering Node 24's `registerHooks` (the loader that file needs).
 */
import { execFileSync } from 'node:child_process'
import { isAbsolute, resolve as resolvePath } from 'node:path'

/** @param {string} dir @returns {string} POSIX-slashed absolute path */
export function normalizeDir(dir) {
  const absolute = isAbsolute(dir) ? dir : resolvePath(process.cwd(), dir)
  return absolute.split('\\').join('/').replace(/\/+$/u, '')
}

/** @param {string} dir @param {readonly string[]} args @returns {string | null} */
function git(dir, args) {
  try {
    return execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

/**
 * Identify a source tree for the manifest. A tree materialized by `git archive`
 * has no `.git`, so its sha can only ever be DECLARED by the caller — and a
 * declared label must never be able to masquerade as an observed one.
 *
 * `git -C <dir> rev-parse` walks UP to the first `.git`. An archive extracted
 * *inside* another checkout therefore reports that parent as `observed` even
 * though these bytes are not the worktree. Fail closed: only trust a SHA when
 * the discovered repo actually tracks this tree (`projection/simulate.ts` is
 * the file `configureEngineTree` already requires). A real worktree passes;
 * an archive under /tmp or under `<repo>/tmp-archive-…` does not — `ls-files`
 * looks at the parent index and the path is untracked. Do not use "git root
 * is outside src": that is true of every normal `packages/engine/src` too.
 *
 * @param {string} dir
 * @param {string | null} declaredLabel
 */
export function describeTree(dir, declaredLabel = null) {
  const src = normalizeDir(dir)
  const observed = git(src, ['rev-parse', 'HEAD'])
  const tracked = git(src, ['ls-files', '--error-unmatch', '--', 'projection/simulate.ts'])
  if (observed === null || tracked === null) {
    return {
      src,
      gitSha: declaredLabel,
      dirty: null,
      dirtyPaths: [],
      provenance: declaredLabel === null ? 'unknown' : 'declared',
    }
  }
  // Scoped to the source tree itself. A dirty file elsewhere in the repository
  // (a script, a doc, this tool) cannot move a projection, and reporting it
  // would make every capture look untrustworthy; a dirty file INSIDE the tree
  // is exactly what must never be mistaken for a clean SHA. The scope is named
  // in the manifest rather than left for a reader to infer.
  const status = git(src, ['status', '--porcelain', '--', src]) ?? ''
  const dirtyPaths = status.split('\n').map((line) => line.trim()).filter((line) => line !== '')
  return {
    src,
    gitSha: observed,
    dirtyScope: src,
    dirty: dirtyPaths.length > 0,
    dirtyPaths,
    provenance: 'observed',
    ...(declaredLabel !== null && declaredLabel !== observed ? { declaredLabelIgnored: declaredLabel } : {}),
  }
}
