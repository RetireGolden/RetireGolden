import { describe, expect, it } from 'vitest'

import { EXAMPLE_PLANS } from '@retiregolden/planner-ui/planner/examples/registry'
import { diffCaseManifests, formatCaseDiffSummary } from './caseDiff'
import { defaultExampleCases, runCases, stableCaseManifestJson, type CaseRunnerManifest } from './caseRunner'

describe('local case runner', () => {
  it('uses every example plan as the default case library', () => {
    const cases = defaultExampleCases()
    expect(cases.map((row) => row.id)).toEqual(EXAMPLE_PLANS.map((example) => `example:${example.id}`))
  })

  it('emits byte-stable JSON for the same pinned case set', () => {
    const cases = defaultExampleCases()
    const a = runCases(cases)
    const b = runCases(cases)

    expect(a.totals.caseCount).toBe(EXAMPLE_PLANS.length)
    expect(stableCaseManifestJson(a)).toEqual(stableCaseManifestJson(b))
  })

  it('diffs manifests and honors an allowlist for intentional moves', () => {
    const base = runCases(defaultExampleCases())
    const head = JSON.parse(stableCaseManifestJson(base)) as CaseRunnerManifest
    head.cases[0]!.metrics.endingAfterTaxEstate += 25_000

    const unexpected = diffCaseManifests(base, head)
    expect(unexpected.unexpected).toHaveLength(1)
    expect(formatCaseDiffSummary(unexpected)).toContain('Unexpected case deltas')

    const allowed = diffCaseManifests(base, head, {
      allowed: [{ caseId: head.cases[0]!.id, metric: 'endingAfterTaxEstate', reason: 'intentional fixture nudge' }],
    })
    expect(allowed.unexpected).toHaveLength(0)
    expect(formatCaseDiffSummary(allowed)).toContain('No unexpected case deltas')
  })
})
