import { expect, it } from 'vitest'

import type { FormerSpouse, Plan } from '../../model/plan.js'
import {
  describeCalculation,
  withinTolerance,
  worksheetExpectedRows,
  worksheetNumber,
} from '../../rules/describeCalculation.js'
import { couplePlan, singlePersonPlan, validatePlan } from '../../testing/planFixtures.js'
import { benefitsToContributionsRatio, oasdiReturnForPerson } from './oasdiReturn.js'
import { expectedPvSingle, socialSecurityClaimants } from './expectedValue.js'

const WORKSHEET = 'DOCS/calculations/social-security/benefits-to-contributions-ratio.md'
const MUTATION = 'DOCS/calculations/social-security/benefits-to-contributions-ratio.mutation.md'

const rows = worksheetExpectedRows(WORKSHEET)
const value = (label: string): number => worksheetNumber(rows.get(label)![0]!)

/** A single man paid $50,000 a year over the given years, his COLA matching 2.5% inflation, claiming at 67. */
function careerPlan(dob: string, firstYear: number, lastYear: number, amount = 50_000): Plan {
  const plan = singlePersonPlan({ dob })
  plan.household.people[0] = { ...plan.household.people[0]!, sex: 'male' }
  plan.assumptions.inflationPct = 2.5
  plan.assumptions.ssCola = { mode: 'matchInflation' }
  plan.incomes = [{
    type: 'socialSecurity',
    id: 'ss',
    personId: 'p1',
    piaMonthly: null,
    earnings: Array.from({ length: lastYear - firstYear + 1 }, (_, i) => ({ year: firstYear + i, amount })),
    claimAge: { years: 67, months: 0 },
  }]
  return validatePlan(plan)
}

/** Case P: born 1981-06-15, sex 'average' (the mixture of the two survival curves), retiring at 65, $60,000 a year 2003-2025 and projected at $60,000 to 65. */
function projectedCareerPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1981-06-15', retirementAge: 65, planningAge: 90 })
  plan.assumptions.inflationPct = 2.5
  plan.assumptions.ssCola = { mode: 'matchInflation' }
  plan.incomes = [{
    type: 'socialSecurity',
    id: 'ss',
    personId: 'p1',
    piaMonthly: null,
    earnings: Array.from({ length: 23 }, (_, i) => ({ year: 2003 + i, amount: 60_000 })),
    earningsProjection: { assumedAnnualEarnings: 60_000, throughAge: 65 },
    claimAge: { years: 67, months: 0 },
  }]
  return validatePlan(plan)
}

const planA = careerPlan('1960-05-01', 1982, 2021)
const planB = careerPlan('1956-05-01', 1978, 2017)
const at2026 = { startYear: 2026, discountRate: 0.02, selfEmployed: false }

function expectValue(actual: number, label: string): void {
  const expected = value(label)
  expect(withinTolerance(actual, expected, { rel: 1e-12 }), `${label}: ${actual} against the worksheet's ${expected}`).toBe(true)
}

