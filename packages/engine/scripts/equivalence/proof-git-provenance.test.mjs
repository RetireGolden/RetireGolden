import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { authenticateObservedEngineTree } from './proof-git-provenance.mjs'

function git(repoDir, args) {
  return execFileSync('git', args, {
    cwd: repoDir,
    encoding: 'utf8',
  }).trim()
}

function withRepository(run) {
  const repoDir = mkdtempSync(join(tmpdir(), 'retiregolden-proof-provenance-'))
  try {
    git(repoDir, ['init', '--quiet'])
    git(repoDir, ['config', 'user.name', 'Proof Test'])
    git(repoDir, ['config', 'user.email', 'proof@example.invalid'])
    const sourceDir = join(repoDir, 'packages', 'engine', 'src')
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(join(sourceDir, 'index.ts'), 'export const marker = 1\n')
    git(repoDir, ['add', '.'])
    git(repoDir, ['commit', '--quiet', '-m', 'source'])
    run(repoDir)
  } finally {
    rmSync(repoDir, { recursive: true, force: true })
  }
}

describe('proof Git provenance', () => {
  it('authenticates the preceding implementation commit when available', () => {
    withRepository((repoDir) => {
      const head = git(repoDir, ['rev-parse', 'HEAD'])
      const tree = git(repoDir, ['rev-parse', 'HEAD:packages/engine/src'])

      expect(authenticateObservedEngineTree({
        repoDir,
        observedAtCommit: head,
        engineSourceTree: tree,
        label: 'observed proof',
      })).toBe('observed-commit')
    })
  })

  it('falls back to the identical reachable HEAD subtree after squash', () => {
    withRepository((repoDir) => {
      const tree = git(repoDir, ['rev-parse', 'HEAD:packages/engine/src'])

      expect(authenticateObservedEngineTree({
        repoDir,
        observedAtCommit: '0000000000000000000000000000000000000000',
        engineSourceTree: tree,
        label: 'observed proof',
      })).toBe('current-tree-fallback')
    })
  })

  it('rejects fallback when current committed source no longer matches', () => {
    withRepository((repoDir) => {
      expect(() => authenticateObservedEngineTree({
        repoDir,
        observedAtCommit: '0000000000000000000000000000000000000000',
        engineSourceTree: '1111111111111111111111111111111111111111',
        label: 'observed proof',
      })).toThrow('current engine source tree')
    })
  })
})
