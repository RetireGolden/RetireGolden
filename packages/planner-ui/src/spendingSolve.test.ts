import { afterEach, describe, expect, it, vi } from 'vitest'

import { noTraditionalPlan } from '@retiregolden/engine/decisions/decisionFixtures'
import { runSpendingSolveRequest } from './optimize/runSpendingSolve'
import { runSpendingSolve, type SpendingSolveRequest } from './spendingSolve'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runSpendingSolve', () => {
  it('uses the synchronous solver when Worker is unavailable', async () => {
    vi.stubGlobal('Worker', undefined)
    expect(typeof Worker).toBe('undefined')
    const request: SpendingSolveRequest = {
      plan: noTraditionalPlan(),
      startYear: 2026,
      maxSimulations: 2,
    }

    await expect(runSpendingSolve(request)).resolves.toEqual(runSpendingSolveRequest(request))
  })

  it('turns synchronous fallback errors into Promise rejections', async () => {
    vi.stubGlobal('Worker', undefined)
    const invalidRequest: SpendingSolveRequest = {
      plan: {} as SpendingSolveRequest['plan'],
      startYear: 2026,
    }
    let returned!: ReturnType<typeof runSpendingSolve>

    expect(() => {
      returned = runSpendingSolve(invalidRequest)
    }).not.toThrow()
    expect(returned).toBeInstanceOf(Promise)
    await expect(returned).rejects.toThrow()
  })
})
