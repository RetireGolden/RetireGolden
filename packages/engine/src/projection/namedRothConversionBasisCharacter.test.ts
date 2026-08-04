import { describe, expect, it, vi } from 'vitest'

/**
 * The settlement is wrapped rather than replaced. Everything the simulator
 * sees is the real driver's own result; the wrapper only records what the
 * driver was asked and what each attempt produced, because the two facts this
 * file has to pin -- how many attempts the loop needed, and that admission did
 * not vary between them -- are deliberately absent from the published
 * `ownedNonRothIraAnnualReplay` value.
 */
const settlementController = vi.hoisted(() => ({
  attempts: vi.fn(),
  settled: vi.fn(),
}))

vi.mock('../internal/ownedNonRothIraAnnualAttemptSettlement.js', async (
  importOriginal,
) => {
  const original = await importOriginal<
    typeof import('../internal/ownedNonRothIraAnnualAttemptSettlement.js')
  >()
  return {
    ...original,
    runOwnedNonRothIraAnnualSettlementAttempts: (
      input: Parameters<
        typeof original.runOwnedNonRothIraAnnualSettlementAttempts
      >[0],
    ) => {
      const result = original.runOwnedNonRothIraAnnualSettlementAttempts({
        ...input,
        runAttempt: (context) => {
          const years = input.runAttempt(context)
          settlementController.attempts({
            attemptNumber: context.attemptNumber,
            assumedEffects: context.assumedEffects,
            execution: years[0]?.rothConversionActionExecution,
            magi: years[0]?.magi,
          })
          return years
        },
      })
      settlementController.settled(input.projectionStartTaxYear, result)
      return result
    },
  }
})

import { parseRetirementActionRequest } from '../actions/index.js'
import { replayOwnedNonRothIraContiguousYears } from
  '../internal/ownedNonRothIraContiguousReplay.js'
import type { Account, Plan } from '../model/plan.js'
import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

const TAX_YEAR = 2026
const FLAT_RATE_PCT = 22
const CONVERTED = 10_000
const OPENING_BASIS = 20_000
const OPENING_IRA = 100_000
const IRA_RETURN_PCT = 10
/** 20,000 / (99,000 + 10,000) of the 10,000 gross, to the nearest cent. */
const SETTLED_NONTAXABLE_CENTS = 183_486
const SETTLED_TAXABLE_CENTS = CONVERTED * 100 - SETTLED_NONTAXABLE_CENTS
/** What the legacy plan-dollar pro-rata fraction would have produced. */
const PRE_DISTRIBUTION_APPROXIMATION_CENTS = 200_000

function traditionalIra(
  id: string,
  balance: number,
  nondeductibleBasis?: number,
  annualReturnPct = 0,
): Account {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct,
    kind: 'ira',
    balance,
    annualContribution: 0,
    ...(nondeductibleBasis === undefined ? {} : { nondeductibleBasis }),
  }
}

function rothIra(id: string): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: 0,
    annualContribution: 0,
  }
}

function cash(id: string, balance: number): Account {
  return {
    type: 'cash',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance,
    annualContribution: 0,
  }
}

