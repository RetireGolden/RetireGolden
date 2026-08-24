/**
 * Stage 6 property tests for capture-on `YearResult.cashFlow`.
 *
 * Every capture-on year of a representative fixture set must satisfy the
 * contract identities in `DOCS/features/year-cash-flow.md`: cash conservation,
 * requested = funded + unfunded, transfer pairing, no duplicate ids,
 * nonnegative physical amounts, omit-zero (owned-IRA RMD zero-net exception),
 * lexicographic id order, and capture-on determinism. Expected dollar values
 * are not taken from `assembleYearCashFlow`; these are structural invariants.
 *
 * Monte Carlo / optimizer / relocation callers are not threaded the flag.
 * A `simulatePlan` call shaped like `montecarlo/run.ts:119` must stay
 * key-absent.
 */
import { describe, expect, it } from 'vitest'

import { parsePlan, type Account, type Plan } from '../model/plan.js'
import {
  cashAccount,
  couplePlan,
  singlePersonPlan,
  taxableAccount,
  traditionalAccount,
} from '../testing/planFixtures.js'
import { compareCashFlowLineId } from './annualCashFlowIds.js'
import {
  CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
  CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS,
} from './annualCashFlowCapture.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type {
  ProjectionResult,
  YearCashFlowSourceLine,
  YearCashFlowTransferLine,
  YearResult,
} from './types.js'

const noTax = createFlatTaxCalculator(0)
const START_YEAR = 2026
const TOLERANCE = CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS

function validate(plan: Plan): Plan {
  const result = parsePlan(plan)
  if (!result.ok) throw new Error(result.issues.join('; '))
  return result.plan
}

function captureOn(plan: Plan, extra: { horizonEndYear?: number } = {}): ProjectionResult {
  return simulatePlan(validate(plan), {
    startYear: START_YEAR,
    taxCalculator: noTax,
    captureAnnualCashFlow: true,
    ...extra,
  })
}

function wages(annualGross: number): Plan['incomes'][number] {
  return {
    type: 'wages',
    id: 'wage-1',
    personId: 'p1',
    annualGross,
    endAge: null,
    realGrowthPct: 0,
  }
}

function emptyPlan(): Plan {
  return singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
}

function wagesLifestylePlan(): Plan {
  const plan = emptyPlan()
  plan.incomes = [wages(40_000)]
  plan.expenses.baseAnnual = 40_000
  return plan
}

function reinvestPlan(): Plan {
  const plan = emptyPlan()
  const brokerage = taxableAccount('brokerage-1', 100_000, 100_000) as Extract<Account, { type: 'taxable' }>
  brokerage.interestYieldPct = 4
  brokerage.reinvestDividends = true
  plan.accounts = [brokerage]
  return plan
}

function coupleOwnedIraRmdPlan(): Plan {
  const plan = couplePlan({
    p1Dob: '1953-01-01',
    p2Dob: '1953-01-01',
    p1PlanningAge: 80,
    p2PlanningAge: 80,
    p1RetirementAge: null,
    p2RetirementAge: null,
  })
  plan.accounts = [
    cashAccount('cash-1', 0),
    traditionalAccount('ira-p1', 265_000, 'p1', 'ira'),
    traditionalAccount('ira-p2', 132_500, 'p2', 'ira'),
  ]
  plan.expenses.baseAnnual = 40_000
  return plan
}

function qcdZeroNetPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 90, retirementAge: null })
  plan.accounts = [
    cashAccount('cash-1', 0),
    traditionalAccount('ira-1', 237_000, 'p1', 'ira'),
  ]
  plan.strategies.qcdAnnual = 10_000
  return plan
}

function shortfallLifestylePlan(): Plan {
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70 })
  plan.accounts = [cashAccount('cash-1', 22_000)]
  plan.expenses.requiredAnnual = 10_000
  plan.expenses.baseAnnual = 20_000
  plan.expenses.idealAnnual = 5_000
  plan.expenses.excessAnnual = 5_000
  return plan
}

function twoOwnerNeedBasedPlan(): Plan {
  const plan = couplePlan({
    p1Dob: '1953-01-01',
    p2Dob: '1953-01-01',
    p1PlanningAge: 80,
    p2PlanningAge: 80,
    p1RetirementAge: null,
    p2RetirementAge: null,
  })
  plan.accounts = [
    cashAccount('cash-1', 0),
    traditionalAccount('ira-p1', 100_000, 'p1', 'ira'),
    traditionalAccount('ira-p2', 50_000, 'p2', 'ira'),
  ]
  plan.expenses.baseAnnual = 110_000
  return plan
}

