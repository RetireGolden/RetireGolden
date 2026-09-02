import { execFileSync, spawnSync } from 'node:child_process'

function gitObject(repoDir, revision) {
  return execFileSync('git', ['rev-parse', revision], {
    cwd: repoDir,
    encoding: 'utf8',
  }).trim()
}

function requiredGitObject(repoDir, revision, label) {
  const result = spawnSync(
    'git',
    ['rev-parse', '--verify', revision],
    { cwd: repoDir, encoding: 'utf8' },
  )
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `${label} could not resolve ${JSON.stringify(revision)}: ${result.stderr.trim()}`,
    )
  }
  return result.stdout.trim()
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    )
  }
}

function observedCommitState(repoDir, commit) {
  if (!/^[0-9a-f]{40}$/u.test(commit)) {
    throw new Error(
      `observed source commit must be a full lowercase Git SHA: ${JSON.stringify(commit)}`,
    )
  }
  const output = execFileSync(
    'git',
    ['cat-file', '--batch-check=%(objectname) %(objecttype)'],
    { cwd: repoDir, encoding: 'utf8', input: `${commit}\n` },
  ).trim()
  if (output === `${commit} missing`) return 'missing'
  const [objectName, objectType, ...extra] = output.split(' ')
  if (objectName !== commit || objectType !== 'commit' || extra.length > 0) {
    throw new Error(
      `observed source object must resolve to commit ${commit}; got ${JSON.stringify(output)}`,
    )
  }
  return 'commit'
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

  const state = observedCommitState(repoDir, observedAtCommit)
  if (state === 'commit') {
    const observedRevision =
      `${observedAtCommit}:packages/engine/src`
    assertEqual(
      requiredGitObject(repoDir, observedRevision, label),
      engineSourceTree,
      `${label} engine source tree`,
    )
    return 'observed-commit'
  }

  // HEAD's exact subtree match above both proves the tree object is available
  // and keeps the fallback closed to the source bytes committed with the spec.
  process.stderr.write(
    `${label}: observed commit ${observedAtCommit} is unavailable; ` +
    `authenticated reachable current tree ${engineSourceTree}\n`,
  )
  return 'current-tree-fallback'
}
