import { describe, expect, it } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import {
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../projection/flatTax.js'
import { simulatePlan } from '../projection/simulate.js'
import type { YearResult } from '../projection/types.js'
import { replayOwnedNonRothIraContiguousYears } from './ownedNonRothIraContiguousReplay.js'
import { validateOwnedNonRothIraRuntimeSourceSeries } from './ownedNonRothIraRuntimeSourceSeries.js'

const TAX_YEAR = 2026
const noTax = createFlatTaxCalculator(0)

function traditional(
  id: string,
  balance: number,
  kind: 'ira' | 'employer' = 'ira',
  basis = 0,
): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, 'p1', kind)
  if (account.type !== 'traditional') throw new Error('expected traditional account')
  return {
    ...account,
    annualReturnPct: 0,
    ...(basis === 0 ? {} : { nondeductibleBasis: basis }),
  }
}

function project(plan: Plan, endYear = TAX_YEAR): YearResult[] {
  return structuredClone(simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: endYear,
    taxCalculator: noTax,
  }).years) as YearResult[]
}

/**
 * The simulator's own annual phase order. A charitable gift is sized once the
 * forced distributions are known and before any conversion or need-based
 * withdrawal, so it takes a position in the middle of the chain rather than the
 * end -- and every later debit on the same account sees the reduced balance.
 */
const PHASE_RANK: Readonly<Record<string, number>> = {
  annuityPurchaseFunding: 0,
  pensionLumpSumRollover: 1,
  employeeContribution: 2,
  ownerRmdDistribution: 3,
  automaticSeppDistribution: 4,
  legacyQcdDistribution: 5,
  legacyRothConversion: 6,
  legacyRothConversionAggregateDestinationCredit: 7,
  legacyNeedBasedWithdrawal: 8,
}

interface MutableApplication {
  applicationKind: string
  producerOccurrenceKey: string
  simulatorPhase: string
  mutationOrdinal: number
  ownerPersonId: string | null
  sourceAccountId: string | null
  sourceBalanceBeforePlanDollars: number | null
  sourceBalanceAfterPlanDollars: number | null
  appliedAmountPlanDollars?: number
}

interface MovingQcdOptions {
  /** Omit to reproduce PR #153 exactly: dollars leave, nothing explains them. */
  readonly occurrence?: boolean
  readonly application?: boolean
  /** Publish a QCD total other than the dollars that actually moved. */
  readonly publishedTotal?: number
}

/**
 * Reproduce the exact annual facts a pre-RMD charitable gift produces: the
 * dollars leave a named owned IRA in the QCD phase. `occurrence` and
 * `application` default on; switching either off is what the evidence chain has
 * to catch.
 */
