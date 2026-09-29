import { expect, it } from 'vitest'

import { describeCalculation, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { CLAIM_MONTH_REFINEMENT_MAX_PASSES, refineClaimMonths, type ClaimAgeValue, type ClaimMonthRow } from './claimAgeSweep.js'

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

    it('R-B: repeats whole passes, windows on the starting year, to the fixed point, in either visiting order', () => {
      // A claim's month index is its months since 65y0m; the objective is
      // coupled, so each pass moves each claim six months along the ridge.
      const index = (claim: ClaimAgeValue) => (claim.years - 65) * 12 + claim.months
      const primary = (i1: number, i2: number) => Math.min(i1, i2 + 3) + Math.min(i2, i1 + 3)
      const run = (order: readonly string[]) => {
        const seen = new Set<string>()
        const search = refineClaimMonths(
          { claimByPersonId: { p1: 66, p2: 66 }, row: { primaryValue: primary(12, 12), eligible: true, endingAfterTaxEstate: 0 } },
          order.map((personId) => ({ personId, currentAge: 60 })),
          (claim) => {
            const key = `${claim['p1']!.years}-${claim['p1']!.months} ${claim['p2']!.years}-${claim['p2']!.months}`
            expect(seen.has(key), key).toBe(false)
            seen.add(key)
            // The windows stay on the starting whole year: 65y0m to 67y11m.
            expect([claim['p1']!.years, claim['p2']!.years].every((years) => years >= 65 && years <= 67), key).toBe(true)
            return { primaryValue: primary(index(claim['p1']!), index(claim['p2']!)), eligible: true, endingAfterTaxEstate: 0 }
          },
        )
        return search
      }
      const pick = { years: expectedOf('R-B pick years'), months: expectedOf('R-B pick months') }
      for (const order of [['p1', 'p2'], ['p2', 'p1']]) {
        const search = run(order)
        expect(search.claimByPersonId, order.join()).toEqual({ p1: pick, p2: pick })
        expect(search.row.primaryValue - primary(12, 12)).toBe(expectedOf('R-B primary change'))
        expect(search.evaluations).toBe(expectedOf('R-B months priced'))
      }
      expect(CLAIM_MONTH_REFINEMENT_MAX_PASSES).toBe(5)
    })
  },
)
