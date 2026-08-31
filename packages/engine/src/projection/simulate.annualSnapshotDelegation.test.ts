/**
 * Seam guard for the annual snapshot extraction.
 *
 * A byte-equivalent projection cannot distinguish delegation from an orphaned
 * helper beside the old inline implementation. The mock below still runs the
 * real helper so it can record the natural snapshot, then returns deliberately
 * different references and scalars. The published year must consume those
 * injected values, proving both the call and the caller-side wiring.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualSnapshot,
  AnnualSnapshotInput,
} from './internal/annualSnapshot.js'

interface SnapshotPhase {
  readonly accountIdsAtCall: readonly string[]
  readonly accountBalancesAtCall: readonly number[]
  readonly unassignedCashAtCall: number
  readonly propertyValuesAtCall: readonly (readonly [string, number])[]
  readonly debtBalancesAtCall: readonly (readonly [string, number])[]
  readonly hecmStatesAtCall: readonly (readonly [string, { readonly loanBalance: number }])[]
  readonly insuranceCashValuesAtCall: readonly (readonly [string, number])[]
  readonly natural: AnnualSnapshot
  readonly injected: AnnualSnapshot
}

const seam = vi.hoisted(() => ({ phases: [] as SnapshotPhase[] }))

vi.mock('./internal/annualSnapshot.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./internal/annualSnapshot.js')>()
  return {
    ...original,
    annualSnapshot: (input: AnnualSnapshotInput): AnnualSnapshot => {
      const natural = original.annualSnapshot(input)
      const ordinal = seam.phases.length
      const scalarSentinels = [
        {
          investableTotal: 1e16,
          propertyTotal: 1,
          debtTotal: 1e16,
          hecmLoanTotal: 400_000,
          hecmEffectiveDebt: 1,
          insuranceCashValueTotal: 1,
        },
        {
          investableTotal: 100,
          propertyTotal: 7,
          debtTotal: 20,
          hecmLoanTotal: 500_000,
          hecmEffectiveDebt: 5,
          insuranceCashValueTotal: 3,
        },
        {
          investableTotal: 250,
          propertyTotal: 11,
          debtTotal: 30,
          hecmLoanTotal: 600_000,
          hecmEffectiveDebt: 6,
          insuranceCashValueTotal: 4,
        },
      ] as const
      const scalars = scalarSentinels[ordinal]
      if (scalars === undefined) {
        throw new Error(`unexpected annual snapshot call ${ordinal}`)
      }
      const injected: AnnualSnapshot = {
        balanceRecord: { [`delegated-snapshot-${ordinal}`]: 70_000 + ordinal },
        ...scalars,
      }
      seam.phases.push({
        accountIdsAtCall: input.balances.map((state) => state.account.id),
        accountBalancesAtCall: input.balances.map((state) => state.balance),
        unassignedCashAtCall: input.unassignedCash,
        propertyValuesAtCall: [...input.propertyValues],
        debtBalancesAtCall: [...input.debtBalances],
        hecmStatesAtCall: [...input.hecmStates].map(([id, line]) => [
          id,
          { ...line },
        ]),
        insuranceCashValuesAtCall: [...input.insuranceCashValues],
        natural,
        injected,
      })
      return injected
    },
  }
})

import type { Account, InsurancePolicy, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const START_YEAR = 2026
const END_YEAR = 2028
const PROPERTY_ID = 'snapshot-home'
const DEBT_ID = 'snapshot-mortgage'
const POLICY_ID = 'snapshot-policy'

const PROPERTY_VALUE = 200_000
const DEBT_BALANCE = 43_210
const HECM_PRINCIPAL_LIMIT = 100_000
const HECM_LOAN_BALANCE = 10_000
const INSURANCE_CASH_VALUE = 25_000
const ANNUAL_GROWTH = 1.1

function grown(opening: number, ordinal: number): number {
  let value = opening
  for (let index = 0; index <= ordinal; index++) value *= ANNUAL_GROWTH
  return value
}

function property(): Account {
  return {
    type: 'property',
    id: PROPERTY_ID,
    name: 'Snapshot home',
    ownerPersonId: null,
    annualReturnPct: null,
    value: PROPERTY_VALUE,
    plannedSaleYear: null,
    expectedNetProceeds: null,
    primaryResidence: true,
    hecm: {
      openYear: START_YEAR,
      principalLimitPct: 50,
      growthRatePct: 10,
      upfrontCostPct: 5,
      drawPolicy: 'lastResort',
    },
  }
}

function debt(): Account {
  return {
    type: 'debt',
    id: DEBT_ID,
    name: 'Snapshot mortgage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance: DEBT_BALANCE,
    interestPct: 10,
    monthlyPayment: 0,
  }
}

function permanentLife(): InsurancePolicy {
  return {
    kind: 'permanentLife',
    id: POLICY_ID,
    name: 'Snapshot whole life',
    insured: 'p1',
    beneficiary: 'estate',
    annualPremium: 0,
    premiumMode: 'paidUp',
    deathBenefit: 0,
    cashValue: INSURANCE_CASH_VALUE,
    cashValueMode: 'flatRate',
    cashValueGrowthPct: 10,
  }
}

function plan(): Plan {
  const value = singlePersonPlan({ planningAge: 90 })
  const growingCash = cashAccount('first-cash', 12_345)
  growingCash.annualReturnPct = 10
  value.expenses.baseAnnual = 0
  value.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  value.assumptions.inflationPct = 10
  value.accounts = [
    growingCash,
    cashAccount('second-cash', 67_890),
    property(),
    debt(),
  ]
  value.insurance = [permanentLife()]
  return validatePlan(value)
}

function run() {
  seam.phases.length = 0
  const value = plan()
  const result = simulatePlan(value, {
    startYear: START_YEAR,
    horizonEndYear: END_YEAR,
    taxCalculator: createFlatTaxCalculator(0),
  })
  return { result, phases: [...seam.phases] }
}

describe('simulatePlan delegates the annual snapshot', () => {
  it('calls the helper exactly once per projected year with the live collections', () => {
    const { result, phases } = run()

    expect(result.years.map((year) => year.year)).toEqual([2026, 2027, 2028])
    expect(phases.length).toBe(result.years.length)
    expect(phases.length).toBeGreaterThan(0)

    for (let ordinal = 0; ordinal < phases.length; ordinal++) {
      const phase = phases[ordinal]!
      const firstCashBalance = grown(12_345, ordinal)
      const propertyValue = grown(PROPERTY_VALUE, ordinal)
      const debtBalance = grown(DEBT_BALANCE, ordinal)
      const hecmPrincipalLimit = grown(HECM_PRINCIPAL_LIMIT, ordinal)
      const hecmLoanBalance = grown(HECM_LOAN_BALANCE, ordinal)
      const insuranceCashValue = grown(INSURANCE_CASH_VALUE, ordinal)

      expect(phase.accountIdsAtCall).toEqual(['first-cash', 'second-cash'])
      expect(phase.accountBalancesAtCall).toEqual([
        firstCashBalance,
        67_890,
      ])
      expect(phase.unassignedCashAtCall).toBe(0)
      expect(phase.propertyValuesAtCall).toEqual([
        [PROPERTY_ID, propertyValue],
      ])
      expect(phase.debtBalancesAtCall).toEqual([
        [DEBT_ID, debtBalance],
      ])
      expect(phase.hecmStatesAtCall).toEqual([
        [
          PROPERTY_ID,
          {
            principalLimit: hecmPrincipalLimit,
            loanBalance: hecmLoanBalance,
          },
        ],
      ])
      expect(phase.insuranceCashValuesAtCall).toEqual([
        [POLICY_ID, insuranceCashValue],
      ])
      expect(phase.natural).toEqual({
        balanceRecord: {
          'first-cash': firstCashBalance,
          'second-cash': 67_890,
          [PROPERTY_ID]: propertyValue,
          [DEBT_ID]: debtBalance,
          [POLICY_ID]: insuranceCashValue,
        },
        investableTotal: 0 + firstCashBalance + 67_890,
        propertyTotal: propertyValue,
        debtTotal: debtBalance,
        hecmLoanTotal: hecmLoanBalance,
        hecmEffectiveDebt: hecmLoanBalance,
        insuranceCashValueTotal: insuranceCashValue,
      })
    }
  })

  it('publishes the helper balance record by identity and consumes every scalar', () => {
    const { result, phases } = run()
    const omissionObserved = {
      investableTotal: false,
      propertyTotal: false,
      debtTotal: false,
      insuranceCashValueTotal: false,
      hecmEffectiveDebt: false,
    }

    expect(phases.length).toBe(result.years.length)
    for (let index = 0; index < result.years.length; index++) {
      const year = result.years[index]!
      const phase = phases[index]!
      const output = phase.injected

      // The load-bearing identity check: a field-for-field caller rebuild fails.
      expect(year.balances).toBe(output.balanceRecord)
      expect(year.investableTotal).toBe(output.investableTotal)
      expect(year.insuranceCashValue).toBe(output.insuranceCashValueTotal)
      expect(year.hecmLoanBalance).toBe(output.hecmLoanTotal)

      // The three otherwise-unpublished snapshot scalars are observable only
      // through this caller-owned fold. The fixture has no TIPS ladder value.
      expect(year.ladderValue).toBe(0)
      const callerAssociation =
        output.investableTotal +
          output.propertyTotal -
          output.debtTotal +
          output.insuranceCashValueTotal +
          year.ladderValue -
          output.hecmEffectiveDebt
      const regroupedAlternative =
        output.investableTotal -
        output.debtTotal +
        (output.propertyTotal + output.insuranceCashValueTotal) +
        year.ladderValue -
        output.hecmEffectiveDebt
      expect(year.netWorth).toBe(callerAssociation)
      if (index === 0) {
        // The first sentinel is cancellation-sensitive: preserving the exact
        // caller association yields 0, while regrouping the debt cancellation
        // first yields 1.
        expect(callerAssociation).toBe(0)
        expect(regroupedAlternative).toBe(1)
      }

      omissionObserved.investableTotal ||= callerAssociation !==
        0 + output.propertyTotal - output.debtTotal +
          output.insuranceCashValueTotal + year.ladderValue -
          output.hecmEffectiveDebt
      omissionObserved.propertyTotal ||= callerAssociation !==
        output.investableTotal + 0 - output.debtTotal +
          output.insuranceCashValueTotal + year.ladderValue -
          output.hecmEffectiveDebt
      omissionObserved.debtTotal ||= callerAssociation !==
        output.investableTotal + output.propertyTotal - 0 +
          output.insuranceCashValueTotal + year.ladderValue -
          output.hecmEffectiveDebt
      omissionObserved.insuranceCashValueTotal ||= callerAssociation !==
        output.investableTotal + output.propertyTotal - output.debtTotal +
          0 + year.ladderValue - output.hecmEffectiveDebt
      omissionObserved.hecmEffectiveDebt ||= callerAssociation !==
        output.investableTotal + output.propertyTotal - output.debtTotal +
          output.insuranceCashValueTotal + year.ladderValue - 0

      // Ensure the assertions above are observing the injected seam result,
      // rather than numbers the natural helper happened to compute as well.
      expect(output.balanceRecord).not.toBe(phase.natural.balanceRecord)
      expect(output.investableTotal).not.toBe(phase.natural.investableTotal)
      expect(output.hecmLoanTotal).not.toBe(phase.natural.hecmLoanTotal)
      expect(output.insuranceCashValueTotal).not.toBe(
        phase.natural.insuranceCashValueTotal,
      )
    }

    expect(new Set(phases.map((phase) => phase.injected.balanceRecord)).size).toBe(
      phases.length,
    )
    expect(new Set(result.years.map((year) => year.balances)).size).toBe(
      result.years.length,
    )
    expect(omissionObserved).toEqual({
      investableTotal: true,
      propertyTotal: true,
      debtTotal: true,
      insuranceCashValueTotal: true,
      hecmEffectiveDebt: true,
    })
    expect(new Set(phases.map((phase) => JSON.stringify(phase.injected))).size).toBe(
      phases.length,
    )
  })
})