function conversionRequest(amount: number) {
  const parsed = parseRetirementActionRequest({
    actionId: 'named-conversion',
    kind: 'rothConversion',
    personId: 'p1',
    year: TAX_YEAR,
    executionDate: '2026-06-15',
    executionSequence: 1,
    requestedAmount: amount * 100,
    allocations: [{
      allocationId: 'named-conversion-allocation',
      sourceAccountId: 'ira-a',
      requestedAmount: amount * 100,
    }],
    destinationRothAccountId: 'roth-second',
    taxFunding: { kind: 'noneExpected' },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

/**
 * The nonzero-basis twin of the fixture in `namedRothConversionCommit.test.ts`.
 *
 * The IRA GROWS, and that is the whole design of this fixture. Form 8606
 * line 10 divides the basis by the SEALED year-end balance plus the year's
 * line-7 and line-8 gross, while the simulator's legacy plan-dollar fraction
 * divides it by the PRE-distribution balance. In a static account those two
 * denominators are the same number, and a test built on one cannot tell
 * whether the engine used the settled answer or re-derived an approximation
 * that happens to agree. At 10 percent growth they separate:
 *
 *   settled       20,000 / (99,000 + 10,000)  = 1,834.86 of 10,000
 *   approximation 20,000 / 100,000            = 2,000.00 of 10,000
 *
 * so every assertion below distinguishes them by 165.14 dollars.
 */
function basisPlan(options: { reversedAccounts?: boolean } = {}): Plan {
  const plan = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  plan.id = 'named-conversion-nonzero-basis'
  const accounts = [
    cash('cash-a', 1_000_000),
    traditionalIra('ira-a', OPENING_IRA, OPENING_BASIS, IRA_RETURN_PCT),
    rothIra('roth-first'),
    rothIra('roth-second'),
  ]
  plan.accounts = options.reversedAccounts ? [...accounts].reverse() : accounts
  plan.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'ira-a-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'ira-a',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  plan.strategies.retirementActions = [conversionRequest(CONVERTED)]
  return plan
}

function project(plan: Plan, ratePct = 0, endYear = TAX_YEAR): YearResult[] {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: endYear,
    taxCalculator: createFlatTaxCalculator(ratePct),
  }).years
}

/** The canonical settled split, recomputed from the published year. */
function replayedLine8(plan: Plan, years: readonly YearResult[]) {
  const replay = replayOwnedNonRothIraContiguousYears(
    validatePlan(plan), TAX_YEAR, years,
  )
  if (replay.status !== 'ownedNonRothIraContiguousReplayComplete') {
    throw new Error(`replay blocked: ${JSON.stringify(replay.issues)}`)
  }
  return replay.annualReplays[0]!.ownerReplays[0]!.line8AllocationEvidence
}

function settledAttempts(): {
  attemptNumber: number
  assumedEffects: readonly {
    calculationScope: string
    sourceAccountId: string
    grossAmount: number
    basisReturnAmount: number
    ordinaryIncomeAmount: number
  }[]
  execution: YearResult['rothConversionActionExecution']
  magi: number
}[] {
  return settlementController.attempts.mock.calls.map((call) => call[0])
}

describe('named Roth conversion at a nonzero basis numerator', () => {
  it('commits, and splits the gross into parts that sum to it exactly', () => {
    const plan = basisPlan()
    const year = project(plan, FLAT_RATE_PCT)[0]!
    const line8 = replayedLine8(plan, [year])

    expect(year.rothConversionActionExecution?.committed).toBe(true)
    expect(year.rothConversion).toBeCloseTo(CONVERTED, 6)
    expect(year.balances['ira-a']).toBeCloseTo(99_000, 6)
    expect(year.balances['roth-second']).toBeCloseTo(CONVERTED, 6)
    // Exact cents, and the two parts are the whole of the gross -- no dollar
    // of a converted IRA is left uncharacterized or counted twice.
    expect(line8.annualGrossAmount).toBe(CONVERTED * 100)
    expect(line8.annualNontaxableBasisAmount).toBe(SETTLED_NONTAXABLE_CENTS)
    expect(line8.annualTaxableAmount).toBe(SETTLED_TAXABLE_CENTS)
    expect(
      line8.annualNontaxableBasisAmount + line8.annualTaxableAmount,
    ).toBe(line8.annualGrossAmount)
  })

  it('takes the split the replay derives rather than one of its own', () => {
    const plan = basisPlan()
    const year = project(plan, FLAT_RATE_PCT)[0]!
    const line8 = replayedLine8(plan, [year])

    // The expectation is read off the canonical replay, so this fails if the
    // simulator ever answers the character question a second time instead of
    // consuming the settled answer -- including the silent fall-throughs a
    // mismatched mutation ordinal produces, where `resolveAssumedCharacter`
    // returns null and the pass reverts to the pre-distribution fraction (or,
    // with no pro-rata state at all, to a wholly taxable conversion).
    expect(year.magi).toBeCloseTo(line8.annualTaxableAmount / 100, 6)
    expect(CONVERTED - year.magi)
      .toBeCloseTo(line8.annualNontaxableBasisAmount / 100, 6)
    expect(year.magi).not.toBeCloseTo(CONVERTED, 6)
    expect(CONVERTED - year.magi)
      .not.toBeCloseTo(PRE_DISTRIBUTION_APPROXIMATION_CENTS / 100, 6)
  })

  it('raises the year federal tax by the tax on the taxable part alone', () => {
    const plan = basisPlan()
    const withConversion = project(plan, FLAT_RATE_PCT)[0]!
    const withoutAction = basisPlan()
    withoutAction.strategies.retirementActions = []
    const baseline = project(withoutAction, FLAT_RATE_PCT)[0]!
    const taxable = replayedLine8(plan, [withConversion]).annualTaxableAmount

    expect(withConversion.tax - baseline.tax)
      .toBeCloseTo((taxable / 100) * (FLAT_RATE_PCT / 100), 6)
    // Said as a number as well. The whole gross would have cost 2,200, and
    // the pre-distribution approximation would have cost 1,760.
    expect(withConversion.tax - baseline.tax).toBeCloseTo(1_796.3308, 4)
  })

  it('converges, and admission never varies between the attempts', () => {
    settlementController.attempts.mockClear()
    settlementController.settled.mockClear()

    project(basisPlan(), FLAT_RATE_PCT)

    const attempts = settledAttempts()
    // Two, not eight. Only the character is settlement-dependent: the dollars
    // are the request's own stated amounts, so line-8 gross and the line-10
    // denominator are the same in every attempt and the loop contracts.
    // Asserting the count is what makes a regression to non-convergence -- or
    // to a silent `attemptLimitExceeded` rollback -- visible here.
    expect(settlementController.settled).toHaveBeenCalledWith(
      TAX_YEAR,
      expect.objectContaining({ status: 'committed', attemptCount: 2 }),
    )
    expect(attempts.map((attempt) => attempt.attemptNumber)).toEqual([1, 2])
    // Admission is not part of the fixed point. If it were, the conversion
    // would exist in some attempts and not others, and the denominator would
    // depend on the answer the loop is converging to.
    expect(attempts.map((attempt) => attempt.execution?.committed))
      .toEqual([true, true])
    expect(attempts.map((attempt) =>
      attempt.execution?.evidence.map((entry) => entry.executedAmount)))
      .toEqual([[CONVERTED * 100], [CONVERTED * 100]])
    // The provisional character lives inside the assumption vector, which is
    // what makes it round-trip through `observed` and hold the fixed-point
    // guarantee. Attempt 1 seeds from nothing and lands on the approximation;
    // attempt 2 reads the settled line-8 character back out of the vector and
    // reproduces it, which is the equality that lets the driver commit.
    expect(attempts[0]?.assumedEffects).toEqual([])
    expect(attempts[1]?.assumedEffects).toEqual([
      expect.objectContaining({
        calculationScope: 'form8606Line8NetConversions',
        sourceAccountId: 'ira-a',
        grossAmount: CONVERTED * 100,
        basisReturnAmount: SETTLED_NONTAXABLE_CENTS,
        ordinaryIncomeAmount: SETTLED_TAXABLE_CENTS,
      }),
    ])
    // And the two attempts really did produce different income, so the second
    // one is doing work rather than confirming a seed that was already right.
    expect(attempts[0]?.magi).toBeCloseTo(
      CONVERTED - PRE_DISTRIBUTION_APPROXIMATION_CENTS / 100, 6,
    )
    expect(attempts[1]?.magi).toBeCloseTo(SETTLED_TAXABLE_CENTS / 100, 6)
  })

  it('splits identically when Plan account order is reversed', () => {
    const forward = basisPlan()
    const reversed = basisPlan({ reversedAccounts: true })
    const forwardYear = project(forward, FLAT_RATE_PCT)[0]!
    const reversedYear = project(reversed, FLAT_RATE_PCT)[0]!

    expect(replayedLine8(reversed, [reversedYear]))
      .toEqual(replayedLine8(forward, [forwardYear]))
    expect(reversedYear.magi).toBeCloseTo(forwardYear.magi, 6)
    expect(reversedYear.tax).toBeCloseTo(forwardYear.tax, 6)
    expect(reversedYear.balances).toEqual(forwardYear.balances)
  })

  it('exposes only the includible part of the layer to 408A(d)(3)(F)', () => {
    // The whole IRA converts and the Roth is the only place next year's
    // spending can come from, so the 1,500 shortfall is drawn straight out of
    // the conversion layer while its five-year window is open and the owner is
    // under 59.5. The IRA is static here, and cannot be otherwise: converting
    // all of it leaves a nil year-end balance whatever the return, which makes
    // line 8 the whole denominator and 1/5 the whole answer.
    const withBasis = basisPlan()
    withBasis.accounts = [
      cash('cash-a', 500),
      traditionalIra('ira-a', CONVERTED, 2_000),
      rothIra('roth-first'),
      rothIra('roth-second'),
    ]
    withBasis.expenses.baseAnnual = 0
    withBasis.expenses.oneTimeGoals = [{
      id: 'spend-2027',
      label: 'spend-2027',
      year: TAX_YEAR + 1,
      amount: 2_000,
    }]
    const zeroBasis = structuredClone(withBasis)
    zeroBasis.accounts = zeroBasis.accounts.map((account) =>
      account.id === 'ira-a'
        ? traditionalIra('ira-a', CONVERTED)
        : account)

    const withBasisYears = project(withBasis, 0, TAX_YEAR + 1)
    const zeroBasisYears = project(zeroBasis, 0, TAX_YEAR + 1)

    // A whole IRA of 10,000 against 2,000 of basis converts at a 1/5 ratio
    // once the year-end balance is nil, so 8,000 of the layer was includible.
    expect(withBasisYears[0]!.magi).toBeCloseTo(8_000, 6)
    // (F)(ii) caps the recapture at that includible portion. 80 percent of
    // each drawn dollar carries the 10 percent, including the dollars drawn to
    // pay it, so the 1,500 net need grosses up to 1,500/0.92.
    expect(withBasisYears[1]!.penalties).toBeCloseTo(120 / 0.92, 2)
    // The same layer recorded with `taxableAmount === amount` would recapture
    // the zero-basis figure instead, which is materially larger.
    expect(zeroBasisYears[1]!.penalties).toBeCloseTo(150 / 0.9, 2)
    expect(withBasisYears[1]!.penalties)
      .toBeLessThan(zeroBasisYears[1]!.penalties)
  })
})
