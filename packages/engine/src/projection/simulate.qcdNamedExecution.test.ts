import { describe, expect, it } from 'vitest'

import { asAccountId, asActionId, asAllocationId, asPersonId } from '../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../actions/money.js'
import type { QualifiedCharitableDistributionRequest } from '../actions/contract.js'
import type { Account, Plan } from '../model/plan.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { validateOwnedNonRothIraRuntimeSourceSeries } from '../internal/ownedNonRothIraRuntimeSourceSeries.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

/**
 * The first named charitable dollars this engine moves.
 *
 * Every figure below is the end-to-end consequence of one request: the source
 * IRA falls by the gift, the year publishes it, the gift produces no income,
 * and the owned-IRA source series closes on the occurrence that explains the
 * debit. The comparisons are run against the same household without the
 * request so nothing here can pass on a build that merely stopped doing
 * something else.
 */

const TAX_YEAR = 2026
/** Born 1950-03-01: age 76 in 2026, 70½ since 2020-09-01, and an RMD is due. */
const DOB = '1950-03-01'
const THRESHOLD_YEAR = 2020
const GIFT_DOLLARS = 20_000
const IRA_DOLLARS = 500_000

function ira(id: string, balance: number, basis = 0): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, 'p1', 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return {
    ...account,
    annualReturnPct: 0,
    ...(basis === 0 ? {} : { nondeductibleBasis: basis }),
  }
}

