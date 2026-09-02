import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoDir = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim()
const testedHead = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repoDir,
  encoding: 'utf8',
}).trim()
const verifier =
  'packages/engine/scripts/equivalence/verify-qcd-owner-character-proof.mjs'

function withIsolatedClone(run) {
  const scratch = mkdtempSync(join(tmpdir(), 'retiregolden-owner-proof-negative-'))
  const clone = join(scratch, 'repo')
  try {
    execFileSync('git', [
      'clone', '--quiet', '--shared', '--no-checkout', repoDir, clone,
    ])
    execFileSync('git', ['checkout', '--quiet', '--detach', testedHead], {
      cwd: clone,
    })
    expect(execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: clone,
      encoding: 'utf8',
    }).trim()).toBe(testedHead)
    run(clone)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

function verifierFailure(clone) {
  const result = spawnSync(process.execPath, [resolve(clone, verifier)], {
    cwd: clone,
    encoding: 'utf8',
  })
  expect(result.status).not.toBe(0)
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).not.toMatch(/\bcorpus\s+blocks\b/u)
  return output
}

describe('grouped QCD owner-character proof input authentication', () => {
  it('rejects a path-cleaned working-tree spec mismatch before execution', () => {
    withIsolatedClone((clone) => {
      appendFileSync(
        resolve(
          clone,
          'packages/engine/scripts/equivalence/specs/simulate-qcd-owner-character-boundary.json',
        ),
        ' ',
      )
      expect(verifierFailure(clone)).toContain('proof spec working-tree input')
    })
  })

  it('rejects a tampered transitive harness dependency before execution', () => {
    withIsolatedClone((clone) => {
      appendFileSync(
        resolve(
          clone,
          'packages/engine/scripts/equivalence/describe-tree.mjs',
        ),
        '\n// isolated transitive-tamper probe\n',
      )
      expect(verifierFailure(clone)).toContain(
        'packages/engine/scripts/equivalence/describe-tree.mjs working-tree input',
      )
    })
  })
})
