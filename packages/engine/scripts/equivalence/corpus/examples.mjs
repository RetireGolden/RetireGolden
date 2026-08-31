/**
 * The `examples` corpus tier: the 29 curated example plans, built exactly as
 * `packages/planner-ui/src/planner/examples/examples.golden.test.ts` builds
 * them — `EXAMPLE_PLANS[].build()`, then `parseExamplePlan` (which fills in the
 * ACA planning-year contracts the standard editor does not expose), at
 * `EXAMPLE_FIXED_YEAR` with the plan's own state tax settings.
 *
 * THE ONE COUPLING IN THIS TOOL, stated rather than hidden: this is an engine
 * script reaching sideways into `packages/planner-ui/src`. It is justified
 * because these are the most realistic full-fidelity plans in the repository —
 * long horizons, real allocations, real property, real Social Security — and
 * inventing 29 equivalents would be strictly worse. The cost is that this tier
 * fails loudly if those files move, and that it can only be built from a full
 * repository checkout (never from a `git archive` of `packages/engine/src`).
 * That is why the tier is optional and the corpus is materialized to JSON as a
 * SEPARATE step: once built, a capture needs nothing but the engine tree.
 *
 * The planner-ui builders are read through the same resolve hook as the engine,
 * so their `@retiregolden/engine/...` imports land in the configured tree and
 * their extensionless relative imports resolve to `.ts`.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
/** scripts/equivalence/corpus -> scripts/equivalence -> scripts -> packages/engine -> packages -> <repo> */
const repositoryDir = resolve(here, '..', '..', '..', '..', '..')
const examplesDir = resolve(repositoryDir, 'packages', 'planner-ui', 'src', 'planner', 'examples')

export function examplesTierAvailable() {
  return existsSync(resolve(examplesDir, 'registry.ts'))
}

export function examplesTierLocation() {
  return examplesDir.split('\\').join('/')
}

/** @returns {Promise<object[]>} one member per curated example, in registry order. */
export async function exampleMembers() {
  if (!examplesTierAvailable()) {
    throw new Error(
      `the "examples" tier needs a full repository checkout; not found: ${examplesTierLocation()}`,
    )
  }
  const [{ EXAMPLE_FIXED_YEAR, parseExamplePlan }, { EXAMPLE_PLANS }] = await Promise.all([
    import(pathToFileURL(resolve(examplesDir, 'buildContext.ts')).href),
    import(pathToFileURL(resolve(examplesDir, 'registry.ts')).href),
  ])
  return EXAMPLE_PLANS.map((example) => {
    const parsed = parseExamplePlan(example.build())
    if (!parsed.ok) throw new Error(`example "${example.id}" is invalid: ${parsed.issues.join('; ')}`)
    return {
      id: `example:${example.id}`,
      covers: 'curated example plan, full fidelity',
      plan: parsed.plan,
      options: { startYear: EXAMPLE_FIXED_YEAR },
      tax: { kind: 'planState' },
    }
  })
}
