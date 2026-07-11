import { describe, expect, it } from 'vitest'

import { singlePersonPlan, traditionalAccount, validatePlan } from '@retiregolden/engine/testing/planFixtures'
import { runRelocationCompare } from './runner'
import { runRelocationCompareRequest } from './runRelocation'

describe('relocation compare runner', () => {
  it('runs the request synchronously and via the no-Worker fallback identically', async () => {
    const draft = singlePersonPlan({ state: 'CA', dob: '1961-06-01', planningAge: 80 })
    draft.accounts = [traditionalAccount('trad', 400_000)]
    draft.expenses.baseAnnual = 40_000
    const plan = validatePlan(draft)
    const request = { plan, candidates: [{ state: 'FL' }, { state: 'PA' }], startYear: 2026 }
    const direct = runRelocationCompareRequest(request)
    // Vitest has no Worker global, so this exercises the synchronous fallback.
    const viaRunner = await runRelocationCompare(request)
    expect(viaRunner).toEqual(direct)
    expect(direct.rows).toHaveLength(3)
    expect(direct.rows[0]!.id).toBe('baseline')
    expect(direct.rows.every((r) => r.error === null)).toBe(true)
    // No Monte Carlo requested: deterministic-only rows.
    expect(direct.rows.every((r) => r.successRate === null)).toBe(true)
  })
})