describeCalculation(
  'benefits-to-contributions-ratio',
  {
    example: {
      inputs: {
        planA: 'born 1960-05-01, $50,000 1982-2021, claim 67',
        planB: 'born 1956-05-01, $50,000 1978-2017, claim 67',
        planP: 'born 1981-06-15, $60,000 2003-2025 and projected to 65, claim 67',
        at2026,
      },
      expected: { ratioA: value('A ratio'), ratioB: value('B ratio'), ratioP: value('P ratio') },
      tolerance: { rel: 1e-12 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  () => {
    it('case A: 553,781.61 of expected benefits over 225,418.24 paid in, both in 2026 dollars (2.46)', () => {
      expect(socialSecurityClaimants(planA, 2026)[0]!.piaMonthly).toBe(value('A PIA 2026'))
      const result = oasdiReturnForPerson(planA, 'p1', at2026)!
      expectValue(result.getBackPv, 'A get-back PV')
      expect(result.receivedBeforeStart).toBe(value('A received before start'))
      expectValue(result.paid.paidInToday, 'A paid in today')
      expect(result.paid.projectedToday).toBe(0)
      expectValue(result.ratio!, 'A ratio')
      expect(result.ratio!.toFixed(2)).toBe('2.46')
    })

    it('case B: a person collecting since 2023 counts the three years already received (2.93, not 2.37)', () => {
      expect(socialSecurityClaimants(planB, 2026)[0]!.piaMonthly).toBe(value('B PIA 2026'))
      const result = oasdiReturnForPerson(planB, 'p1', at2026)!
      expectValue(result.getBackPv, 'B get-back PV')
      expectValue(result.receivedBeforeStart, 'B received before start')
      expectValue(result.paid.paidInToday, 'B paid in today')
      expectValue(result.ratio!, 'B ratio')
      expect((result.getBackPv / result.paid.paidInToday).toFixed(2)).toBe('2.37')
    })

    it('case P: the projected work the PIA counts is paid in too, 1.59 rather than 2.46 over the history alone', () => {
      const plan = projectedCareerPlan()
      expect(socialSecurityClaimants(plan, 2026)[0]!.piaMonthly).toBe(value('P PIA 2026'))
      const result = oasdiReturnForPerson(plan, 'p1', at2026)!
      expectValue(result.getBackPv, 'P get-back PV')
      expectValue(result.paid.paidInToday, 'P paid in today')
      expect(withinTolerance(result.paid.projectedToday, value('P projected work'), { abs: 1e-6 })).toBe(true)
      expect(result.paid.projectedYears).toEqual(Array.from({ length: 17 }, (_, i) => 2026 + i))
      expectValue(result.ratio!, 'P ratio')
      expect(result.ratio!.toFixed(2)).toBe('1.59')
    })

    it('in a couple, a divorced spouse\'s benefit enters the get-back only after the spouse\'s death, as the ledger pays it to an unmarried claimant', () => {
      const ex: FormerSpouse = { id: 'ex', relationship: 'divorced', dob: '1960-01-10', piaMonthly: 4_000, marriageYears: 15, remarriedAtAge: null }
      const plan = couplePlan({ p1Dob: '1960-05-01', p2Dob: '1962-05-01' })
      plan.household.people[0] = { ...plan.household.people[0]!, sex: 'male' }
      plan.assumptions.inflationPct = 2.5
      plan.assumptions.ssCola = { mode: 'matchInflation' }
      // $10,000 a year gives a PIA below half the ex's 4,000, so the divorced-spouse benefit would be larger.
      const lowEarner = careerPlan('1960-05-01', 1982, 2021, 10_000)
      plan.incomes = [{ ...lowEarner.incomes[0]!, formerSpouses: [ex] } as Plan['incomes'][number]]
      const couple = validatePlan(plan)
      const result = oasdiReturnForPerson(couple, 'p1', at2026)!
      const claimant = {
        dob: { year: 1960, month: 5, day: 1 },
        sex: 'male' as const,
        piaMonthly: socialSecurityClaimants(couple, 2026)[0]!.piaMonthly,
        claimAge: { years: 67, months: 0 },
        formerSpouses: [ex],
      }
      const options = { startYear: 2026, discountRate: 0.02, assumptions: couple.assumptions }
      const spouse = couple.household.people[1]!
      const widowed = expectedPvSingle(claimant, { single: false, spouse: { id: spouse.id, sex: spouse.sex, dob: { year: 1962, month: 5, day: 1 } } }, options)
      expect(result.getBackPv).toBeCloseTo(widowed, 6)
      // Married throughout it would be the own benefit alone; living alone, the divorced-spouse benefit from the start.
      expect(result.getBackPv).toBeGreaterThan(expectedPvSingle(claimant, { single: false }, options))
      expect(result.getBackPv).toBeLessThan(expectedPvSingle(claimant, { single: true }, options))
    })

    it('no ratio when nothing was paid in, no comparison without an earnings history, and none for a disability benefit from its onset', () => {
      expect(benefitsToContributionsRatio(100_000, 0)).toBeNull()
      expect(benefitsToContributionsRatio(100_000, -1)).toBeNull()
      expect(benefitsToContributionsRatio(300, 100)).toBe(3)
      const entered = singlePersonPlan({ dob: '1960-05-01' })
      entered.incomes = [{ type: 'socialSecurity', id: 'ss', personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 67, months: 0 } }]
      expect(oasdiReturnForPerson(validatePlan(entered), 'p1', at2026)).toBeNull()
      expect(oasdiReturnForPerson(careerPlan('1960-05-01', 1982, 2021, 0), 'p1', at2026)).toBeNull()
      const disabled = careerPlan('1960-05-01', 1982, 2021)
      disabled.incomes = [{ ...disabled.incomes[0]!, disability: { onsetAge: 58 } } as Plan['incomes'][number]]
      expect(oasdiReturnForPerson(validatePlan(disabled), 'p1', at2026)).toBeNull()
    })
  },
)