function withMovingQcd(
  years: YearResult[],
  sourceAccountId: string,
  openingBalance: number,
  amount: number,
  options: MovingQcdOptions = {},
): YearResult[] {
  const year = years[0]!
  const occurrenceSource = year.retirementRuntimeSource!
  const applicationSource = year.retirementRuntimeApplicationSource!
  const applications = applicationSource
    .applications as unknown as MutableApplication[]

  if (options.occurrence !== false) {
    const occurrences = occurrenceSource.runtimeOccurrences as unknown as {
      producerOccurrenceKey: string
    }[]
    occurrences.push({
      producerOccurrenceKey: JSON.stringify(['legacyQcd', sourceAccountId]),
      kind: 'legacyQcd',
      grossAmountPlanDollars: amount,
      ownerPersonId: 'p1',
      sourceAccountId,
      executionDate: null,
      executionSequence: null,
      movementAuthorityId: null,
    } as never)
    // Occurrences are published in canonical producer-key order.
    occurrences.sort((left, right) =>
      left.producerOccurrenceKey < right.producerOccurrenceKey
        ? -1
        : left.producerOccurrenceKey > right.producerOccurrenceKey ? 1 : 0)
  }

  const insertIndex = (() => {
    const found = applications
      .findIndex((entry) => (PHASE_RANK[entry.simulatorPhase] ?? 0) >
        PHASE_RANK.legacyQcdDistribution!)
    return found === -1 ? applications.length : found
  })()
  const sourceBalanceBefore = applications
    .slice(0, insertIndex)
    .filter((entry) => entry.sourceAccountId === sourceAccountId)
    .at(-1)?.sourceBalanceAfterPlanDollars ?? openingBalance
  if (options.application !== false) {
    applications.splice(insertIndex, 0, {
      applicationKind: 'debit',
      producerOccurrenceKey: JSON.stringify(['legacyQcd', sourceAccountId]),
      simulatorPhase: 'legacyQcdDistribution',
      mutationOrdinal: 0,
      ownerPersonId: 'p1',
      sourceAccountId,
      sourceBalanceBeforePlanDollars: sourceBalanceBefore,
      appliedAmountPlanDollars: amount,
      sourceBalanceAfterPlanDollars: sourceBalanceBefore - amount,
    })
  }
  // Whether or not the gift is explained, the money is gone: every later debit
  // on that account, and every published balance, shows the reduced figure.
  for (const entry of applications.slice(
    insertIndex + (options.application === false ? 0 : 1),
  )) {
    if (entry.sourceAccountId !== sourceAccountId) continue
    entry.sourceBalanceBeforePlanDollars! -= amount
    entry.sourceBalanceAfterPlanDollars! -= amount
  }
  applications.forEach((entry, index) => { entry.mutationOrdinal = index + 1 })

  // The fixtures hold annualReturnPct at 0, so post-growth equals pre-growth.
  const preGrowth = year.ownedNonRothIraBalancesBeforeGrowth as
    Record<string, number>
  preGrowth[sourceAccountId] -= amount
  ;(year.balances as Record<string, number>)[sourceAccountId] -= amount
  for (const pool of year.ownedNonRothIraPostGrowthSource!.ownerPools) {
    for (const balance of pool.accountBalances) {
      if (balance.sourceAccountId !== sourceAccountId) continue
      ;(balance as { balancePlanDollars: number }).balancePlanDollars -= amount
    }
  }
  ;(year as { qcd: number }).qcd = options.publishedTotal ?? amount
  ;(occurrenceSource as { nonmovingLegacyQcdOverlay: null })
    .nonmovingLegacyQcdOverlay = null
  return years
}

/**
 * Cash to meet the year's Medicare premiums. Without it the sequential
 * withdrawal order reaches into the IRA, which is real behaviour but adds a
 * second debit to every fixture below for no gain.
 */
function cash(): Account {
  return {
    type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null,
    balance: 50_000, annualReturnPct: 0, annualContribution: 0,
  }
}

/** A donor past 70½ whose applicable RMD age (75) is still years away. */
function preRmdPlan(id: string, accounts: Account[]): Plan {
  const plan = singlePersonPlan({ dob: '1956-01-01', planningAge: 90 })
  plan.id = id
  plan.accounts = [cash(), ...accounts]
  return plan
}

