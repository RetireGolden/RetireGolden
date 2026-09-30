/**
 * Every committed reach spec reaches every line it names on the blocks corpus.
 *
 * A reach spec claims that the corpus executes a range of production code, so
 * that an equivalence dump over that corpus can say something about it. The
 * claim is only as good as its last measurement, and nothing in CI measured
 * it: on main at f97cf418, 11 of the 32 specs failed on the blocks corpus and
 * no test noticed. This runs `reach-guard.mjs`, which measures all of them in
 * one coverage pass (about five seconds locally, against about two minutes
 * for 32 separate `equivalence.mjs reach` runs), and fails per spec, naming
 * every unreached entry and cold whole line.
 *
 * It runs as its own process for the reason `corpusParses.test.mjs` gives:
 * the engine tree loads through the resolve hook `configureEngineTree`
 * installs, which a vitest worker does not have.
 *
 * Closing a failure: add a blocks member whose plan takes the line, at the
 * end of the tier; or, for a line no plan that parses can execute, narrow the
 * spec's range around it and name it in the entry's note (DOCS/testing.md).
 */
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const guard = resolve(here, 'reach-guard.mjs')
const specNames = readdirSync(resolve(here, 'specs'))
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) => file.replace(/\.json$/u, ''))

let measured = null
let failure = null

describe('reach specs on the blocks corpus', () => {
  beforeAll(() => {
    const run = spawnSync(process.execPath, [guard], { encoding: 'utf8', maxBuffer: 64 << 20 })
    const last = run.stdout.trim().split('\n').pop() ?? ''
    if (run.status !== 0 && run.status !== 1) {
      failure = `reach-guard.mjs exited ${run.status}:\n${run.stdout}${run.stderr}`
      return
    }
    try {
      measured = JSON.parse(last)
    } catch {
      failure = `reach-guard.mjs printed no result line:\n${run.stdout}${run.stderr}`
    }
  }, 180_000)

  it('measures every committed spec in one run', () => {
    expect(failure).toBeNull()
    expect(measured.specs.map((spec) => spec.name)).toEqual(specNames)
    expect(measured.members).toBeGreaterThan(100)
  })

  it.each(specNames)('%s reaches every entry with no cold whole line', (name) => {
    expect(failure).toBeNull()
    const spec = measured.specs.find((candidate) => candidate.name === name)
    expect(spec, `the guard measured no spec named ${name}`).toBeDefined()
    const problems = [
      ...spec.unreached.map((id) => `${id}: NOT REACHED by any member`),
      ...spec.cold.flatMap((entry) =>
        entry.lines.map((cold) =>
          `${entry.id}: cold line ${entry.file}:${cold.line} \`${cold.text}\`` +
            (cold.window === undefined ? '' : `\n    ${cold.window}`))),
    ]
    expect(problems, `${name} fails reach on the blocks corpus:\n  ${problems.join('\n  ')}`).toEqual([])
  })
})
