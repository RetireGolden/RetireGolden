import { execFileSync, spawnSync } from 'node:child_process'

function gitObject(repoDir, revision) {
  return execFileSync('git', ['rev-parse', revision], {
    cwd: repoDir,
    encoding: 'utf8',
  }).trim()
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    )
  }
}

/**
 * Authenticate the source tree recorded by a non-circular two-commit proof.
 *
 * While a PR is open, the preceding implementation commit must resolve to the
 * recorded tree. After a squash merge, that branch commit may be absent from a
 * fresh clone even though its engine subtree is now reachable through main's
 * squash commit. In that case the current committed subtree is the durable
 * authentication path; it must still match the exact recorded tree object.
 */
export function authenticateObservedEngineTree({
  repoDir,
  observedAtCommit,
  engineSourceTree,
  label,
}) {
  const currentTree = gitObject(repoDir, 'HEAD:packages/engine/src')
  assertEqual(currentTree, engineSourceTree, 'current engine source tree')

  const observedRevision =
    `${observedAtCommit}:packages/engine/src`
  const observed = spawnSync(
    'git',
    ['rev-parse', '--verify', observedRevision],
    { cwd: repoDir, encoding: 'utf8' },
  )
  if (observed.error !== undefined) throw observed.error
  if (observed.status === 0) {
    assertEqual(
      observed.stdout.trim(),
      engineSourceTree,
      `${label} engine source tree`,
    )
    return 'observed-commit'
  }

  // HEAD's exact subtree match above both proves the tree object is available
  // and keeps the fallback closed to the source bytes committed with the spec.
  return 'current-tree-fallback'
}
