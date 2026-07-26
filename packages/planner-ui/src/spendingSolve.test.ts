import { describe, expect, it } from 'vitest'

import { noTraditionalPlan } from '@retiregolden/engine/decisions/decisionFixtures'
import { runSpendingSolveRequest } from './optimize/runSpendingSolve'
import { runSpendingSolve, type SpendingSolveRequest } from './spendingSolve'

describe('runSpendingSolve', () => {
  it('uses the synchronous solver when Worker is unavailable', async () => {
    expect(typeof Worker).toBe('undefined')
    const request: SpendingSolveRequest = {
      plan: noTraditionalPlan(),
      startYear: 2026,
      maxSimulations: 2,
    }

    await expect(runSpendingSolve(request)).resolves.toEqual(runSpendingSolveRequest(request))
  })
})