function namedQcd(
  overrides: Partial<QualifiedCharitableDistributionRequest> = {},
): QualifiedCharitableDistributionRequest {
  const amount = asPositiveUsdCents(GIFT_DOLLARS * 100)
  return {
    actionId: asActionId('qcd-action'),
    kind: 'qcd',
    year: TAX_YEAR,
    executionDate: `${TAX_YEAR}-08-01`,
    executionSequence: 1,
    requestedAmount: amount,
    provenance: { source: 'manual' },
    donorPersonId: asPersonId('p1'),
    allocation: {
      allocationId: asAllocationId('qcd-allocation'),
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

interface DonorPlanOptions {
  readonly id: string
  readonly requests?: readonly QualifiedCharitableDistributionRequest[]
  readonly accounts?: readonly Account[]
  /** Deductible IRA contributions, in dollars, keyed by tax year. */
  readonly contributionsByYear?: Readonly<Record<number, number>>
  readonly qcdAnnual?: number
  readonly dob?: string
  readonly thresholdYear?: number
  readonly actionYear?: number
}

/**
 * A donor whose named gift can actually clear every legal predicate: the source
 * IRA is classified, and the post-70½ deductible-contribution history is
 * complete from the threshold year through the action year.
 */
function donorPlan(options: DonorPlanOptions): Plan {
  const plan = singlePersonPlan({ dob: options.dob ?? DOB, planningAge: 95 })
  plan.id = options.id
  plan.accounts = [...(options.accounts ?? [ira('ira', IRA_DOLLARS), cashAccount('cash', 200_000)])]
  plan.strategies.qcdAnnual = options.qcdAnnual ?? 0
  plan.strategies.retirementActions = [...(options.requests ?? [namedQcd()])]
  const thresholdYear = options.thresholdYear ?? THRESHOLD_YEAR
  const actionYear = options.actionYear ?? TAX_YEAR
  const years: number[] = []
  for (let taxYear = thresholdYear; taxYear <= actionYear; taxYear += 1) years.push(taxYear)
  plan.retirementActionEligibilityFacts = {
    iraClassifications: [{
      sourceAccountId: 'ira',
      subtype: 'traditional',
      evidenceId: 'classification-ira',
      provenance: { source: 'manual' },
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: years.map((taxYear) => ({
      donorPersonId: 'p1',
      taxYear,
      amountCents: asUsdCents((options.contributionsByYear?.[taxYear] ?? 0) * 100),
      evidenceId: `contribution-${taxYear}`,
      provenance: { source: 'manual', sourceId: `ledger-${taxYear}` },
    })),
  }
  return plan
}

function project(plan: Plan, endYear = TAX_YEAR): YearResult[] {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: endYear,
    taxCalculator: createFlatTaxCalculator(0),
  }).years
}

function run(plan: Plan): YearResult {
  const year = project(plan).find((row) => row.year === TAX_YEAR)
  if (year === undefined) throw new Error('missing tax year')
  return year
}

describe('a named QCD moves the first charitable dollars', () => {
  const gifted = run(donorPlan({ id: 'qcd-named-execution-gift' }))
  const ungifted = run(donorPlan({ id: 'qcd-named-execution-no-gift', requests: [] }))

  it('debits the named source IRA by exactly the gift', () => {
    expect(ungifted.balances.ira - gifted.balances.ira).toBeCloseTo(GIFT_DOLLARS, 6)
  })

  it('publishes the gift as the year’s charitable total', () => {
    expect(ungifted.qcd).toBe(0)
    expect(gifted.qcd).toBeCloseTo(GIFT_DOLLARS, 6)
  })

  it('leaves AGI and MAGI where the year without the gift left them', () => {
    // The whole exclusion, stated as the thing a reader can check: a $20,000
    // distribution that added nothing to income. The RMD was distributed in
    // cash before the gift was sized and stays taxed; the gift is beyond it and
    // never entered income, so there is nothing to subtract and nothing to
    // phantom-deduct either.
    expect(gifted.magi).toBeCloseTo(ungifted.magi, 6)
    // The control that keeps the line above from being vacuous. In this
    // household MAGI is exactly the year's forced IRA distribution, so income
    // demonstrably tracks dollars leaving this IRA -- and the gift's $20,000
    // still is not in it.
    expect(gifted.rmd).toBeGreaterThan(0)
    expect(gifted.magi).toBeCloseTo(gifted.rmd, 6)
    expect(gifted.qcd).toBeCloseTo(GIFT_DOLLARS, 6)
  })

  it('changes IRMAA two years later exactly as the year without the gift does', () => {
    // AGI carries the exclusion transitively: MAGI descends from the same
    // ordinary base, and IRMAA reads MAGI on a two-year lookback. Nothing in
    // the named arm touches either, so a gift that produced no income cannot
    // produce a surcharge.
    const withGift = project(donorPlan({ id: 'qcd-named-execution-irmaa' }), TAX_YEAR + 2)
    const withoutGift = project(
      donorPlan({ id: 'qcd-named-execution-irmaa-none', requests: [] }), TAX_YEAR + 2,
    )
    const later = (years: YearResult[]) => years.find((row) => row.year === TAX_YEAR + 2)

    expect(later(withGift)?.irmaaSurcharge)
      .toBeCloseTo(later(withoutGift)?.irmaaSurcharge ?? -1, 6)
  })

  it('publishes an executed qcdExecutor record carrying the executed date', () => {
    const publication = gifted.retirementActionPublication

    expect(publication?.executorSources).toEqual(['qcdExecutor'])
    expect(publication?.records).toEqual([expect.objectContaining({
      actionId: 'qcd-action',
      executorSource: 'qcdExecutor',
      kind: 'qcd',
      personId: 'p1',
      requestedAmount: GIFT_DOLLARS * 100,
      executedAmount: GIFT_DOLLARS * 100,
      unexecutedAmount: 0,
      readiness: 'actionable',
      outcome: 'executed',
      executedDate: `${TAX_YEAR}-08-01`,
      executedSequence: 1,
      reasons: [],
    })])
  })

  it('keeps publishing the prerequisite evidence beside the executed record', () => {
    expect(gifted.qcdActionPrerequisites?.map((entry) => entry.actionId))
      .toEqual(['qcd-action'])
    expect(gifted.qcdActionPrerequisites?.[0]?.eligibility.donor).toMatchObject({
      birthDate: DOB,
      age70HalfThresholdDate: `${THRESHOLD_YEAR}-09-01`,
    })
  })

  it('carries the complete derived facts the exclusion rests on', () => {
    const execution = gifted.qcdActionExecution

    expect(execution?.committed).toBe(true)
    if (execution?.committed !== true) return
    const facts = execution.evidence[0].derivedFacts
    expect(execution.totalExecutedAmount).toBe(GIFT_DOLLARS * 100)
    expect(execution.totalExcludableAmount).toBe(GIFT_DOLLARS * 100)
    expect(execution.totalRmdSatisfiedAmount).toBe(0)
    expect(facts).toMatchObject({
      charitableDistributionAmount: GIFT_DOLLARS * 100,
      qualifiedCharitableDistributionAmount: GIFT_DOLLARS * 100,
      excludableQcdAmount: GIFT_DOLLARS * 100,
      taxableQcdAmount: 0,
      nonQcdCharitableRemainder: 0,
      charitableDeductionEligibleAmount: 0,
      charitableDeductionRequirement: 'notApplicableZeroEligibleAmount',
      deductibleContributionOffsetApplied: 0,
    })
    // The personal limit is the sourced 2026 figure, never an extrapolation.
    expect(execution.personalLimitEvidence.personalLimitAmount).toBe(111_000 * 100)
    expect(facts.personalLimitAfter).toBe((111_000 - GIFT_DOLLARS) * 100)
    // The pool capacity is the pre-distribution aggregate, so the gift sits
    // wholly inside it and the exclusion is not trimmed.
    expect(facts.otherwiseTaxableAmountBefore).toBe(IRA_DOLLARS * 100)
  })

  it('answers the RMD-coordination row rather than leaving a bare zero', () => {
    // The WS1 matrix asks every QCD to state the portion satisfying the
    // donor's applicable RMD. This household has a real required distribution,
    // and the gift satisfies none of it -- because the annual pass had already
    // distributed the whole requirement in cash before the gift was sized. The
    // typed disclosure says exactly that, so a consumer cannot read the zero
    // as "this donor had no requirement". The gap it discloses is registered:
    // treas-reg-1-408-8-g-projection-named-qcd-beyond-rmd.
    const execution = gifted.qcdActionExecution

    expect(execution?.committed).toBe(true)
    if (execution?.committed !== true) return
    expect(gifted.rmd).toBeGreaterThan(0)
    expect(execution.evidence[0].rmdCoordination).toMatchObject({
      predicate: 'qcdRmdCoordination',
      donorPersonId: 'p1',
      scope: 'ownedIra',
      inheritedFromPersonId: null,
      rmdRemainingBefore: 0,
      rmdSatisfiedAmount: 0,
      rmdRemainingAfter: 0,
      coordination: 'requirementAlreadyDistributedBeforeTheGift',
    })
    expect(execution.evidence[0].rmdCoordination.rmdRequiredAmount)
      .toBe(Math.round(gifted.rmd * 100))
  })

  it('closes the owned-IRA runtime source series on the occurrence that explains it', () => {
    const plan = validatePlan(donorPlan({ id: 'qcd-named-execution-series' }))
    const years = project(donorPlan({ id: 'qcd-named-execution-series' }))
    const occurrences = years[0]?.retirementRuntimeSource?.runtimeOccurrences ?? []

    expect(occurrences.filter((entry) => entry.kind === 'namedQcd')).toEqual([
      expect.objectContaining({
        producerOccurrenceKey: JSON.stringify([
          'namedQcd', 'ira', 'qcd-action', 'qcd-allocation',
        ]),
        grossAmountPlanDollars: GIFT_DOLLARS,
        ownerPersonId: 'p1',
        sourceAccountId: 'ira',
        executionDate: null,
        executionSequence: null,
        movementAuthorityId: null,
      }),
    ])
    expect(
      validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years).status,
    ).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
  })

  it('does not depend on Plan account order to choose the funding IRA', () => {
    // The allocation names its source, so reordering the Plan's accounts must
    // move the same dollars out of the same IRA. An engine that swept balances
    // in array order would fund the gift from whichever IRA came first.
    const accounts = [
      ira('ira', IRA_DOLLARS),
      ira('ira-2', IRA_DOLLARS),
      cashAccount('cash', 200_000),
    ]
    const forward = run(donorPlan({ id: 'qcd-named-execution-order-forward', accounts }))
    const reversed = run(donorPlan({
      id: 'qcd-named-execution-order-reversed',
      accounts: [...accounts].reverse(),
    }))

    expect(forward.balances.ira).toBeCloseTo(reversed.balances.ira, 6)
    expect(forward.balances['ira-2']).toBeCloseTo(reversed.balances['ira-2']!, 6)
    expect(forward.qcd).toBeCloseTo(reversed.qcd, 6)
    expect(forward.balances['ira-2']! - forward.balances.ira!)
      .toBeCloseTo(GIFT_DOLLARS, 6)
  })
})

describe('a named QCD the source cannot cover', () => {
  /**
   * A $40,000 gift against a $25,000 IRA. The year's forced distribution comes
   * out first and leaves $23,945.147679…, which is the point: the balance the
   * gift drains is not a whole number of cents.
   */
  const DRAINED_PLAN = {
    id: 'qcd-named-execution-trimmed',
    accounts: [ira('ira', 25_000), cashAccount('cash', 200_000)],
    requests: [namedQcd({
      requestedAmount: asPositiveUsdCents(40_000 * 100),
      allocation: {
        allocationId: asAllocationId('qcd-allocation'),
        sourceAccountId: asAccountId('ira'),
        requestedAmount: asPositiveUsdCents(40_000 * 100),
      },
    })],
  } as const

  it('executes to the available balance and says the request was trimmed', () => {
    const year = run(donorPlan(DRAINED_PLAN))
    const record = year.retirementActionPublication?.records[0]

    // Exact, because the figure is exact: the gift takes every whole cent the
    // account can fund and not one it cannot.
    expect(year.qcd).toBe(23_945.14)
    expect(record).toMatchObject({
      outcome: 'partial',
      readiness: 'actionable',
      executedDate: `${TAX_YEAR}-08-01`,
      executedAmount: 2_394_514,
    })
    expect(record?.reasons.map((reason) => reason.code)).toEqual(['qcd-balance-trimmed'])

    // The defect this replaces: the source snapshot used to round half-up, so
    // a draining gift could be authorised a cent the balance did not hold and
    // the account closed BELOW zero -- permanently, and only after the dollars
    // had moved. The bound is one-sided and tight. What is left is the
    // sub-cent residue the exact-cent ledger cannot express, which was in the
    // account before the gift and stays in it after.
    expect(year.balances.ira).toBeGreaterThanOrEqual(0)
    expect(year.balances.ira).toBeLessThan(0.01)
    expect(year.balances.ira).toBeCloseTo(0.007679, 6)

    // And the year's evidence closes over it. Before the fix this refused
    // `sourceAmountInvalid` after the movement had already happened, which
    // silently rolled the exact-basis settlement back for the whole
    // projection.
    expect(validateOwnedNonRothIraRuntimeSourceSeries(
      validatePlan(donorPlan(DRAINED_PLAN)), TAX_YEAR, project(donorPlan(DRAINED_PLAN)),
    ).status).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
  })

  it('never carries a negative balance into a later year', () => {
    // The overdraw was permanent: nothing downstream rebuilds a balance, so a
    // negative cent survived every remaining year of the projection. Three
    // years, one assertion each way.
    const years = project(donorPlan(DRAINED_PLAN), TAX_YEAR + 2)

    expect(years.map((year) => year.year)).toEqual([TAX_YEAR, TAX_YEAR + 1, TAX_YEAR + 2])
    for (const year of years) {
      expect(year.balances.ira).toBeGreaterThanOrEqual(0)
      expect(year.balances.ira).toBeLessThan(0.01)
    }
    expect(years[0]?.qcd).toBe(23_945.14)
    expect(years[1]?.qcd).toBe(0)
    expect(years[2]?.qcd).toBe(0)
  })

  it('leaves the later years as clean as the gift year', () => {
    // The isolating control, and what it now controls for.
    //
    // The residue this gift leaves used to refuse every later year: a sub-cent
    // IRA takes a sub-cent required distribution, and the journal accepts no
    // occurrence for a gross that rounds to zero cents. That was never a
    // property of the gift -- it was a property of any owned IRA left below a
    // cent by any means -- and this control proves it the same way it always
    // did, on a household with no QCD at all starting from the same residual
    // balance. What has changed is the answer: a forced distribution that
    // rounds to zero cents now moves nothing, publishes nothing, and discharges
    // its remainder, so both the control and the gifted projection close.
    //
    // The control keeps its purpose either way. A gift-specific fix would show
    // up here as a control that still refuses while the gifted years pass.
    const gifted = project(donorPlan(DRAINED_PLAN), TAX_YEAR + 1)
    const residual = gifted[0]?.balances.ira ?? 0
    const control = donorPlan({
      id: 'qcd-named-execution-subcent-control',
      accounts: [ira('ira', residual), cashAccount('cash', 200_000)],
      requests: [],
    })
    const controlYears = project(control, TAX_YEAR + 1)

    const issueKinds = (plan: Plan, years: YearResult[]) => {
      const result = validateOwnedNonRothIraRuntimeSourceSeries(
        validatePlan(plan), TAX_YEAR, years,
      )
      return result.status === 'ownedNonRothIraRuntimeSourceSeriesBlocked'
        ? result.issues.map((issue) => issue.kind)
        : []
    }

    expect(controlYears.map((year) => year.qcd)).toEqual([0, 0])
    expect(controlYears.map((year) => year.rmd)).toEqual([0, 0])
    expect(controlYears.map((year) => year.balances.ira)).toEqual([residual, residual])
    expect(issueKinds(control, controlYears)).toEqual([])
    expect(issueKinds(donorPlan(DRAINED_PLAN), gifted)).toEqual([])
  })
})

describe('a named QCD with a positive section 170 amount', () => {
  it('refuses rather than committing a gift the deduction chain cannot evidence', () => {
    // A post-70½ deductible IRA contribution reduces the exclusion under
    // Notice 2020-68, which leaves a taxable QCD -- a positive charitable
    // amount that section 170 would have to consider. The engine mints no
    // liability run to bind that consideration to, so the gift refuses instead
    // of substituting a zero deduction.
    const plan = donorPlan({
      id: 'qcd-named-execution-section-170',
      contributionsByYear: { [TAX_YEAR]: 7_000 },
    })
    const year = run(plan)
    const ungifted = run(donorPlan({
      id: 'qcd-named-execution-section-170-none',
      requests: [],
      contributionsByYear: { [TAX_YEAR]: 7_000 },
    }))

    expect(year.qcd).toBe(0)
    expect(year.balances.ira).toBeCloseTo(ungifted.balances.ira, 6)
    expect(year.qcdActionExecution?.committed).toBe(false)
    expect(year.qcdActionExecution?.issues.map((issue) => issue.kind))
      .toEqual(['charitableDeductionUnsupported'])
    expect(year.retirementActionPublication?.records[0]).toMatchObject({
      executedAmount: 0,
      outcome: 'unsupported',
      readiness: 'nonActionable',
    })
    expect(
      year.retirementActionPublication?.records[0]?.reasons.map((reason) => reason.code),
    ).toContain('qcd-nonqcd-deduction-unsupported')
  })
})

describe('a named QCD in a stand-in parameter year', () => {
  it('refuses the gift and warns, naming the year', () => {
    // The named arm may not extrapolate the indexed limit: the contract forbids
    // general plan inflation from turning a prior year's figure into actionable
    // legal evidence. The aggregate arm still may, and does -- but it has stood
    // down for this year because a named request exists, so the household gives
    // nothing at all and has to be told.
    const standInYear = TAX_YEAR + 4
    const plan = donorPlan({
      id: 'qcd-named-execution-stand-in',
      actionYear: standInYear,
      qcdAnnual: 5_000,
      requests: [namedQcd({
        year: standInYear,
        executionDate: `${standInYear}-08-01`,
      })],
    })
    const result = simulatePlan(validatePlan(plan), {
      startYear: TAX_YEAR,
      horizonEndYear: standInYear,
      taxCalculator: createFlatTaxCalculator(0),
    })
    const year = result.years.find((row) => row.year === standInYear)

    expect(year?.qcd).toBe(0)
    expect(year?.qcdActionExecution?.committed).toBe(false)
    expect(result.warnings).toContain(
      `A named QCD is scheduled for ${standInYear}, but RetireGolden has no sourced QCD limit for that tax year yet, ` +
        'so the gift was not executed and the recurring QCD amount stood down for the year. ' +
        'Plan the gift in a year whose limit is published, or model it with the recurring QCD amount instead.',
    )
  })
})

describe('a named gift beside the recurring QCD amount', () => {
  it('gives once, and the source series still closes', () => {
    // The #199 stand-down, now with dollars behind it. Setting the scalar must
    // not change the year: the named request is authoritative and the aggregate
    // arm gives nothing.
    const withScalar = donorPlan({ id: 'qcd-named-execution-combined', qcdAnnual: 5_000 })
    const withoutScalar = donorPlan({ id: 'qcd-named-execution-combined-none' })
    const scalarYear = run(withScalar)

    expect(scalarYear.qcd).toBeCloseTo(run(withoutScalar).qcd, 6)
    expect(scalarYear.qcd).toBeCloseTo(GIFT_DOLLARS, 6)
    expect(scalarYear.retirementRuntimeSource?.nonmovingLegacyQcdOverlay).toBeNull()
    expect(
      validateOwnedNonRothIraRuntimeSourceSeries(
        validatePlan(withScalar), TAX_YEAR, project(donorPlan({
          id: 'qcd-named-execution-combined', qcdAnnual: 5_000,
        })),
      ).status,
    ).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
  })
})
