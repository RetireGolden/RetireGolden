/**
 * Delegation guard for the annual SEPP extraction.
 *
 * Self-equivalence cannot prove the helper is called or its output consumed.
 * This suite injects an ordered hostile stream whose cache keys, balance
 * positions, publication ids, raw owners, character owners, and two boolean
 * gates are independently varied. Three distributions include duplicate
 * publication ids and an IEEE-754 association trap. The assertions follow the
 * exact stream through positional balances, runtime occurrence/application
 * order, Form 8606 character, tax, spending cash, reported withdrawals, and
 * shortfall. A second mode isolates retry rollback and next-year cache commit.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualSeppDistributionsInput,
  AnnualSeppDistributionsResult,
} from './internal/annualSeppDistributions.js'

type Mode = 'original' | 'sentinelDistribution' | 'cacheOnly'

interface CallRecord {
  readonly year: number
  readonly cacheAtEntry: ReadonlyMap<string, number>
  readonly result: AnnualSeppDistributionsResult
}

const BIG_TAKE = 80_000_000_000_000
const SMALL_TAKE = 0.011
const SENTINEL_TAKES = [BIG_TAKE, SMALL_TAKE, SMALL_TAKE] as const
let SENTINEL_TOTAL = 0
for (const take of SENTINEL_TAKES) SENTINEL_TOTAL += take
const REGROUPED_TOTAL = BIG_TAKE + (SMALL_TAKE + SMALL_TAKE)
const SENTINEL_CACHE = 9_876.54
const ACCOUNT_ID = 'sepp:delegation'
const DUPLICATE_PUBLICATION_ID = 'sepp:runtime-duplicate'
const UNIQUE_PUBLICATION_ID = 'sepp:runtime-unique'
const POSITIONAL_IDS = ['position-a', 'position-b', 'position-c'] as const
const POSITIONAL_AFTER = [101, 202, 303] as const
const CACHE_A = 'sepp:cache-a'
const CACHE_B = 'sepp:cache-b'

const seam = vi.hoisted(() => ({
  mode: 'original' as Mode,
  calls: [] as CallRecord[],
}))

vi.mock('./internal/annualSeppDistributions.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualSeppDistributions.js')
  >()
  return {
    ...original,
    annualSeppDistributions: (input: AnnualSeppDistributionsInput) => {
      let result: AnnualSeppDistributionsResult
      if (seam.mode === 'sentinelDistribution' && input.year === 2026) {
        result = {
          total: SENTINEL_TOTAL,
          operations: [
            {
              kind: 'amortizationCacheWrite',
              accountId: CACHE_A,
              amount: 111.25,
            },
            {
              kind: 'distribution',
              balanceIndex: 2,
              accountId: DUPLICATE_PUBLICATION_ID,
              ownerPersonId: null,
              characterOwnerPersonId: 'character-big-unused',
              take: BIG_TAKE,
              sourceBalanceBefore: BIG_TAKE + POSITIONAL_AFTER[2],
              sourceBalanceAfter: POSITIONAL_AFTER[2],
              recordsOwnedIraApplication: true,
              defersIraCharacter: false,
            },
            {
              kind: 'amortizationCacheWrite',
              accountId: CACHE_B,
              amount: 222.5,
            },
            {
              kind: 'distribution',
              balanceIndex: 0,
              accountId: DUPLICATE_PUBLICATION_ID,
              ownerPersonId: 'owner-without-application',
              characterOwnerPersonId: input.primaryPersonId,
              take: SMALL_TAKE,
              sourceBalanceBefore: SMALL_TAKE + POSITIONAL_AFTER[0],
              sourceBalanceAfter: POSITIONAL_AFTER[0],
              recordsOwnedIraApplication: false,
              defersIraCharacter: true,
            },
            {
              kind: 'distribution',
              balanceIndex: 1,
              accountId: UNIQUE_PUBLICATION_ID,
              ownerPersonId: 'owner-with-application',
              characterOwnerPersonId: input.primaryPersonId,
              take: SMALL_TAKE,
              sourceBalanceBefore: SMALL_TAKE + POSITIONAL_AFTER[1],
              sourceBalanceAfter: POSITIONAL_AFTER[1],
              recordsOwnedIraApplication: true,
              defersIraCharacter: true,
            },
          ],
        }
      } else if (seam.mode === 'sentinelDistribution') {
        result = { total: 0, operations: [] }
      } else if (seam.mode === 'cacheOnly') {
        result = input.year === 2026
          ? {
              total: 0,
              operations: [{
                kind: 'amortizationCacheWrite',
                accountId: ACCOUNT_ID,
                amount: SENTINEL_CACHE,
              }],
            }
          : { total: 0, operations: [] }
      } else {
        result = original.annualSeppDistributions(input)
      }
      seam.calls.push({
        year: input.year,
        cacheAtEntry: new Map(input.amortizationAmountByAccountId),
        result,
      })
      return result
    },
  }
})

import type { Account, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { singlePersonPlan } from '../testing/planFixtures.js'
import { cashFlowLineIds } from './annualCashFlowIds.js'
import { simulatePlan } from './simulate.js'

function sentinelPlan(): Plan {
  const value = singlePersonPlan({
    dob: '1970-03-15',
    planningAge: 58,
    retirementAge: 56,
  })
  value.id = 'annual-sepp-delegation'
  value.accounts = POSITIONAL_IDS.map((id, index) => ({
    type: 'traditional',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: index === 2
      ? BIG_TAKE + POSITIONAL_AFTER[index]
      : SMALL_TAKE + POSITIONAL_AFTER[index],
    annualContribution: 0,
    // Force the fallback pro-rata fraction to one. Only the third injected row
    // both records an application and requests deferred character, so exactly
    // that row's 1.1 cents returns basis.
    ...(index === 2 ? { nondeductibleBasis: 90_000_000_000_000 } : {}),
  })) as Account[]
  const expectedOrdinaryIncome = SENTINEL_TOTAL - SMALL_TAKE
  const expectedTax = expectedOrdinaryIncome * 0.1
  value.expenses.baseAnnual = SENTINEL_TOTAL - expectedTax
  return value
}

function cacheReentryPlan(): Plan {
  const value = singlePersonPlan({
    dob: '1966-01-01', planningAge: 60, retirementAge: 56,
  })
  value.id = 'annual-sepp-cache-reentry'
  value.accounts = [
    {
      type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null,
      annualReturnPct: 0, balance: 0, annualContribution: 0,
    } as Account,
    {
      type: 'traditional', id: 'withdraw-ira', name: 'Withdrawal IRA',
      ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 10_000,
      annualContribution: 0, nondeductibleBasis: 4_000,
    } as Account,
    {
      type: 'traditional', id: ACCOUNT_ID, name: 'SEPP dust',
      ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0.004,
      annualContribution: 0,
      sepp: { startAge: 56, method: 'amortization' },
    } as Account,
  ]
  value.expenses.baseAnnual = 1_000
  return value
}

const taxInputs: { readonly year: number; readonly ordinaryIncome: number }[] = []

function runSentinel() {
  seam.calls.length = 0
  taxInputs.length = 0
  return simulatePlan(sentinelPlan(), {
    startYear: 2026,
    horizonEndYear: 2027,
    taxCalculator: {
      compute(input) {
        taxInputs.push({ year: input.year, ordinaryIncome: input.ordinaryIncome })
        return input.ordinaryIncome * 0.1
      },
    },
    captureAnnualCashFlow: true,
  })
}

function runCacheReentry() {
  seam.calls.length = 0
  return simulatePlan(cacheReentryPlan(), {
    startYear: 2026,
    horizonEndYear: 2027,
    taxCalculator: createFlatTaxCalculator(0),
    captureAnnualCashFlow: true,
  })
}

describe('simulatePlan delegates annual SEPP distributions', () => {
  it('consumes the hostile ordered stream across every downstream channel', () => {
    seam.mode = 'sentinelDistribution'
    const result = runSentinel()
    const year = result.years[0]!
    const calls = seam.calls.filter((call) => call.year === 2026)
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((call) => call.result.total === SENTINEL_TOTAL)).toBe(true)
    expect(SENTINEL_TOTAL).not.toBe(REGROUPED_TOTAL)
    expect(year.sepp).toBe(SENTINEL_TOTAL)

    // Writes are positional, not an account-id lookup: operation order is
    // index 2, 0, 1, while all three Plan account ids are unique and the first
    // two publication ids deliberately collide.
    expect(year.balances).toEqual({
      [POSITIONAL_IDS[0]]: POSITIONAL_AFTER[0],
      [POSITIONAL_IDS[1]]: POSITIONAL_AFTER[1],
      [POSITIONAL_IDS[2]]: POSITIONAL_AFTER[2],
    })

    const occurrences = year.retirementRuntimeSource!.runtimeOccurrences.filter(
      (row) => row.kind === 'automaticSeppDistribution',
    )
    expect(occurrences).toEqual([
      {
        producerOccurrenceKey: JSON.stringify([
          'automaticSeppDistribution', DUPLICATE_PUBLICATION_ID,
        ]),
        kind: 'automaticSeppDistribution',
        grossAmountPlanDollars: SMALL_TAKE,
        ownerPersonId: 'owner-without-application',
        sourceAccountId: DUPLICATE_PUBLICATION_ID,
        executionDate: null,
        executionSequence: null,
        movementAuthorityId: null,
      },
      {
        producerOccurrenceKey: JSON.stringify([
          'automaticSeppDistribution', DUPLICATE_PUBLICATION_ID,
        ]),
        kind: 'automaticSeppDistribution',
        grossAmountPlanDollars: BIG_TAKE,
        ownerPersonId: null,
        sourceAccountId: DUPLICATE_PUBLICATION_ID,
        executionDate: null,
        executionSequence: null,
        movementAuthorityId: null,
      },
      {
        producerOccurrenceKey: JSON.stringify([
          'automaticSeppDistribution', UNIQUE_PUBLICATION_ID,
        ]),
        kind: 'automaticSeppDistribution',
        grossAmountPlanDollars: SMALL_TAKE,
        ownerPersonId: 'owner-with-application',
        sourceAccountId: UNIQUE_PUBLICATION_ID,
        executionDate: null,
        executionSequence: null,
        movementAuthorityId: null,
      },
    ])

    const applications = year.retirementRuntimeApplicationSource!.applications
      .filter((row) => row.simulatorPhase === 'automaticSeppDistribution')
    expect(applications).toEqual([
      expect.objectContaining({
        applicationKind: 'debit',
        mutationOrdinal: 1,
        producerOccurrenceKey: JSON.stringify([
          'automaticSeppDistribution', DUPLICATE_PUBLICATION_ID,
        ]),
        ownerPersonId: null,
        sourceAccountId: DUPLICATE_PUBLICATION_ID,
        sourceBalanceBeforePlanDollars: BIG_TAKE + POSITIONAL_AFTER[2],
        appliedAmountPlanDollars: BIG_TAKE,
        sourceBalanceAfterPlanDollars: POSITIONAL_AFTER[2],
      }),
      expect.objectContaining({
        applicationKind: 'debit',
        mutationOrdinal: 2,
        producerOccurrenceKey: occurrences[2]!.producerOccurrenceKey,
        ownerPersonId: 'owner-with-application',
        sourceAccountId: UNIQUE_PUBLICATION_ID,
        sourceBalanceBeforePlanDollars: SMALL_TAKE + POSITIONAL_AFTER[1],
        appliedAmountPlanDollars: SMALL_TAKE,
        sourceBalanceAfterPlanDollars: POSITIONAL_AFTER[1],
      }),
    ])

    // Duplicate-id Map publication is last-write-wins, while the unique third
    // row carries the only application+deferred-character combination.
    const duplicateCashFlowLine = year.cashFlow!.sourceLines.find(
      (line) => line.id === cashFlowLineIds.sourceSeppDistribution(
        DUPLICATE_PUBLICATION_ID,
      ),
    )
    expect(duplicateCashFlowLine).toEqual(expect.objectContaining({
      kind: 'seppDistribution',
      amountPlanDollars: SMALL_TAKE,
    }))
    const uniqueCashFlowLine = year.cashFlow!.sourceLines.find(
      (line) => line.id === cashFlowLineIds.sourceSeppDistribution(
        UNIQUE_PUBLICATION_ID,
      ),
    )
    expect(uniqueCashFlowLine).toEqual(expect.objectContaining({
      kind: 'seppDistribution',
      amountPlanDollars: SMALL_TAKE,
      taxCharacter: [{
        kind: 'returnOfBasis',
        amountPlanDollars: SMALL_TAKE,
      }],
    }))

    // The exact helper fold funds required spending and tax. Its one deferred
    // basis-return row is removed from ordinary income, but not from physical
    // cash or gross traditional withdrawals.
    const expectedOrdinaryIncome = SENTINEL_TOTAL - SMALL_TAKE
    const expectedTax = expectedOrdinaryIncome * 0.1
    const federalInput = year.advisoryFederalTax?.input
    expect(federalInput).toBeDefined()
    expect(federalInput!.ordinaryIncome)
      .toBe(expectedOrdinaryIncome)
    expect(taxInputs.filter((input) => input.year === 2026).at(-1)?.ordinaryIncome)
      .toBe(expectedOrdinaryIncome)
    expect(year.tax).toBe(expectedTax)
    expect(year.withdrawals.traditional).toBe(SENTINEL_TOTAL)
    expect(year.withdrawals.total).toBe(SENTINEL_TOTAL)
    expect(year.expenses.total + year.tax).toBe(SENTINEL_TOTAL)
    expect(year.surplusInvested).toBe(0)
    expect(year.shortfall).toBe(0)
    expect(year.requiredShortfall).toBe(0)

    const nextYearCalls = seam.calls.filter((call) => call.year === 2027)
    expect(nextYearCalls.length).toBeGreaterThan(0)
    expect(nextYearCalls.every((call) => (
      JSON.stringify([...call.cacheAtEntry]) === JSON.stringify([
        [CACHE_A, 111.25],
        [CACHE_B, 222.5],
      ])
    ))).toBe(true)
  })

  it('applies the cache write on every re-entry and commits it into the next year', () => {
    seam.mode = 'cacheOnly'
    runCacheReentry()
    const firstYearCalls = seam.calls.filter((call) => call.year === 2026)
    const secondYearCalls = seam.calls.filter((call) => call.year === 2027)
    expect(firstYearCalls.length).toBeGreaterThan(1)
    expect(secondYearCalls.length).toBeGreaterThan(0)
    // Each attempt starts from the transaction snapshot; the helper's write is
    // applied after entry, so retries do not leak it into their input.
    expect(firstYearCalls.every(
      (call) => !call.cacheAtEntry.has(ACCOUNT_ID),
    )).toBe(true)
    // The committed attempt does persist the exact returned write to year + 1.
    expect(secondYearCalls.every(
      (call) => call.cacheAtEntry.get(ACCOUNT_ID) === SENTINEL_CACHE,
    )).toBe(true)
  })
})
