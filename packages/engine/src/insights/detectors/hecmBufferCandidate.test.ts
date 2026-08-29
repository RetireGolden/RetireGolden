import { describe, expect, it } from 'vitest'

import { packForYear } from '../../params/index.js'
import { describeRule } from '../../rules/describeRule.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { hecmBufferCandidate } from './hecmBufferCandidate.js'

function context(dob: string): DetectorContext {
  const plan = singlePersonPlan({ dob })
  plan.accounts = [
    {
      id: 'home',
      name: 'Home',
      type: 'property',
      value: 450_000,
      primaryResidence: true,
      plannedSaleYear: null,
    },
    // House-rich, portfolio-thin: the home dwarfs the investable balance,
    // which is the shape the detector exists for.
    { id: 'cash', name: 'Cash', type: 'cash', balance: 200_000 },
  ] as never
  return {
    plan,
    params: packForYear(2026).pack,
    projection: { startYear: 2026, result: { years: [] } },
  } as never
}

describe('hecmBufferCandidate', () => {
  // 12 U.S.C. 1715z-20(b)(1) defines the eligible homeowner as one who is, or
  // whose spouse is, at least 62. Under the accepted reading a household whose
  // youngest member is 61 gets no HECM candidate; the rejected reading would
  // surface the card a year early.
  describeRule('usc-12-1715z-20-b-hecm-minimum-age-62', {
    note: 'no HECM buffer candidate below age 62',
    readings: {
      refusedUnderSixtyTwo: null,
      surfacedUnderSixtyTwo: 'hecm-buffer-candidate',
    },
    accepted: 'refusedUnderSixtyTwo',
  }, ({ accepted, readings }) => {
    it('refuses at 61 and surfaces at 62 for an otherwise qualifying home', () => {
      expect(hecmBufferCandidate.screen(context('1965-01-01'))).toBe(accepted)
      const at62 = hecmBufferCandidate.screen(context('1964-01-01'))
      expect(at62?.id).toBe(readings.surfacedUnderSixtyTwo)
    })
  })
})