const REPRESENTATIVE_PLANS: readonly { name: string; plan: Plan; horizonEndYear: number }[] = [
  { name: 'empty $0 year', plan: emptyPlan(), horizonEndYear: START_YEAR },
  { name: 'wages covering lifestyle', plan: wagesLifestylePlan(), horizonEndYear: START_YEAR },
  { name: 'reinvested taxable yield', plan: reinvestPlan(), horizonEndYear: START_YEAR },
  { name: 'couple owned-IRA RMDs', plan: coupleOwnedIraRmdPlan(), horizonEndYear: START_YEAR },
  { name: 'owned-IRA RMD diverted to QCD (zero-net exception)', plan: qcdZeroNetPlan(), horizonEndYear: START_YEAR },
  { name: 'lifestyle shortfall layers', plan: shortfallLifestylePlan(), horizonEndYear: START_YEAR },
  { name: 'two-owner need-based withdrawals', plan: twoOwnerNeedBasedPlan(), horizonEndYear: START_YEAR },
]

function expectWithinTolerance(actual: number, expected: number, label: string): void {
  const delta = Math.abs(actual - expected)
  expect(delta, `${label}: |${actual} - ${expected}| = ${delta}`).toBeLessThanOrEqual(TOLERANCE)
}

function expectLexicographicIds(ids: readonly string[], label: string): void {
  expect(ids, label).toEqual([...ids].sort(compareCashFlowLineId))
}

function isOwnedIraRmdZeroNetException(
  line: YearCashFlowSourceLine,
  transfers: readonly YearCashFlowTransferLine[],
): boolean {
  if (line.kind !== 'requiredMinimumDistribution') return false
  if (line.amountPlanDollars !== 0) return false
  if (!line.id.startsWith('source:requiredMinimumDistribution:ownedIraPool:')) return false
  return transfers.some((transfer) =>
    transfer.kind === 'qualifiedCharitableDistribution' &&
    transfer.debitPlanDollars > 0 &&
    transfer.lineage?.some((link) =>
      link.relationship === 'divertedBeforeHouseholdCash' && link.lineId === line.id,
    ) === true,
  )
}

function assertYearCashFlowInvariants(year: YearResult, planName: string): void {
  const label = `${planName} ${year.year}`
  expect('cashFlow' in year, `${label} publishes cashFlow`).toBe(true)
  const cashFlow = year.cashFlow
  if (cashFlow === undefined) throw new Error(`${label} missing cashFlow`)

  const { sourceLines, useLines, transferLines, taxCharacterMetadata, reconciliation } = cashFlow
  expect(reconciliation.tolerancePlanDollars).toBe(TOLERANCE)
  expect(reconciliation.cashIdentityTolerancePlanDollars)
    .toBe(CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS)

  expect(Math.abs(reconciliation.cash.differencePlanDollars), `${label} cash identity`)
    .toBeLessThanOrEqual(CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS)
  expectWithinTolerance(reconciliation.uses.differencePlanDollars, 0, `${label} use identity`)
  expectWithinTolerance(reconciliation.transfers.differencePlanDollars, 0, `${label} transfer pairing`)
  expect(
    Math.abs(
      reconciliation.cash.sourceTotalPlanDollars -
      reconciliation.cash.destinationTotalPlanDollars,
    ),
    `${label} cash source vs destination`,
  ).toBeLessThanOrEqual(CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS)
  expectWithinTolerance(
    reconciliation.uses.requestedUsesPlanDollars,
    reconciliation.uses.dispositionTotalPlanDollars,
    `${label} requested vs disposition`,
  )
  expectWithinTolerance(
    reconciliation.transfers.debitsPlanDollars,
    reconciliation.transfers.creditsPlanDollars,
    `${label} transfer debits vs credits`,
  )

  for (const line of useLines) {
    expectWithinTolerance(
      line.requestedPlanDollars,
      line.fundedPlanDollars + line.unfundedPlanDollars,
      `${label} use ${line.id} requested = funded + unfunded`,
    )
  }
  for (const line of transferLines) {
    expectWithinTolerance(
      line.debitPlanDollars,
      line.creditPlanDollars,
      `${label} transfer ${line.id} debit = credit`,
    )
  }

  const allIds = [
    ...sourceLines.map((line) => line.id),
    ...useLines.map((line) => line.id),
    ...transferLines.map((line) => line.id),
    ...taxCharacterMetadata.map((line) => line.id),
  ]
  expect(new Set(allIds).size, `${label} duplicate ids`).toBe(allIds.length)

  expectLexicographicIds(sourceLines.map((line) => line.id), `${label} sourceLines order`)
  expectLexicographicIds(useLines.map((line) => line.id), `${label} useLines order`)
  expectLexicographicIds(transferLines.map((line) => line.id), `${label} transferLines order`)
  expectLexicographicIds(
    taxCharacterMetadata.map((line) => line.id),
    `${label} taxCharacterMetadata order`,
  )

  for (const line of sourceLines) {
    expect(Number.isFinite(line.amountPlanDollars), `${label} ${line.id} finite`).toBe(true)
    if (line.amountPlanDollars === 0) {
      expect(
        isOwnedIraRmdZeroNetException(line, transferLines),
        `${label} zero-amount source ${line.id} is not the owned-IRA RMD QCD exception`,
      ).toBe(true)
    } else {
      expect(line.amountPlanDollars, `${label} ${line.id}`).toBeGreaterThan(0)
    }
    for (const character of line.taxCharacter ?? []) {
      expect(Number.isFinite(character.amountPlanDollars)).toBe(true)
      if (character.kind !== 'capitalGain') {
        expect(character.amountPlanDollars, `${label} ${line.id} ${character.kind}`).toBeGreaterThanOrEqual(0)
      }
    }
  }
  for (const line of useLines) {
    expect(line.requestedPlanDollars, `${label} ${line.id} requested`).toBeGreaterThan(0)
    expect(line.fundedPlanDollars, `${label} ${line.id} funded`).toBeGreaterThanOrEqual(0)
    expect(line.unfundedPlanDollars, `${label} ${line.id} unfunded`).toBeGreaterThanOrEqual(0)
  }
  for (const line of transferLines) {
    expect(line.debitPlanDollars, `${label} ${line.id} debit`).toBeGreaterThan(0)
    expect(line.creditPlanDollars, `${label} ${line.id} credit`).toBeGreaterThan(0)
  }
  for (const line of taxCharacterMetadata) {
    expect(Number.isFinite(line.taxCharacter.amountPlanDollars)).toBe(true)
    if (line.taxCharacter.kind === 'capitalGain') continue
    expect(
      line.taxCharacter.amountPlanDollars,
      `${label} metadata ${line.id}`,
    ).toBeGreaterThan(0)
  }
}

