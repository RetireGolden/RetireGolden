import { describe, expect, it } from 'vitest'

import type { QualifiedCharitableDistributionRequest } from '../actions/contract.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from '../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../actions/money.js'
import {
  ledgerCentsToPlanDollars,
  planDollarsToLedgerCents,
} from '../actions/planBalanceAdapter.js'
import type { Account, Plan } from '../model/plan.js'
import {
  couplePlan,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
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
 * The simulator's own annual phase order, mirroring the validator's `phaseRank`
 * exactly. A charitable gift is sized once the forced distributions are known
 * and before any conversion or need-based withdrawal, so it takes a position in
 * the middle of the chain rather than the end -- and every later debit on the
 * same account sees the reduced balance. Both gift phases sit together, after
 * the forced distributions a gift may satisfy and ahead of the conversions,
 * which may not absorb an RMD at all.
 */
const PHASE_RANK: Readonly<Record<string, number>> = {
  annuityPurchaseFunding: 0,
  pensionLumpSumRollover: 1,
  employeeContribution: 2,
  ownerRmdDistribution: 3,
  automaticSeppDistribution: 4,
  legacyQcdDistribution: 5,
  namedQcdDistribution: 6,
  namedRothConversionDebit: 7,
  namedRothConversionDestinationCredit: 8,
  legacyRothConversion: 9,
  legacyRothConversionAggregateDestinationCredit: 10,
  legacyNeedBasedWithdrawal: 11,
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
  /**
   * Stage the gift as a named request's rather than the aggregate strategy's:
   * a `namedQcd` occurrence in the `namedQcdDistribution` phase, keyed on the
   * authorising action and allocation instead of the source account alone.
   */
  readonly named?: { readonly actionId: string; readonly allocationId: string }
  /**
   * How much of the moving draw was NOT a qualified charitable distribution,
   * under 408(d)(8)(B)'s closing sentence read with (D)'s aggregate cap. Zero
   * on every fixture whose gift fits inside the owner's includible amount.
   */
  readonly nonQualifiedRemainder?: number
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
  const kind = options.named === undefined ? 'legacyQcd' : 'namedQcd'
  const phase = options.named === undefined
    ? 'legacyQcdDistribution'
    : 'namedQcdDistribution'
  const producerOccurrenceKey = options.named === undefined
    ? JSON.stringify([kind, sourceAccountId])
    : JSON.stringify([
      kind, sourceAccountId, options.named.actionId, options.named.allocationId,
    ])

  if (options.occurrence !== false) {
    const occurrences = occurrenceSource.runtimeOccurrences as unknown as {
      producerOccurrenceKey: string
    }[]
    occurrences.push({
      producerOccurrenceKey,
      kind,
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
        PHASE_RANK[phase]!)
    return found === -1 ? applications.length : found
  })()
  const sourceBalanceBefore = applications
    .slice(0, insertIndex)
    .filter((entry) => entry.sourceAccountId === sourceAccountId)
    .at(-1)?.sourceBalanceAfterPlanDollars ?? openingBalance
  if (options.application !== false) {
    applications.splice(insertIndex, 0, {
      applicationKind: 'debit',
      producerOccurrenceKey,
      simulatorPhase: phase,
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
  for (const balance of year.ownedNonRothIraPhysicalBalancesBeforeGrowth ?? []) {
    if (balance.sourceAccountId !== sourceAccountId) continue
    ;(balance as { balancePlanDollars: number }).balancePlanDollars -= amount
  }
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
  // A moving gift carries its own 408(d)(8)(D) characterization, one per
  // occurrence. These fixtures are built on households whose gift is well
  // inside the owner's aggregate includible amount, so none of it is the
  // ordinary distribution (B)'s closing sentence would make it -- but the
  // entry has to be there, because a `legacyQcd` occurrence with no
  // characterization is a draw the replay cannot place on Form 8606 at all.
  const characterizations = occurrenceSource
    .legacyQcdCharacterizations as unknown as unknown[]
  characterizations.splice(0)
  if (options.occurrence !== false && options.named === undefined) {
    characterizations.push({
      producerOccurrenceKey,
      ownerPersonId: 'p1',
      grossAmountPlanDollars: amount,
      nonQualifiedLine7GrossPlanDollars:
        options.nonQualifiedRemainder ?? 0,
    })
  }
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

const GIFT_DOLLARS = 10_000

/** One named gift, dated after the donor's exact 70½ threshold of 2026-07-01. */
function namedGift(
  overrides: Partial<QualifiedCharitableDistributionRequest> = {},
): QualifiedCharitableDistributionRequest {
  const amount = asPositiveUsdCents(GIFT_DOLLARS * 100)
  return {
    actionId: asActionId('gift-action'),
    kind: 'qcd',
    year: TAX_YEAR,
    executionDate: `${TAX_YEAR}-08-01`,
    executionSequence: 1,
    requestedAmount: amount,
    provenance: { source: 'manual' },
    donorPersonId: asPersonId('p1'),
    allocation: {
      allocationId: asAllocationId('gift-allocation'),
      sourceAccountId: asAccountId('ira'),
      requestedAmount: amount,
    },
    charity: {
      designationId: 'charity-1',
      name: 'Public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
    ...overrides,
  }
}

function namedGiftPlan(
  id: string,
  accounts: Account[],
  request: QualifiedCharitableDistributionRequest = namedGift(),
): Plan {
  const plan = preRmdPlan(id, accounts)
  plan.strategies.retirementActions = [request]
  return plan
}

/**
 * The same gift, attested well enough to actually settle: the source IRA is
 * classified and the post-70½ deductible-contribution history is complete. The
 * donor's exact threshold is 2026-07-01, so the history is the action year
 * alone.
 */
function committedGiftPlan(id: string): Plan {
  const plan = namedGiftPlan(id, [traditional('ira', 100_000)])
  plan.retirementActionEligibilityFacts = {
    iraClassifications: [{
      sourceAccountId: 'ira',
      subtype: 'traditional',
      evidenceId: 'classification-ira',
      provenance: { source: 'manual' },
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [{
      donorPersonId: 'p1',
      taxYear: TAX_YEAR,
      amountCents: asUsdCents(0),
      evidenceId: `contribution-${TAX_YEAR}`,
      provenance: { source: 'manual', sourceId: `ledger-${TAX_YEAR}` },
    }],
  }
  return plan
}

/** Strip the gift's occurrence while leaving every dollar where it went. */
function withoutNamedQcdOccurrence(years: YearResult[]): YearResult[] {
  const source = years[0]!.retirementRuntimeSource!
  ;(source as { runtimeOccurrences: unknown }).runtimeOccurrences =
    source.runtimeOccurrences.filter((entry) => entry.kind !== 'namedQcd')
  return years
}

/** The producer key a named gift's occurrence has to carry: four members. */
function namedGiftKey(
  sourceAccountId = 'ira',
  actionId = 'gift-action',
  allocationId = 'gift-allocation',
): string {
  return JSON.stringify(['namedQcd', sourceAccountId, actionId, allocationId])
}

/**
 * Publish a well-formed `namedQcd` occurrence and nothing else -- no
 * application, no balance change, no published-total change. Every dollar in
 * the year is exactly where the simulator left it, so the only thing the
 * validator can object to is the occurrence's own existence.
 */
function withNamedQcdOccurrenceOnly(
  years: YearResult[],
  producerOccurrenceKey: string,
  sourceAccountId = 'ira',
): YearResult[] {
  const occurrences = years[0]!.retirementRuntimeSource!
    .runtimeOccurrences as unknown as { producerOccurrenceKey: string }[]
  occurrences.push({
    producerOccurrenceKey,
    kind: 'namedQcd',
    grossAmountPlanDollars: GIFT_DOLLARS,
    ownerPersonId: 'p1',
    sourceAccountId,
    executionDate: null,
    executionSequence: null,
    movementAuthorityId: null,
  } as never)
  occurrences.sort((left, right) =>
    left.producerOccurrenceKey < right.producerOccurrenceKey
      ? -1
      : left.producerOccurrenceKey > right.producerOccurrenceKey ? 1 : 0)
  return years
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

  // A moving draw with no characterization is a draw this replay cannot place
  // on Form 8606 at all: 408(d)(8)(B)'s closing sentence makes qualification a
  // question of amount, not of kind, so "it is a legacyQcd occurrence" does not
  // answer whether any of it belonged on line 7. Refused rather than assumed
  // qualified, which is the assumption that overstated basis before this guard.
  it('refuses a moving gift whose qualification is unstated', () => {
    const plan = preRmdPlan('moving-qcd-uncharacterized', [
      traditional('ira', 100_000),
    ])
    const years = withMovingQcd(project(plan), 'ira', 100_000, 10_000)
    ;(years[0]!.retirementRuntimeSource!
      .legacyQcdCharacterizations as unknown as unknown[]).splice(0)

    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'qcdStageRequired', taxYear: TAX_YEAR }],
      })
  })

  // And a remainder larger than the draw it came out of describes an ordinary
  // distribution bigger than the dollars that moved. Not a stage gap: the
  // characterization is published and well formed, and it contradicts the draw
  // it belongs to, which is the ledger and this replay disagreeing about a
  // figure. `qcdReconciliationInvalid` is what says so, and it is outside the
  // settlement's year-scoped allow-list for exactly that reason.
  it('refuses a non-qualified remainder that outruns its own draw', () => {
    const plan = preRmdPlan('moving-qcd-overcharacterized', [
      traditional('ira', 100_000),
    ])
    const years = withMovingQcd(project(plan), 'ira', 100_000, 10_000, {
      nonQualifiedRemainder: 10_001,
    })

    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'qcdReconciliationInvalid' }],
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

  // The other half of the split, and the half that used to be refused. A gift
  // routed out of an RMD moves no extra dollars, so it keeps the nonmoving
  // overlay -- but the overlay now carries the answer to the question that used
  // to block it. IRC 408(d)(8)(D) is measured against one individual's plans
  // treated as one contract, and the annual ledger settles whose requirement
  // carried the gift when it sizes it, so the overlay states that attribution
  // and this replay reduces exactly that owner's Form 8606 line-7 gross by it.
  it('characterizes a gift routed out of an RMD from its owner attribution', () => {
    const plan = singlePersonPlan({ dob: '1945-01-01', planningAge: 90 })
    plan.id = 'routed-qcd-attributed'
    plan.accounts = [cash(), traditional('ira', 500_000)]
    plan.strategies.qcdAnnual = 5_000

    const years = project(plan)
    const requiredDistribution = years[0]!.rmd

    expect(years[0]!.qcd).toBe(5_000)
    expect(requiredDistribution).toBeGreaterThan(5_000)
    expect(years[0]!.retirementRuntimeSource!.nonmovingLegacyQcdOverlay)
      .toMatchObject({
        kind: 'legacyQcd',
        physicalMovement: 'notAdditionalMovement',
        grossAmountPlanDollars: 5_000,
        ownerAttributions: [{
          ownerPersonId: 'p1',
          routedGrossPlanDollars: 5_000,
          qualifiedLine7ExclusionPlanDollars: 5_000,
        }],
      })

    const result = validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years)
    expect(result.status).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
    if (result.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') return
    const distribution = result.years[0]!.ownerSources[0]!.applications
      .find((entry) => entry.simulatorPhase === 'ownerRmdDistribution')!
    // The two figures the carve keeps apart. Every routed cent LEFT THE ACCOUNT
    // under this debit, so the balance chain still carries the whole
    // requirement; the Form 8606 line-7 instructions keep a qualified
    // charitable distribution off the line, so the gross the return reports is
    // the requirement less the gift.
    expect(distribution.amount)
      .toBe(planDollarsToLedgerCents(requiredDistribution))
    expect(distribution.form8606Line).toBe('line7')
    expect(distribution.form8606LineGrossAmount)
      .toBe(planDollarsToLedgerCents(requiredDistribution - 5_000))
  })

  // The refusal is not gone, it is conditioned. An overlay whose attribution
  // does not rejoin the requirements it claims to have been routed out of
  // describes a gift no individual retirement plan could have funded under
  // 408(d)(8)(B), and a replay that carved it anyway would be inventing the
  // owner's line-7 gross rather than reproducing the ledger's.
  it('refuses an overlay whose carve outruns the owner’s own requirement', () => {
    const plan = singlePersonPlan({ dob: '1945-01-01', planningAge: 90 })
    plan.id = 'routed-qcd-carve-overruns'
    plan.accounts = [cash(), traditional('ira', 500_000)]
    plan.strategies.qcdAnnual = 5_000

    const years = project(plan)
    const overlay = years[0]!.retirementRuntimeSource!.nonmovingLegacyQcdOverlay!
    ;(overlay.ownerAttributions[0] as {
      qualifiedLine7ExclusionPlanDollars: number
    }).qualifiedLine7ExclusionPlanDollars = years[0]!.rmd + 1

    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'qcdReconciliationInvalid', taxYear: TAX_YEAR }],
      })
  })

  // And an overlay that names nobody is the shape this whole slice removed: it
  // states a gift and no owner to charge it to, which is the one thing the
  // replay cannot derive for itself.
  it('refuses an overlay carrying no owner attribution at all', () => {
    const plan = singlePersonPlan({ dob: '1945-01-01', planningAge: 90 })
    plan.id = 'routed-qcd-unattributed'
    plan.accounts = [cash(), traditional('ira', 500_000)]
    plan.strategies.qcdAnnual = 5_000

    const years = project(plan)
    const overlay = years[0]!.retirementRuntimeSource!.nonmovingLegacyQcdOverlay!
    ;(overlay as unknown as { ownerAttributions: readonly never[] })
      .ownerAttributions = []

    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'sourceContractInvalid', taxYear: TAX_YEAR }],
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

describe('moving legacy QCD through the live annual pass', () => {
  // The fixtures above hand-build the annual facts so each rule can be probed
  // in isolation. This one takes no such liberty: it runs the real simulator on
  // a real pre-RMD gift and asserts the evidence chain closes end to end.
  // Delete either recording call at the QCD debit site and this fails --
  // the receiving side alone cannot keep it green.
  it('publishes a gift the source series and basis replay both accept', () => {
    const plan = preRmdPlan('live-pre-rmd-qcd', [
      traditional('ira', 100_000, 'ira', 20_000),
    ])
    plan.strategies.qcdAnnual = 10_000

    const years = project(plan)
    const validated = validatePlan(plan)

    expect(years[0]!.rmd).toBe(0)
    expect(years[0]!.qcd).toBe(10_000)
    // Nothing was routed out of an RMD, so the nonmoving overlay is empty and
    // the whole gift is carried by its own occurrence.
    expect(years[0]!.retirementRuntimeSource!.nonmovingLegacyQcdOverlay)
      .toBeNull()
    expect(years[0]!.retirementRuntimeSource!.runtimeOccurrences)
      .toContainEqual(expect.objectContaining({
        kind: 'legacyQcd',
        grossAmountPlanDollars: 10_000,
        ownerPersonId: 'p1',
        sourceAccountId: 'ira',
        executionDate: null,
        executionSequence: null,
        movementAuthorityId: null,
      }))
    expect(years[0]!.retirementRuntimeApplicationSource!.applications)
      .toContainEqual(expect.objectContaining({
        applicationKind: 'debit',
        simulatorPhase: 'legacyQcdDistribution',
        sourceAccountId: 'ira',
        sourceBalanceBeforePlanDollars: 100_000,
        appliedAmountPlanDollars: 10_000,
        sourceBalanceAfterPlanDollars: 90_000,
      }))

    expect(validateOwnedNonRothIraRuntimeSourceSeries(validated, TAX_YEAR, years))
      .toMatchObject({ status: 'ownedNonRothIraRuntimeSourceSeriesComplete' })
    const replay = replayOwnedNonRothIraContiguousYears(validated, TAX_YEAR, years)
    expect(replay.status).toBe('ownedNonRothIraContiguousReplayComplete')
    if (replay.status !== 'ownedNonRothIraContiguousReplayComplete') return
    // 408(d)(8)(D): the gift took pre-tax dollars, so all 20,000 of basis is
    // still there for later years.
    expect(replay.annualReplays[0]!.ownerReplays[0]!.nextYearOpeningBasisAmount)
      .toBe(2_000_000)
    // The settlement only commits when the replay closes, so a published annual
    // replay is the end-to-end proof that the gift was explained.
    expect(years[0]!.ownedNonRothIraAnnualReplay).toBeDefined()
  })

  // A gift larger than the RMD backing it splits across both routes in the same
  // year. Neither total is the published figure on its own, and both routes now
  // characterize: the routed share off the overlay's attribution, the moving
  // share off its own occurrence. Neither reaches Form 8606 line 7, which is
  // exactly what (D) read with the line-7 instructions requires -- one because
  // it was carved out of the requirement's gross, the other because a QCD was
  // never a line-7 distribution in the first place.
  it('splits a gift that outruns its RMD across the overlay and its occurrences', () => {
    const plan = singlePersonPlan({ dob: '1945-01-01', planningAge: 90 })
    plan.id = 'split-qcd-overlay-and-occurrences'
    plan.accounts = [cash(), traditional('ira', 200_000)]
    plan.strategies.qcdAnnual = 30_000

    const years = project(plan)
    const overlay = years[0]!.retirementRuntimeSource!.nonmovingLegacyQcdOverlay
    const moving = years[0]!.retirementRuntimeSource!.runtimeOccurrences
      .filter((entry) => entry.kind === 'legacyQcd')
      .reduce((total, entry) => total + entry.grossAmountPlanDollars, 0)

    expect(overlay?.grossAmountPlanDollars).toBe(years[0]!.rmd)
    expect(moving).toBeGreaterThan(0)
    expect(overlay!.grossAmountPlanDollars + moving).toBeCloseTo(years[0]!.qcd, 6)
    expect(overlay!.ownerAttributions).toEqual([{
      ownerPersonId: 'p1',
      routedGrossPlanDollars: years[0]!.rmd,
      qualifiedLine7ExclusionPlanDollars: years[0]!.rmd,
    }])

    const result = validateOwnedNonRothIraRuntimeSourceSeries(
      validatePlan(plan), TAX_YEAR, years,
    )
    expect(result.status).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
    if (result.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') return
    // The whole requirement went to charity, so the distribution reports no
    // line-7 gross at all -- it is not a line-7 entry, rather than a line-7
    // entry of nothing.
    const distribution = result.years[0]!.ownerSources[0]!.applications
      .find((entry) => entry.simulatorPhase === 'ownerRmdDistribution')!
    expect(distribution.form8606Line).toBeNull()
    expect(distribution.form8606LineGrossAmount).toBe(0)
    expect(result.years[0]!.ownerSources[0]!.applications
      .every((entry) => entry.form8606Line !== 'line7')).toBe(true)
  })

  // TWO DONORS, which is the path the single-owner fixtures above cannot
  // exercise. The gift is charged to each owner in proportion to their own
  // required distribution, so the overlay carries two attributions and the
  // source series has to carve two different owners' line-7 grosses -- and each
  // owner has their own Form 8606 denominator, which is exactly why
  // 408(d)(8)(D) has to be settled per owner rather than per household.
  it('carves a household gift across both donors’ requirements', () => {
    const plan = couplePlan({
      p1Dob: '1945-01-01', p1PlanningAge: 90,
      p2Dob: '1945-01-01', p2PlanningAge: 90,
    })
    plan.id = 'routed-qcd-two-donors'
    plan.accounts = [
      cash(),
      { ...traditional('ira-p1', 400_000, 'ira', 40_000), ownerPersonId: 'p1' },
      { ...traditional('ira-p2', 200_000, 'ira', 20_000), ownerPersonId: 'p2' },
    ]
    plan.strategies.qcdAnnual = 9_000

    const years = project(plan)
    const validated = validatePlan(plan)
    const overlay = years[0]!.retirementRuntimeSource!.nonmovingLegacyQcdOverlay!

    // The whole gift fits inside the household requirement, so nothing moved
    // beyond it and the overlay carries all 9,000 -- split two to one, which is
    // how the two requirements stand.
    expect(years[0]!.qcd).toBeCloseTo(9_000, 6)
    expect(overlay.ownerAttributions.map((entry) => entry.ownerPersonId))
      .toEqual(['p1', 'p2'])
    expect(overlay.ownerAttributions[0]!.routedGrossPlanDollars)
      .toBeCloseTo(6_000, 6)
    expect(overlay.ownerAttributions[1]!.routedGrossPlanDollars)
      .toBeCloseTo(3_000, 6)

    const result = validateOwnedNonRothIraRuntimeSourceSeries(
      validated, TAX_YEAR, years,
    )
    expect(result.status).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
    if (result.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') return
    for (const ownerSource of result.years[0]!.ownerSources) {
      const attribution = overlay.ownerAttributions
        .find((entry) => entry.ownerPersonId === ownerSource.ownerPersonId)!
      const distribution = ownerSource.applications
        .find((entry) => entry.simulatorPhase === 'ownerRmdDistribution')!
      // Each owner's own gross shrinks by their own carve and by nobody else's.
      expect(distribution.form8606LineGrossAmount).toBe(planDollarsToLedgerCents(
        ledgerCentsToPlanDollars(distribution.amount) -
          attribution.qualifiedLine7ExclusionPlanDollars,
      ))
    }
    // And the year settles end to end, on both owners at once.
    expect(years[0]!.ownedNonRothIraAnnualReplay).toBeDefined()
    expect(years[0]!.ownedNonRothIraAnnualReplay!.annualReplay.ownerReplays)
      .toHaveLength(2)
  })
})

describe('a named QCD occurrence binds to committed executor evidence', () => {
  // The binding runs both ways, and each direction has its own failure. An
  // occurrence with no committed gift behind it is a forgery that would explain
  // an owned-IRA debit nothing authorised; a committed gift with no occurrence
  // is dollars leaving with the balance chain closing only because the record
  // that should have accounted for them is absent. The first two cases below
  // are the first direction, on the two fixtures that make the claim hardest to
  // dismiss: one year is arithmetically untouched and the other is a complete,
  // self-consistent moving fixture.
  it('refuses a gift occurrence in a year that committed nothing', () => {
    const plan = namedGiftPlan('named-qcd-occurrence-only', [
      traditional('ira', 100_000),
    ])

    const result = validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR,
      withNamedQcdOccurrenceOnly(project(plan), namedGiftKey()),
    )

    expect(result).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{
        kind: 'namedQcdInvalid',
        taxYear: TAX_YEAR,
        producerOccurrenceKey: namedGiftKey(),
        detail: 'A named QCD occurrence requires committed charitable-distribution evidence',
      }],
    })
  })

  // The same fixture shape that makes the aggregate arm's gift acceptable:
  // occurrence, application, balance chain, published total, all consistent.
  // It is still refused, so the rejection cannot be mistaken for the balance
  // chain catching an unexplained debit -- the year committed no gift, and
  // arithmetic agreement is not authority.
  it('refuses a gift occurrence backed by a complete moving fixture', () => {
    const plan = namedGiftPlan('named-qcd-moving-fixture', [
      traditional('ira', 100_000),
    ])

    const result = validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR,
      withMovingQcd(project(plan), 'ira', 100_000, GIFT_DOLLARS, {
        named: { actionId: 'gift-action', allocationId: 'gift-allocation' },
      }),
    )

    expect(result).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{ kind: 'namedQcdInvalid', taxYear: TAX_YEAR }],
    })
  })

  // The positive case, and the one every rejection below is a mutation of: a
  // gift the executor actually committed, whose occurrence rejoins it in exact
  // cents in both directions.
  it('accepts a committed gift whose occurrence rejoins it in exact cents', () => {
    const plan = committedGiftPlan('named-qcd-committed')
    const years = project(plan)

    expect(years[0]!.qcd).toBeCloseTo(GIFT_DOLLARS, 6)
    expect(years[0]!.qcdActionExecution?.committed).toBe(true)
    expect(validateOwnedNonRothIraRuntimeSourceSeries(
      validatePlan(plan), TAX_YEAR, years,
    ).status).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
  })

  // The second direction. The dollars still left the IRA and the published
  // total still names them; only the record that says which request moved them
  // is gone, and that is exactly the case a one-way check would let through.
  it('refuses a committed gift whose occurrence was removed', () => {
    const plan = committedGiftPlan('named-qcd-orphan-commitment')
    const years = withoutNamedQcdOccurrence(project(plan))

    expect(validateOwnedNonRothIraRuntimeSourceSeries(
      validatePlan(plan), TAX_YEAR, years,
    )).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{
        kind: 'namedQcdInvalid',
        detail: 'Every committed owned-IRA gift requires its named occurrence',
      }],
    })
  })

  // Cents, not Plan dollars. An occurrence that names a real committed gift but
  // a different amount is the quiet version of a forgery, and comparing in the
  // ledger's own units is what catches it.
  it('refuses an occurrence whose amount is not the committed amount', () => {
    const plan = committedGiftPlan('named-qcd-amount-drift')
    const years = project(plan)
    const occurrence = years[0]!.retirementRuntimeSource!.runtimeOccurrences
      .find((entry) => entry.kind === 'namedQcd')!
    ;(occurrence as { grossAmountPlanDollars: number }).grossAmountPlanDollars =
      GIFT_DOLLARS - 1

    expect(validateOwnedNonRothIraRuntimeSourceSeries(
      validatePlan(plan), TAX_YEAR, years,
    )).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{ kind: 'namedQcdInvalid' }],
    })
  })

  // IRC 408(d)(8)(B) reaches only a distribution from an individual retirement
  // plan, and the source rules for an inherited or Roth source are registered
  // out of scope. The replay refuses an employer-plan source structurally,
  // before the coverage gate above and without reading the request: this key
  // binds a real Plan action and allocation, so source compatibility is the
  // only thing left for the validator to object to.
  it('refuses an employer plan named as the source of a gift', () => {
    const plan = namedGiftPlan(
      'named-qcd-employer-source',
      [traditional('ira', 100_000), traditional('k401', 100_000, 'employer')],
      namedGift({
        allocation: {
          allocationId: asAllocationId('gift-allocation'),
          sourceAccountId: asAccountId('k401'),
          requestedAmount: asPositiveUsdCents(GIFT_DOLLARS * 100),
        },
      }),
    )

    const result = validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR,
      withNamedQcdOccurrenceOnly(project(plan), namedGiftKey('k401'), 'k401'),
    )

    expect(result).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{
        kind: 'sourceIdentityInvalid',
        detail: 'Occurrence owner/source/kind must exact-rejoin its Plan account',
      }],
    })
  })

  // Two members are the aggregate gift's whole key, because a household scalar
  // has no action behind it. A named gift keyed that way would be
  // indistinguishable from a second gift out of the same account, which is the
  // collision the extra two members exist to prevent.
  it('refuses a gift key shaped like the aggregate arm’s', () => {
    const plan = namedGiftPlan('named-qcd-short-key', [
      traditional('ira', 100_000),
    ])

    const result = validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR,
      withNamedQcdOccurrenceOnly(
        project(plan), JSON.stringify(['namedQcd', 'ira']),
      ),
    )

    expect(result).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{
        kind: 'sourceIdentityInvalid',
        detail: 'Named QCD key must bind its Plan action, allocation, and stated source account',
      }],
    })
  })

  // The cross-role case: a real action, a real allocation, and a real owned
  // IRA of the donor's -- but not the account that allocation named. Accepting
  // it would let one authorised gift explain a debit from a sibling account.
  it('refuses a gift occurrence sourced from an account its allocation did not name', () => {
    const plan = namedGiftPlan('named-qcd-wrong-source', [
      traditional('ira', 100_000), traditional('ira2', 100_000),
    ])

    const result = validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR,
      withNamedQcdOccurrenceOnly(project(plan), namedGiftKey('ira2'), 'ira2'),
    )

    expect(result).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{
        kind: 'sourceIdentityInvalid',
        detail: 'Named QCD key must bind its Plan action, allocation, and stated source account',
      }],
    })
  })

  // One authorising allocation is one gift. A duplicated key would let a
  // single request account for two debits.
  it('refuses a duplicated gift key', () => {
    const plan = namedGiftPlan('named-qcd-duplicate-key', [
      traditional('ira', 100_000),
    ])
    const years = withNamedQcdOccurrenceOnly(project(plan), namedGiftKey())

    const result = validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR,
      withNamedQcdOccurrenceOnly(years, namedGiftKey()),
    )

    expect(result).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{
        kind: 'sourceIdentityInvalid',
        detail: 'Runtime occurrence keys must be nonblank and unique',
      }],
    })
  })
})

