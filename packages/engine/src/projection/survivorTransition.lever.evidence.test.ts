import { expect, it } from 'vitest'

import { parseRetirementActionRequest } from '../actions/contract.js'
import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { describeCalculation, withinTolerance, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { applyScenarioPatch } from '../scenarios/scenarios.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { simulatePlan } from './simulate.js'
import { SURVIVOR_LEVER_BRACKET_PCT, conversionLeverPatch, leverYears } from './survivorTransition.js'

const WORKSHEET = 'DOCS/calculations/social-security/survivor-convert-early-lever.md'
const MUTATION = 'DOCS/calculations/social-security/survivor-convert-early-lever.mutation.md'

const rows = worksheetExpectedRows(WORKSHEET)
const cell = (label: string, column: number): number => worksheetNumber(rows.get(label)![column]!)

type Strategy = Plan['strategies']['rothConversion']

/** Case L-A: a joint couple born in 1966, $92,200 of 2026 wages, a $500,000 IRA, cash, an empty Roth IRA. */
function laPlan(own: Strategy, cashOnly = false, mutate?: (draft: Plan) => void): Plan {
  let id = 0
  const draft = createEmptyPlan({ newId: () => `lever-la-${++id}`, now: () => new Date('2026-01-01T00:00:00.000Z') })
  draft.household.filingStatus = 'marriedFilingJointly'
  draft.household.people = [
    { id: 'p1', name: 'Pat', dob: '1966-06-15', sex: 'average', retirementAge: 67, longevity: { planningAge: 61, source: 'manual' } },
    { id: 'p2', name: 'Sam', dob: '1966-08-01', sex: 'average', retirementAge: 67, longevity: { planningAge: 61, source: 'manual' } },
  ]
  draft.assumptions.inflationPct = 0
  draft.assumptions.defaultReturnPct = 0
  draft.accounts = [
    { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 500_000, annualContribution: 0 },
    ...(cashOnly
      ? []
      : [
          { type: 'traditional' as const, id: 'ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira' as const, balance: 500_000, annualContribution: 0 },
          { type: 'roth' as const, id: 'roth', name: 'Roth IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira' as const, balance: 0, annualContribution: 0 },
        ]),
  ]
  draft.incomes = [{ type: 'wages', id: 'wages', personId: 'p1', annualGross: 92_200, endAge: null, realGrowthPct: 0 }]
  draft.expenses.baseAnnual = 0
  draft.expenses.healthcare = { ...draft.expenses.healthcare, pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false }
  draft.strategies.rothConversion = own
  mutate?.(draft)
  const parsed = parsePlan(draft)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

const options = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }
const lever = { bracketPct: SURVIVOR_LEVER_BRACKET_PCT, startYear: 2026, endYear: 2026 }
const manual = (amount: number): Strategy => ({ mode: 'manual', conversions: [{ year: 2026, amount }] })

/** Case L-B's named variant: a $10,000 conversion Pat names for 2026, from the IRA to the Roth IRA. */
function namedConversion(draft: Plan): void {
  draft.retirementActionEligibilityFacts = {
    iraClassifications: [{ evidenceId: 'ira-classification', provenance: { source: 'manual' }, sourceAccountId: 'ira', subtype: 'traditional' }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  } as Plan['retirementActionEligibilityFacts']
  const parsed = parseRetirementActionRequest({
    actionId: 'named-conversion',
    kind: 'rothConversion',
    personId: 'p1',
    year: 2026,
    executionDate: '2026-06-30',
    executionSequence: 1,
    requestedAmount: 10_000_00,
    provenance: { source: 'manual' },
    allocations: [{ allocationId: 'named-conversion-allocation', sourceAccountId: 'ira', requestedAmount: 10_000_00 }],
    destinationRothAccountId: 'roth',
    taxFunding: { kind: 'noneExpected' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  draft.strategies.retirementActions = [parsed.request]
}

/** Case L-B: the L-A household varied so each reason a window year can have appears once. */
const L_B: ReadonlyArray<readonly [string, Strategy, boolean, ((draft: Plan) => void) | undefined]> = [
  ['L-B none', { mode: 'none' }, false, undefined],
  ['L-B manual 55,000', manual(55_000), false, undefined],
  ['L-B cash only', { mode: 'none' }, true, undefined],
  ['L-B Roth IRA is Sam\'s', { mode: 'none' }, false, (draft) => {
    draft.accounts = draft.accounts.map((a) => (a.type === 'roth' ? { ...a, ownerPersonId: 'p2' } : a))
  }],
  ['L-B no Roth account', { mode: 'none' }, false, (draft) => {
    draft.accounts = draft.accounts.filter((a) => a.type !== 'roth')
  }],
  ['L-B wages 140,000', { mode: 'none' }, false, (draft) => {
    draft.incomes = [{ type: 'wages', id: 'wages', personId: 'p1', annualGross: 140_000, endAge: null, realGrowthPct: 0 }]
  }],
  ['L-B safety-net floor 600,000', { mode: 'none' }, false, (draft) => {
    draft.strategies.taxableSafetyNetFloor = 600_000
  }],
  ['L-B named conversion', { mode: 'none' }, false, namedConversion],
]

function leverYear(plan: Plan) {
  const run = simulatePlan(plan, { ...options, additionalBracketFill: lever })
  return { year: run.years[0]!, ...leverYears(run) }
}

describeCalculation(
  'survivor-convert-early-lever',
  {
    example: {
      inputs: { wages: 92_200, standardDeduction: 32_200, bracketTop12: 100_800, window: [2026, 2026] },
      expected: {
        none: cell('L-A none', 0),
        manual30000: cell('L-A manual 30,000', 0),
        manual55000: cell('L-A manual 55,000', 0),
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  ({ example }) => {
    const close = (actual: number, expected: number, label: string) =>
      expect(withinTolerance(actual, expected, example.tolerance), `${label}: ${actual} against the worksheet's ${expected}`).toBe(true)

    it('L-A: converts the larger of the plan\'s own conversion and the 12% fill, never less than the plan', () => {
      for (const [label, own] of [['L-A none', { mode: 'none' }], ['L-A manual 30,000', manual(30_000)], ['L-A manual 55,000', manual(55_000)]] as const) {
        const { year } = leverYear(laPlan(own as Strategy))
        close(year.rothConversion, cell(label, 0), `${label} conversion`)
        close(year.tax, cell(label, 1), `${label} tax`)
      }
    })

    it('L-A: the retired replacement converts less than a plan already past the bracket', () => {
      const patched = applyScenarioPatch(laPlan(manual(55_000)), conversionLeverPatch(2026, 2026))
      if (!patched.ok) throw new Error(patched.issues.join('; '))
      const year = simulatePlan(patched.plan, options).years[0]!
      close(year.rothConversion, cell('L-A replacement, manual 55,000', 0), 'replacement conversion')
      close(year.tax, cell('L-A replacement, manual 55,000', 1), 'replacement tax')
    })

    it('L-A: names the raised and covered years on executed dollars, the fill capped at the convertible balance', () => {
      expect(leverYear(laPlan({ mode: 'none' })).raisedYears).toHaveLength(cell('L-A raised years, none', 0))
      const covered = leverYear(laPlan(manual(55_000)))
      expect(covered.raisedYears).toHaveLength(cell('L-A raised years, manual 55,000', 0))
      expect(covered.coveredYears).toHaveLength(cell('L-A covered years, manual 55,000', 0))
      const cashOnly = leverYear(laPlan({ mode: 'none' }, true))
      expect(cashOnly.raisedYears).toHaveLength(cell('L-A raised years, cash only', 0))
      expect(cashOnly.coveredYears).toHaveLength(cell('L-A covered years, cash only', 0))
      expect(cashOnly.year.rothConversion).toBe(0)
    })

    it('L-B: gives each window year its own reason from executed dollars, with the ledger\'s words', () => {
      for (const [label, own, cashOnly, mutate] of L_B) {
        const { year, years } = leverYear(laPlan(own, cashOnly, mutate))
        const expected = rows.get(label)!
        expect(years.map((y) => y.reason), label).toEqual([expected[2]])
        close(year.rothConversion, worksheetNumber(expected[0]!), `${label} conversion`)
        const note = expected[3]!.trim()
        expect(years[0]!.notes, label).toEqual(note === '' ? [] : [note.replace(/^"|"$/gu, '')])
      }
    })
  },
)