describe('simulatePlan annual cash-flow capture invariants', () => {
  it('holds both identities, pairing, omit-zero, order, and uniqueness on every capture-on year', () => {
    let sawZeroNetRmdException = false
    for (const fixture of REPRESENTATIVE_PLANS) {
      const result = captureOn(fixture.plan, { horizonEndYear: fixture.horizonEndYear })
      expect(result.years.length).toBeGreaterThan(0)
      for (const year of result.years) {
        assertYearCashFlowInvariants(year, fixture.name)
        for (const line of year.cashFlow!.sourceLines) {
          if (isOwnedIraRmdZeroNetException(line, year.cashFlow!.transferLines)) {
            sawZeroNetRmdException = true
          }
        }
      }
    }
    expect(sawZeroNetRmdException, 'QCD fixture must exercise the zero-net RMD exception').toBe(true)
  })

  it('is JSON.stringify-identical across two capture-on runs of the same plan', () => {
    const plan = twoOwnerNeedBasedPlan()
    const extra = { horizonEndYear: START_YEAR }
    const first = captureOn(plan, extra)
    const second = captureOn(plan, extra)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })

  it('publishes no cashFlow key from a montecarlo/run.ts:119-shaped SimulateOptions (no flag)', () => {
    // Same call shape as packages/engine/src/montecarlo/run.ts:119 — startYear,
    // taxCalculator, market, deathAgeByPersonId, horizonEndYear, and no
    // captureAnnualCashFlow. Monte Carlo must never allocate YearCashFlow.
    const plan = validate(wagesLifestylePlan())
    const result = simulatePlan(plan, {
      startYear: START_YEAR,
      taxCalculator: noTax,
      market: { returnShockPct: [0] },
      deathAgeByPersonId: { p1: 60 },
      horizonEndYear: START_YEAR,
    })
    expect(result.years.length).toBeGreaterThan(0)
    for (const year of result.years) {
      expect('cashFlow' in year).toBe(false)
      expect(year.cashFlow).toBeUndefined()
    }
    const serialized = JSON.parse(JSON.stringify(result)) as ProjectionResult
    for (const year of serialized.years) {
      expect('cashFlow' in year).toBe(false)
    }
  })
})
