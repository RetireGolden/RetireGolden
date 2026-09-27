import { describe, expect, it, vi } from 'vitest'

import type { YearResult } from '../projection/types.js'

vi.mock('../projection/dollarBasis.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../projection/dollarBasis.js')>()
  return { ...actual, projectionDollarBasis: vi.fn(actual.projectionDollarBasis) }
})

import { projectionDollarBasis } from '../projection/dollarBasis.js'
import { comparePlanHeadlines, type ComparedProjection } from './planHeadlines.js'

/** A side with a 2.5% inflation ledger from 2026 to `endYear` and the four summary figures. */
function side(endYear: number, estate: number): ComparedProjection {
  const years: YearResult[] = []
  let factor = 1
  for (let year = 2026; year <= endYear; year++) {
    years.push({ year, inflationScale: factor, tax: 1_000, penalties: 0 } as unknown as YearResult)
    factor *= 1.025
  }
  return {
    plan: { household: { people: [{ dob: '1960-01-01' }] } } as unknown as ComparedProjection['plan'],
    result: { startYear: 2026, endYear, depletionYear: null, years },
    summary: {
      endingNetWorth: estate,
      endingInvestable: estate,
      endingAfterTaxEstate: estate,
      lifetimeTaxesAndPenalties: 1_000 * (endYear - 2025),
    },
  }
}

// B2-P1 slice 3 review (PR #754, finding 9): each side's dollar basis is built
// once per comparison, not once per ending row and again for the lifetime sum.
describe('comparePlanHeadlines builds each dollar basis once', () => {
  it('builds one basis per side when the plans end in different years', () => {
    vi.mocked(projectionDollarBasis).mockClear()
    const baseline = side(2050, 1_800_000)
    const proposal = side(2060, 2_000_000)
    const headline = comparePlanHeadlines(baseline, proposal)
    expect(headline.moneyBasis).toBe('today')
    const calls = vi.mocked(projectionDollarBasis).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[0]![0]).toBe(baseline.result)
    expect(calls[1]![0]).toBe(proposal.result)
  })

  it('builds none when the plans end in the same year', () => {
    vi.mocked(projectionDollarBasis).mockClear()
    const headline = comparePlanHeadlines(side(2050, 1_000_000), side(2050, 1_250_000))
    expect(headline.moneyBasis).toBe('nominal')
    expect(vi.mocked(projectionDollarBasis)).not.toHaveBeenCalled()
  })
})
