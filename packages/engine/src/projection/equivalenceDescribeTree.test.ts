/**
 * `describeTree` provenance — the capture manifest's claim about where the
 * bytes came from. A git-archive extracted inside this repository used to
 * report provenance "observed" because `git -C <archive>/…/src rev-parse HEAD`
 * walks up to the parent .git. The discriminating case is any directory
 * inside this checkout that is not the tracked engine tree: walk-up still
 * finds HEAD, but `ls-files` does not track `projection/simulate.ts` there.
 */
import { describe, expect, it } from 'vitest'
import { describeTree } from '../../scripts/equivalence/describe-tree.mjs'

describe('describeTree provenance', () => {
  it('reports observed for the live engine worktree', () => {
    // vitest cwd is packages/engine; `src` is the tracked engine tree.
    const info = describeTree('src')
    expect(info.provenance).toBe('observed')
    expect(info.gitSha).toMatch(/^[0-9a-f]{40}$/u)
  })

  it('refuses observed when git walked up into a parent that does not track the tree', () => {
    // `src/projection` sits inside this checkout, so rev-parse succeeds, but
    // `projection/simulate.ts` relative to that directory is not in the index.
    // That is the same walk-up an archive extracted under tmp-archive-… hits.
    // If the ls-files guard were dropped, this would come back `observed`.
    const parentSha = describeTree('src').gitSha
    const info = describeTree('src/projection')
    expect(info.provenance).toBe('unknown')
    expect(info.gitSha).toBeNull()
    expect(info.dirty).toBeNull()
    expect(info.gitSha).not.toBe(parentSha)

    const declared = describeTree('src/projection', 'declared-label')
    expect(declared.provenance).toBe('declared')
    expect(declared.gitSha).toBe('declared-label')
  })
})