describe('moving legacy QCD in the owned-IRA source series', () => {
  // The whole point of the seventh occurrence kind. IRC 408(d)(8) turns on
  // attaining 70½ and requires no RMD, so a gift can leave an owned IRA with no
  // forced distribution behind it -- and then it is an owned-IRA balance change
  // like any other and must be explained like one.
  it('accepts a gift that leaves an owned IRA when an occurrence and application explain it', () => {
    const plan = preRmdPlan('moving-qcd-explained', [traditional('ira', 100_000)])

    const result = validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR, withMovingQcd(project(plan), 'ira', 100_000, 10_000),
    )

    expect(result.status).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
    if (result.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') return
    expect(result.years[0]!.ownerSources[0]!.applications).toEqual([
      expect.objectContaining({
        occurrenceKind: 'legacyQcd',
        applicationKind: 'debit',
        simulatorPhase: 'legacyQcdDistribution',
        sourceAccountId: 'ira',
        amount: 1_000_000,
        sourceBalanceBefore: 10_000_000,
        sourceBalanceAfter: 9_000_000,
        // 408(d)(8)(D) determines the excludable amount without regard to the
        // pro-rata rule, so a QCD is on neither Form 8606 line. A line-7
        // reading would put this gross in the annual denominator and consume
        // basis against it; the basis test below pins the difference.
        form8606Line: null,
      }),
    ])
  })

  // The regression this slice exists to prevent, and the exact state PR #153
  // was sent back to draft in: the balance moves and nothing accounts for it.
  it('blocks a gift that debits an owned IRA with nothing explaining it', () => {
    const plan = preRmdPlan('moving-qcd-unexplained', [traditional('ira', 100_000)])

    const result = validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR,
      withMovingQcd(project(plan), 'ira', 100_000, 10_000, {
        occurrence: false, application: false,
      }),
    )

    expect(result).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{ kind: 'balanceChainInvalid', sourceAccountId: 'ira' }],
    })
  })

  // Half-wiring is its own failure: an occurrence that names the gift but no
  // application means the per-account before/after chain never sees the debit.
  it('blocks a gift whose occurrence is published without its application', () => {
    const plan = preRmdPlan('moving-qcd-half-wired', [traditional('ira', 100_000)])

    const result = validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR,
      withMovingQcd(project(plan), 'ira', 100_000, 10_000, { application: false }),
    )

    expect(result.status).toBe('ownedNonRothIraRuntimeSourceSeriesBlocked')
  })

  // IRC 408(d)(8)(B) reaches only "any distribution from an individual
  // retirement plan". Before this slice the source-compatibility switch had no
  // arm for a QCD and fell through to `default: return true`, so an employer
  // plan named as the donor's source would have been accepted.
  it('refuses an employer plan named as the source of a gift', () => {
    const plan = preRmdPlan('moving-qcd-employer-source', [
      traditional('ira', 100_000),
      traditional('k401', 100_000, 'employer'),
    ])
    const years = withMovingQcd(project(plan), 'ira', 100_000, 10_000)
    const occurrence = years[0]!.retirementRuntimeSource!.runtimeOccurrences
      .find((entry) => entry.kind === 'legacyQcd')!
    ;(occurrence as { sourceAccountId: string }).sourceAccountId = 'k401'
    ;(occurrence as { producerOccurrenceKey: string }).producerOccurrenceKey =
      JSON.stringify(['legacyQcd', 'k401'])

    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'sourceIdentityInvalid' }],
      })
  })

  // The published annual figure is the household's charitable total. Moving
  // occurrences plus the nonmoving overlay have to add up to it, or the ledger
  // is reporting a gift larger than the dollars it can account for.
  it('requires the published annual QCD total to rejoin the dollars that moved', () => {
    const plan = preRmdPlan('moving-qcd-overstated', [traditional('ira', 100_000)])

    const result = validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR,
      withMovingQcd(project(plan), 'ira', 100_000, 10_000, {
        publishedTotal: 12_000,
      }),
    )

    expect(result).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{ kind: 'sourceCoverageInvalid', taxYear: TAX_YEAR }],
    })
  })

  // The other half of the split, unchanged and deliberately still blocked. A
  // gift routed out of an RMD moves no extra dollars, but which owner's line-7
  // gross must shrink under 408(d)(8)(D) is unanswerable from one household
  // scalar, so it keeps the nonmoving overlay and keeps requiring the separate
  // characterization stage. Wiring the moving half must not quietly admit this
  // one.
  it('still requires the characterization stage for a gift routed out of an RMD', () => {
    const plan = singlePersonPlan({ dob: '1945-01-01', planningAge: 90 })
    plan.id = 'routed-qcd-still-blocked'
    plan.accounts = [cash(), traditional('ira', 500_000)]
    plan.strategies.qcdAnnual = 5_000

    const years = project(plan)

    expect(years[0]!.qcd).toBeGreaterThan(0)
    expect(years[0]!.retirementRuntimeSource!.nonmovingLegacyQcdOverlay)
      .toMatchObject({
        kind: 'legacyQcd',
        physicalMovement: 'notAdditionalMovement',
      })
    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'qcdStageRequired', taxYear: TAX_YEAR }],
      })
  })

  // A gift that moved is ordered by the phase it moved in. Recording it ahead
  // of the RMD that ran first would let a later replay reconstruct a balance
  // chain the simulator never produced.
  it('refuses a gift application recorded ahead of the forced distribution that preceded it', () => {
    const plan = singlePersonPlan({ dob: '1945-01-01', planningAge: 90 })
    plan.id = 'moving-qcd-out-of-phase'
    plan.accounts = [cash(), traditional('ira', 500_000)]
    const years = withMovingQcd(project(plan), 'ira', 500_000, 10_000)
    const applications = years[0]!.retirementRuntimeApplicationSource!
      .applications as unknown as MutableApplication[]
    const rmdIndex = applications
      .findIndex((entry) => entry.simulatorPhase === 'ownerRmdDistribution')
    const qcdIndex = applications
      .findIndex((entry) => entry.simulatorPhase === 'legacyQcdDistribution')
    expect(qcdIndex).toBe(rmdIndex + 1)
    // Swap the two, renumber, and re-thread the balance chain through the new
    // order. Ordinals stay contiguous and every before/after still joins up, so
    // the only thing left wrong is the phase order -- otherwise this would be
    // caught by the balance check for the wrong reason.
    const opening = applications[rmdIndex]!.sourceBalanceBeforePlanDollars!
    applications.splice(rmdIndex, 2, applications[qcdIndex]!, applications[rmdIndex]!)
    let running = opening
    for (const entry of applications.slice(rmdIndex, rmdIndex + 2)) {
      entry.sourceBalanceBeforePlanDollars = running
      running -= entry.appliedAmountPlanDollars!
      entry.sourceBalanceAfterPlanDollars = running
    }
    applications.forEach((entry, index) => { entry.mutationOrdinal = index + 1 })

    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'applicationOrderInvalid', taxYear: TAX_YEAR }],
      })
  })
})

