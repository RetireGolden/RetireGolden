import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import type { ProjectionSummary } from '../projection/compare.js'
import type { ProjectionResult } from '../projection/types.js'
import { describeCalculation, worksheetExpectedRows } from '../rules/describeCalculation.js'
import { claimYearOf, isClaimAlreadyMade } from '../socialSecurity/openClaims.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { setAcaYearContract } from '../testing/planFixtures.js'
import { claimAgeSweepVerdict, sweepClaimAges } from './claimAgeSweep.js'
import { maximizeAfterTaxEstate } from './objectives.js'
import { rankEvaluations } from './tournament.js'
import type { DecisionContext, ExactDecisionEvaluation } from './types.js'

const WORKSHEET = 'DOCS/calculations/social-security/social-security-claim-age-sweep.md'
const MUTATION = 'DOCS/calculations/social-security/social-security-claim-age-sweep.mutation.md'

const rows = worksheetExpectedRows(WORKSHEET)
const expectedOf = (label: string): string => rows.get(label)![0]!
const numberOf = (label: string): number => Number(expectedOf(label).replace(/,/gu, ''))

const emptyResult: ProjectionResult = {
  startYear: 2026,
  endYear: 2056,
  years: [],
  depletionYear: null,
  endingInvestable: 0,
  endingNetWorth: 0,
  endingNondeductibleIraBasis: 0,
  warnings: [],
}
// The after-tax-estate policy reads only an evaluation's deltas and state.
const ctx = {} as DecisionContext

/** One ranked-by-estate row: the claim age as its id, its estate change against the plan as entered. */
function row(age: number, estateChange: number, diagnostic = false): ExactDecisionEvaluation {
  return {
    candidate: { id: String(age), source: 'scenario-sweep', category: 'social-security', label: String(age), explanation: String(age) },
    baselineSummary: {} as ProjectionSummary,
    candidateSummary: {} as ProjectionSummary,
    candidateResult: emptyResult,
    deltas: { endingAfterTaxEstate: estateChange, endingNetWorth: 0, lifetimeTax: 0, moneyLastsYears: 0 },
    conversionExecution: null,
    traditionalDepletionYear: null,
    diagnostics: diagnostic ? ['the plan has a year whose premium tax credit cannot be priced'] : [],
    recommendationState: diagnostic ? 'diagnostic' : 'neutral',
    diagnosticCauses: diagnostic ? ['the plan has a year whose premium tax credit cannot be priced'] : [],
  }
}

function sweepOf(evaluations: ExactDecisionEvaluation[], unpricedYears = 0) {
  const { ranked, winner } = rankEvaluations(evaluations, ctx, maximizeAfterTaxEstate, 0)
  return {
    order: ranked.map((r) => r.evaluation.candidate.id).join(', '),
    winner: winner?.evaluation.candidate.id ?? null,
    verdict: claimAgeSweepVerdict(ranked, winner !== null, unpricedYears),
  }
}

