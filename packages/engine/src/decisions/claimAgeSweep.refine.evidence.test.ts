import { expect, it } from 'vitest'

import { describeCalculation, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { refineClaimMonths, type ClaimMonthRow } from './claimAgeSweep.js'

const WORKSHEET = 'DOCS/calculations/social-security/social-security-claim-age-monthly-refinement.md'
const MUTATION = 'DOCS/calculations/social-security/social-security-claim-age-monthly-refinement.mutation.md'

const rows = worksheetExpectedRows(WORKSHEET)
const expectedOf = (label: string): number => worksheetNumber(rows.get(label)![0]!)

/** Case R-A's priced months; every other month ranks 0, eligible, with no estate. */
const priced: Record<string, ClaimMonthRow> = {
  '68-5': { primaryValue: 130, eligible: false, endingAfterTaxEstate: 900 },
  '68-9': { primaryValue: 120, eligible: true, endingAfterTaxEstate: 400 },
  '69-7': { primaryValue: 90, eligible: true, endingAfterTaxEstate: 800 },
  '70-0': { primaryValue: 60, eligible: true, endingAfterTaxEstate: 700 },
}
const winner: ClaimMonthRow = { primaryValue: 100, eligible: true, endingAfterTaxEstate: 500 }

describeCalculation(
  'social-security-claim-age-monthly-refinement',
  {
    example: {
      inputs: { winner: { claim: '69y0m', ...winner }, priced, currentAge: 60 },
      expected: {
        pickYears: expectedOf('R-A pick years'),
        pickMonths: expectedOf('R-A pick months'),
        primaryChange: expectedOf('R-A primary change'),
        estateChange: expectedOf('R-A estate change'),
        rejected: expectedOf('R-A rejected ineligible better'),
        monthsPriced: expectedOf('R-A months priced'),
      },
      tolerance: 'exact',
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  ({ example }) => {
    it('R-A: takes the best eligible month on the objective, not the highest estate, and counts the rejected one', () => {
      const seen: string[] = []
      const search = refineClaimMonths(
        { claimByPersonId: { p1: 69 }, row: winner },
        [{ personId: 'p1', currentAge: 60 }],
        (claim) => {
          const key = `${claim['p1']!.years}-${claim['p1']!.months}`
          seen.push(key)
          return priced[key] ?? { primaryValue: 0, eligible: true, endingAfterTaxEstate: 0 }
        },
      )
      expect(search.claimByPersonId['p1']).toEqual({ years: expectedOf('R-A pick years'), months: expectedOf('R-A pick months') })
      expect(search.row.primaryValue - winner.primaryValue).toBe(example.expected.primaryChange)
      expect(search.row.endingAfterTaxEstate - winner.endingAfterTaxEstate).toBe(example.expected.estateChange)
      expect(search.rejectedIneligibleBetter).toBe(example.expected.rejected)
      expect(search.evaluations).toBe(example.expected.monthsPriced)
      expect(seen).toHaveLength(expectedOf('R-A months priced'))
      // 70 is tried only at 70y0m.
      expect(seen.filter((key) => key.startsWith('70-'))).toEqual(['70-0'])
      expect(search.moved).toBe(true)
    })
  },
)
