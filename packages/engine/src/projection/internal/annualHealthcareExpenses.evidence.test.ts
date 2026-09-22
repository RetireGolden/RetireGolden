import { expect, it } from 'vitest'

import type { Plan } from '../../model/plan.js'
import { parsePlan } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import { createFederalTaxCalculator } from '../../tax/federalTax.js'
import { simulatePlan } from '../simulate.js'
import type { PersonYearState } from '../types.js'
import {
  annualHealthcareExpenses,
  type IrmaaLookbackMagiSource,
} from './annualHealthcareExpenses.js'

function expectWithin(
  actual: number,
  expected: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, expected, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${expected}`,
  ).toBe(true)
}

function validated(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describeCalculation(
  'irmaa-lookback-selection',
  {
    example: {
      inputs: {
        premiumYear: 2028,
        startYear: 2026,
        yearMinusTwoMagi: 120_000,
        yearMinusOneMagi: 90_000,
        tieMagi: 100_000,
        historical2024Magi: 125_000,
        recentAnnualMagi: 80_000,
      },
      expected: {
        ordinary: { year: 2026, magi: 120_000, source: 'projected' },
        ssa44Lower: { year: 2027, magi: 90_000, source: 'projected' },
        ssa44Tie: { year: 2026, magi: 100_000, source: 'projected' },
        firstYearFallback: { year: 2024, magi: 125_000, source: 'historicalInput' },
        secondYearFallback: { year: 2025, magi: 80_000, source: 'planFallback' },
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/medicare-and-aca/irmaa-lookback-selection.md',
    mutation: 'DOCS/calculations/medicare-and-aca/irmaa-lookback-selection.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<
      string,
      { year: number; magi: number; source: IrmaaLookbackMagiSource }
    >
    const { pack, isStandIn } = packForYear(2026)

    /**
     * The premium-year selection, driven through the phase at the injection
     * point the caller uses: `resolveMagiFor` is the simulator's own resolver
     * and answers for a projected ledger here.
     */
    function selectionFor(
      magiByYear: ReadonlyMap<number, number>,
      ssa44Active: boolean,
    ): { year: number; magi: number; source: IrmaaLookbackMagiSource } {
      const plan = singlePersonPlan({ dob: '1956-01-01', planningAge: 95 })
      const peopleStates: PersonYearState[] = [{ personId: 'p1', ageAttained: 72, alive: true }]
      const result = annualHealthcareExpenses({
        plan,
        pack,
        year: inputs.premiumYear!,
        startYear: inputs.startYear!,
        peopleStates,
        birthMonthByPerson: new Map([['p1', 1]]),
        resolveMagiFor: (year) => ({
          magi: magiByYear.get(year) ?? 0,
          source: 'projected',
          year,
        }),
        ssa44ActiveInYear: () => ssa44Active,
        filingStatusForYear: 'single',
        taxFilingStatusForYear: 'single',
        inflFactorFrom: () => 1,
        healthInflFactorFrom: () => 1,
        isStandIn,
        hasModeledPerson: (personId) => peopleStates.some((state) => state.personId === personId),
        resolvePerson: (personId) => peopleStates.find((state) => state.personId === personId)!,
        planHasTaxExemptYieldAttestation: false,
        taxExemptInterest: 0,
      })
      return {
        year: result.irmaaLookbackMagiYear,
        magi: result.irmaaMagi,
        source: result.irmaaLookbackMagiSource,
      }
    }

    const projectedYears = new Map<number, number>([
      [inputs.premiumYear! - 2, inputs.yearMinusTwoMagi!],
      [inputs.premiumYear! - 1, inputs.yearMinusOneMagi!],
    ])
    const tiedYears = new Map<number, number>([
      [inputs.premiumYear! - 2, inputs.tieMagi!],
      [inputs.premiumYear! - 1, inputs.tieMagi!],
    ])

    it('reads year minus two with no SSA-44 event', () => {
      const selection = selectionFor(projectedYears, false)
      expect(selection.year).toBe(expected.ordinary!.year)
      expect(selection.source).toBe(expected.ordinary!.source)
      expectWithin(selection.magi, expected.ordinary!.magi, example.tolerance, 'ordinary lookback MAGI')
    })

    it('takes year minus one under SSA-44 when it is strictly lower', () => {
      const selection = selectionFor(projectedYears, true)
      expect(selection.year).toBe(expected.ssa44Lower!.year)
      expect(selection.source).toBe(expected.ssa44Lower!.source)
      expectWithin(selection.magi, expected.ssa44Lower!.magi, example.tolerance, 'SSA-44 lookback MAGI')
    })

    it('keeps year minus two on a tie, because the comparison is strictly lower', () => {
      const selection = selectionFor(tiedYears, true)
      expect(selection.year).toBe(expected.ssa44Tie!.year)
      expect(selection.source).toBe(expected.ssa44Tie!.source)
      expectWithin(selection.magi, expected.ssa44Tie!.magi, example.tolerance, 'tied lookback MAGI')
    })

    it('falls back to the plan\'s historical entry, then to its coarse stand-in, before the ledger', () => {
      // The two initial years run through the simulator's own resolveMagiFor,
      // so the fallback chain is the real one rather than an injected double.
      const plan = singlePersonPlan({ dob: '1956-01-01', planningAge: 95 })
      plan.assumptions.recentAnnualMagi = inputs.recentAnnualMagi!
      plan.assumptions.historicalAnnualMagiByYear = {
        [String(expected.firstYearFallback!.year)]: inputs.historical2024Magi!,
      }
      const result = simulatePlan(validated(plan), {
        startYear: inputs.startYear!,
        horizonEndYear: inputs.startYear! + 1,
        taxCalculator: createFederalTaxCalculator(),
      })
      const rowFor = (year: number) => {
        const row = result.years.find((entry) => entry.year === year)
        if (row === undefined) throw new Error(`missing projection year ${year}`)
        return row
      }

      const first = rowFor(inputs.startYear!)
      expect(first.irmaaLookbackMagiYear).toBe(expected.firstYearFallback!.year)
      expect(first.irmaaLookbackMagiSource).toBe(expected.firstYearFallback!.source)
      expectWithin(
        first.irmaaLookbackMagi ?? Number.NaN,
        expected.firstYearFallback!.magi,
        example.tolerance,
        'first-year lookback MAGI',
      )

      const second = rowFor(inputs.startYear! + 1)
      expect(second.irmaaLookbackMagiYear).toBe(expected.secondYearFallback!.year)
      expect(second.irmaaLookbackMagiSource).toBe(expected.secondYearFallback!.source)
      expectWithin(
        second.irmaaLookbackMagi ?? Number.NaN,
        expected.secondYearFallback!.magi,
        example.tolerance,
        'second-year lookback MAGI',
      )
    })
  },
)
