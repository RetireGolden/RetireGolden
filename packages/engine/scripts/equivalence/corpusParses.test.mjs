/**
 * Every equivalence corpus member parses under the current plan schema.
 *
 * `equivalence.mjs corpus` refuses a member `parsePlan` refuses, but nothing
 * built a corpus in CI, so #765's schema v7 left two blocks members refused
 * (j1's spending phases named no person, v3's three annuities no annuitant)
 * and every reach spec and proof on the blocks corpus silently stopped
 * building. This runs `corpus-parse-check.mjs`, which builds every tier the
 * tool knows (blocks, and the 29 examples in a full checkout) and parses each
 * member, and nothing else: no capture, dump or reach run, so it stays fast.
 *
 * The second test holds the check itself to account: j1 as it was on main at
 * c2d61967, without `phasesAgeOf`, is refused.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const checker = resolve(here, 'corpus-parse-check.mjs')
const blocks = resolve(here, 'corpus', 'blocks.mjs')

function check(extraArgs = []) {
  const run = spawnSync(process.execPath, [checker, ...extraArgs], { encoding: 'utf8', maxBuffer: 64 << 20 })
  expect(run.status, `${run.stdout}${run.stderr}`).toBe(0)
  return JSON.parse(run.stdout.trim().split('\n').pop())
}

describe('equivalence corpus members', () => {
  it('every member of every tier parses under the current plan schema', () => {
    const result = check()
    expect(result.tiers).toContain('blocks')
    expect(result.members).toBeGreaterThan(100)
    expect(result.invalid).toEqual([])
  })

  it('refuses a member the schema refuses: j1 without the person its phases follow', () => {
    const source = readFileSync(blocks, 'utf8')
    const line = /^\s*plan\.expenses\.phasesAgeOf = 'p1'\r?\n/mu
    expect(source).toMatch(line)
    const dir = mkdtempSync(join(tmpdir(), 'corpus-parse-check-'))
    try {
      const copy = join(dir, 'blocks.mjs')
      writeFileSync(copy, source.replace(line, ''))
      const result = check(['--blocks', copy])
      expect(result.invalid.map((member) => member.id)).toEqual(['blocks:j1-fixedLifestylePhasesAndDeaths'])
      expect(result.invalid[0].issues.join('; ')).toContain('phasesAgeOf')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
