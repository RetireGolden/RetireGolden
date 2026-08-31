/**
 * Operator-facing failures of `scripts/equivalence.mjs` that must stay on the
 * UsageError path (usage text, exit 2) rather than a raw stack.
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const script = fileURLToPath(new URL('../../scripts/equivalence.mjs', import.meta.url))

function run(args: string[]) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
}

describe('equivalence CLI: operator-input failures', () => {
  it('unknown --modes prints usage, not a stack', () => {
    const result = run([
      'capture',
      '--corpus',
      'unused.json',
      '--out',
      'unused.json',
      '--modes',
      'cashflow',
    ])
    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/unknown mode "cashflow"/u)
    expect(result.stderr).toMatch(/Usage:/u)
    expect(result.stderr).not.toMatch(/^\s*at /mu)
  })

  it('reach refuses an unknown spec schema', () => {
    const dir = mkdtempSync(join(process.cwd(), 'tmp-equivalence-cli-'))
    try {
      const membersSha256 = createHash('sha256').update(JSON.stringify([]), 'utf8').digest('hex')
      const corpus = join(dir, 'corpus.json')
      writeFileSync(
        corpus,
        JSON.stringify({
          schema: 'retiregolden.equivalence-corpus/1',
          membersSha256,
          members: [],
        }),
      )
      const spec = join(dir, 'spec.json')
      writeFileSync(spec, JSON.stringify({ schema: 'retiregolden.equivalence-reach-spec/0', entries: [] }))
      const result = run(['reach', '--corpus', corpus, '--spec', spec])
      expect(result.status).toBe(2)
      expect(result.stderr).toMatch(/is not a retiregolden\.equivalence-reach-spec\/1 spec/u)
      expect(result.stderr).toMatch(/Usage:/u)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