let counter = 0
function plan(dob: string, claim: { years: number; months: number }, mutate?: (draft: Plan) => void): Plan {
  const draft = createEmptyPlan({ newId: () => `sweep-evidence-${++counter}` })
  draft.household.people[0] = { id: 'p1', name: 'Pat', dob, sex: 'average', retirementAge: null, longevity: { planningAge: 92, source: 'manual' } }
  draft.assumptions.inflationPct = 2
  draft.assumptions.defaultReturnPct = 5
  draft.expenses.baseAnnual = 45_000
  const taxable: Account = { type: 'taxable', id: 'brokerage', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 900_000, costBasis: 900_000, annualContribution: 0 }
  draft.accounts = [taxable]
  draft.incomes = [{ type: 'socialSecurity', id: 'ss', personId: 'p1', piaMonthly: 2_500, earnings: null, claimAge: claim }]
  mutate?.(draft)
  const parsed = parsePlan(draft)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

const options = { startYear: 2026, taxCalculator: createFederalTaxCalculator(), objectivePolicyId: 'max-after-tax-estate' as const }

describeCalculation(
  'social-security-claim-age-sweep',
  {
    example: {
      inputs: {
        sF1: { 62: -40_000, 67: 0, 70: 25_000, 69: '30,000, diagnostic' },
        sG: { startYear: 2026 },
      },
      expected: {
        sF1Order: expectedOf('S-F1 ranked order'),
        sF1Winner: numberOf('S-F1 winner'),
        sG1964At62: numberOf('S-G 1964 at 62'),
      },
      tolerance: 'exact',
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  () => {
    it('S-F: ranks eligible rows first with a margin of 0, and reads flatness only without a winner', () => {
      const f1 = sweepOf([row(62, -40_000), row(67, 0), row(70, 25_000), row(69, 30_000, true)])
      expect(f1.order).toBe(expectedOf('S-F1 ranked order'))
      expect(f1.winner).toBe(expectedOf('S-F1 winner'))
      expect(f1.verdict).toBe('winner')
      expect(sweepOf([row(62, 0.2), row(67, 0), row(70, -0.1)]).winner).toBe(expectedOf('S-F2 winner'))
      expect(sweepOf([row(67, -0.4), row(70, 0)]).verdict).toBe(expectedOf('S-F3 verdict'))
      expect(sweepOf([row(67, 0, true), row(70, 12_000, true)], 1).verdict).toBe(expectedOf('S-F4 verdict'))
      expect(sweepOf([row(67, 0, true), row(70, 12_000, true)], 0).verdict).toBe(expectedOf('S-F5 verdict'))
      expect(sweepOf([row(67, 0), row(70, -3)]).verdict).toBe(expectedOf('S-F6 verdict'))
    })

    it('S-G: a claim year before the start year is already made, and one in the start year is open', () => {
      const cases: Array<[string, string, number, boolean]> = [
        ['S-G 1953 at 67', '1953-06-15', 67, true],
        ['S-G 1953 at 70', '1953-06-15', 70, true],
        ['S-G 1955 at 67', '1955-03-10', 67, true],
        ['S-G 1962 at 70', '1962-06-15', 70, false],
        ['S-G 1964 at 62', '1964-11-30', 62, false],
        ['S-G 1962 canonical 62', '1962-06-15', 62, true],
      ]
      for (const [label, dob, years, made] of cases) {
        expect(claimYearOf({ dob }, { years, months: 0 }), label).toBe(numberOf(label))
        expect(isClaimAlreadyMade({ dob }, { years, months: 0 }, 2026), label).toBe(made)
      }
    })

    it('S-E: compares with the plan as entered, claim months included, and calls no whole-year row current', () => {
      const sweep = sweepClaimAges(plan('1964-06-15', { years: 67, months: 6 }), options)
      expect(sweep.current!.claimByPersonId).toEqual({ p1: { years: 67, months: 6 } })
      expect(sweep.rows.filter((r) => r.isCurrent)).toHaveLength(numberOf('S-E current rows'))
      expect(sweep.verdict).toBe('winner')
      expect(Object.is(sweep.winnerEstateChangeVsCurrent, sweep.winner!.endingAfterTaxEstate - sweep.current!.endingAfterTaxEstate)).toBe(true)
      expect(sweep.estateYear).toBe(2056)
    })

    it('S-H: refuses on an unpriced credit year, naming the year and its own reason, and still publishes the rows', () => {
      const sweep = sweepClaimAges(
        plan('1966-06-15', { years: 67, months: 0 }, (draft) => {
          draft.household.people[0]!.longevity.planningAge = 90
          draft.accounts = [{ type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 300_000, annualContribution: 0 }]
          draft.incomes.push({ type: 'recurring', id: 'work', label: 'Work', annualAmount: 40_000, startYear: 2026, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary' })
          for (const year of [2026, 2027, 2028]) setAcaYearContract(draft, { year })
        }),
        options,
      )
      expect(sweep.verdict).toBe('aca-unpriced')
      expect(sweep.unpricedAca.map((y) => y.year).join(', ')).toBe(expectedOf('S-H unpriced years'))
      expect(sweep.unpricedAca[0]!.reasons.join(', ')).toBe(expectedOf('S-H 2028 reasons'))
      expect(sweep.unpricedAca[1]!.reasons.join(', ')).toBe(expectedOf('S-H 2029 reasons'))
      expect(sweep.rows.length).toBeGreaterThan(0)
      expect(sweep.winner).toBeNull()
    })

    it('S-I and S-J: refuses a claim already made and a disability benefit, with no row', () => {
      const made = sweepClaimAges(plan('1953-06-15', { years: 67, months: 0 }), options)
      expect(made.verdict).toBe(expectedOf('S-I verdict'))
      expect(made.alreadyClaimed.map((c) => c.claimYear)).toEqual([numberOf('S-I claim year')])
      expect(made.rows).toEqual([])
      const disabled = sweepClaimAges(
        plan('1966-06-15', { years: 67, months: 0 }, (draft) => {
          draft.incomes = [{ ...draft.incomes[0]!, disability: { onsetAge: 55 } } as Plan['incomes'][number]]
        }),
        options,
      )
      expect(disabled.verdict).toBe(expectedOf('S-J verdict'))
      expect(disabled.rows).toEqual([])
    })
  },
)