describe('a declared named QCD stops blocking the replay it never moved in', () => {
  // The behavioural gain. Declaring a QCD from an owned IRA used to fail the
  // whole year closed with `exactActionStageRequired`, because the guard could
  // not tell a declared gift from a moving one. The occurrence kind is what
  // tells them apart: a gift that settled publishes one and is bound to the
  // executor's committed cents, and a gift that did not publishes nothing and
  // leaves the year's evidence exactly as a year without the request.
  //
  // These fixtures are the second case, and they are that case for a reason
  // the reader can check: the Plan carries no IRA classification and no
  // post-70½ deductible-contribution history, so the eligibility predicate
  // refuses the request before any stage could settle it. The attested
  // fixtures above are what move dollars.
  it('closes the source series and the basis replay for the year that declares it', () => {
    const plan = namedGiftPlan('named-qcd-declared-only', [
      traditional('ira', 100_000, 'ira', 20_000),
    ])
    const validated = validatePlan(plan)
    const years = project(plan)

    expect(validateOwnedNonRothIraRuntimeSourceSeries(validated, TAX_YEAR, years))
      .toMatchObject({ status: 'ownedNonRothIraRuntimeSourceSeriesComplete' })
    const replay = replayOwnedNonRothIraContiguousYears(validated, TAX_YEAR, years)
    expect(replay.status).toBe('ownedNonRothIraContiguousReplayComplete')
    // The settlement only commits when the replay closes, so a published
    // annual replay is the end-to-end proof that the year is explainable.
    expect(years[0]!.ownedNonRothIraAnnualReplay).toBeDefined()
  })

  // The same fact one layer down, where movement would show up first: no
  // occurrence of the gift kind, no application in its phase, and an IRA
  // balance identical to the same household without the request. It is a
  // statement about an unattested request, not about named QCDs.
  it('publishes no gift occurrence and moves no dollars when unattested', () => {
    const withRequest = project(namedGiftPlan('named-qcd-with-request', [
      traditional('ira', 100_000, 'ira', 20_000),
    ]))[0]!
    const withoutRequest = project(preRmdPlan('named-qcd-without-request', [
      traditional('ira', 100_000, 'ira', 20_000),
    ]))[0]!

    expect(withRequest.retirementRuntimeSource!.runtimeOccurrences
      .filter((occurrence) => occurrence.kind === 'namedQcd')).toEqual([])
    expect(withRequest.retirementRuntimeApplicationSource!.applications
      .filter((application) =>
        application.simulatorPhase === 'namedQcdDistribution')).toEqual([])
    expect(withRequest.qcd).toBe(0)
    expect(withRequest.qcd).toBe(withoutRequest.qcd)
    expect(withRequest.balances.ira).toBe(withoutRequest.balances.ira)
    // The evidence the year does publish is the prerequisite, and only that.
    expect(withRequest.qcdActionPrerequisites?.map(
      (evidence) => evidence.actionId,
    )).toEqual(['gift-action'])
  })
})