describe('moving legacy QCD in the contiguous basis replay', () => {
  // The substantive statutory claim of this slice. 408(d)(8)(D) excludes the
  // QCD from the pro-rata computation, so the gift returns no basis and its
  // gross is absent from the annual denominator -- which leaves proportionally
  // MORE basis behind for the year's other distributions, not less.
  //
  // Reading A (a QCD is an ordinary line-7 distribution): denominator is the
  // 90,000 year-end balance plus the 10,000 gift, and 10 percent of the 20,000
  // basis is consumed. Reading B (408(d)(8)(D)): denominator is 90,000 alone
  // and the full 20,000 carries forward. The two disagree on both figures.
  it('returns no basis and keeps the gift out of the annual denominator', () => {
    const plan = preRmdPlan('moving-qcd-basis', [
      traditional('ira', 100_000, 'ira', 20_000),
    ])

    const result = replayOwnedNonRothIraContiguousYears(
      plan, TAX_YEAR, withMovingQcd(project(plan), 'ira', 100_000, 10_000),
    )

    expect(result.status).toBe('ownedNonRothIraContiguousReplayComplete')
    if (result.status !== 'ownedNonRothIraContiguousReplayComplete') return
    const owner = result.annualReplays[0]!.ownerReplays[0]!
    expect(owner.openingBasisAmount).toBe(2_000_000)
    expect(owner.annualBasisRatio).toMatchObject({
      representation: 'exactMinorUnitRational',
      numeratorMinorUnits: 2_000_000,
      // 90,000 of year-end balance, with no line-7 or line-8 gross beside it.
      denominatorMinorUnits: 9_000_000,
    })
    expect(owner.line7AllocationEvidence.annualGrossAmount).toBe(0)
    expect(owner.line8AllocationEvidence.annualGrossAmount).toBe(0)
    expect(owner.nextYearOpeningBasisAmount).toBe(2_000_000)
  })
})
