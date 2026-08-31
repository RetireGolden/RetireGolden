/**
 * `describeTree` provenance — the capture manifest's claim about where the
 * bytes came from. A `git archive` extracted *inside* this repository used to
 * report `provenance: 'observed'` because `git -C <archive>/packages/engine/src
 * rev-parse HEAD` walks up to the parent `.git`. That is the case this file
 * pins; a real worktree must still come back `observed`.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { describeTree } from '../../scripts/equivalence/engine-tree.mjs'

const engineSrc = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/gu, '/')

describe('describeTree provenance', () => {
  it('reports observed for the live engine worktree', () => {
    const info = describeTree(engineSrc)
    expect(info.provenance).toBe('observed')
    expect(info.gitSha).toMatch(/^[0-9a-f]{40}$/u)
  })

  it('refuses observed for an archive extracted inside this repository', () => {
    // Same layout an operator gets from `git archive | tar -x` under a path
    // that still sits inside the checkout — the walk-up that made this look
    // like a clean worktree.
    const root = mkdtempSync(join(process.cwd(), 'tmp-equivalence-archive-'))
    const src = join(root, 'packages', 'engine', 'src')
    try {
      mkdirSync(join(src, 'projection'), { recursive: true })
      writeFileSync(join(src, 'projection', 'simulate.ts'), '// archive fixture\n')
      const parentSha = describeTree(engineSrc).gitSha
      const info = describeTree(src)
      expect(info.provenance).toBe('unknown')
      expect(info.gitSha).toBeNull()
      expect(info.dirty).toBeNull()
      // The parent repo's HEAD is exactly what must not be reported as this
      // tree's observed SHA.
      expect(info.gitSha).not.toBe(parentSha)

      const declared = describeTree(src, 'declared-label')
      expect(declared.provenance).toBe('declared')
      expect(declared.gitSha).toBe('declared-label')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('refuses observed for an archive extracted outside any repository', () => {
    const root = mkdtempSync(join(tmpdir(), 'equivalence-archive-'))
    const src = join(root, 'packages', 'engine', 'src')
    try {
      mkdirSync(join(src, 'projection'), { recursive: true })
      writeFileSync(join(src, 'projection', 'simulate.ts'), '// archive fixture\n')
      const info = describeTree(src)
      expect(info.provenance).toBe('unknown')
      expect(info.gitSha).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
