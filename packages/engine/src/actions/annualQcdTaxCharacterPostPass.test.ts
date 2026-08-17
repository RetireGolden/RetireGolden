import { describe, expect, it } from 'vitest'
import { describeRule } from '../rules/describeRule.js'
import { parsePlan, type Plan } from '../model/plan.js'
import { couplePlan, singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import type { QualifiedCharitableDistributionRequest } from './contract.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { evaluateAnnualQcdExecutionPrerequisites } from './annualQcdExecutionPrerequisite.js'
import {
  stageAnnualQcdPhysicalExecution,
  type AnnualQcdRmdPoolOpeningSnapshot,
  type StageAnnualQcdPhysicalExecutionInput,
} from './annualQcdPhysicalExecution.js'
import {
  stageAnnualQcdTaxCharacterPostPass,
  type StageAnnualQcdTaxCharacterPostPassInput,
} from './annualQcdTaxCharacterPostPass.js'
import { irc408d8APriorReductionsAreProvable } from './qcdDeductibleContributionOffset.js'
import type { ClassifyOwnedNonRothIraAnnualWithdrawalsInput } from './ownedNonRothIraWithdrawalCharacter.js'
interface ActionSpec {
  id: string
  donor?: 'p1' | 'p2'
  source?: string
  amount: number
  date?: string
  sequence?: number
}
interface FixtureOptions {
  year?: number
  capacity?: Partial<Record<'p1' | 'p2', number>>
  contribution?: Partial<Record<'p1' | 'p2', number>>
  priorOffset?: Record<string, number>
  balance?: Record<string, number>
  rmdRemaining?: number
}
const charity = {
  designationId: 'charity-a', name: 'Public charity',
  designationKind: 'eligiblePublicCharity' as const,
  directFromCustodianAttested: true, eligibleOrganizationAttested: true,
  notDonorAdvisedFundOrSupportingOrganizationAttested: true,
  notSplitInterestEntityAttested: true,
  entireDistributionOtherwiseDeductibleAttested: true,
}
function request(spec: ActionSpec, year: number): QualifiedCharitableDistributionRequest {
  const donor = spec.donor ?? 'p1'
  const source = spec.source ?? `ira-${donor}`
  const amount = asPositiveUsdCents(spec.amount)
  return {
    actionId: asActionId(spec.id), kind: 'qcd', year,
    executionDate: spec.date ?? `${year}-08-01`,
    executionSequence: spec.sequence ?? 1, requestedAmount: amount,
    provenance: { source: 'manual' }, donorPersonId: asPersonId(donor),
    allocation: {
      allocationId: asAllocationId(`allocation-${spec.id}`),
      sourceAccountId: asAccountId(source), requestedAmount: amount,
    },
    charity: { ...charity, designationId: `charity-${spec.id}` },
  }
}
function fixture(
  specs: readonly ActionSpec[] = [{ id: 'qcd-a', amount: 1_000 }],
  options: FixtureOptions = {},
): StageAnnualQcdTaxCharacterPostPassInput {
  const year = options.year ?? 2026
  const requests = specs.map((spec) => request(spec, year))
  const donors = [...new Set(requests.map((entry) => entry.donorPersonId))]
  const rawPlan = donors.includes(asPersonId('p2'))
    ? couplePlan({ p1Dob: '1955-01-31', p2Dob: '1955-01-31', p1PlanningAge: 90, p2PlanningAge: 90 })
    : singlePersonPlan({ dob: '1955-01-31', planningAge: 90 })
  const sourceIds = [...new Set(requests.map((entry) => entry.allocation.sourceAccountId))]
  rawPlan.accounts = sourceIds.map((sourceId) => {
    const owner = requests.find((entry) => entry.allocation.sourceAccountId === sourceId)!.donorPersonId
    return traditionalAccount(sourceId, 1_000_000, owner)
  })
  rawPlan.strategies.retirementActions = [...requests]
  rawPlan.retirementActionEligibilityFacts = {
    iraClassifications: sourceIds.map((sourceAccountId) => ({
      sourceAccountId, subtype: 'traditional' as const,
      evidenceId: `classification-${sourceAccountId}`, provenance: { source: 'manual' as const },
    })),
    sepSimpleActivities: [],
    deductibleIraContributions: donors.flatMap((donorPersonId) =>
      Array.from({ length: year - 2024 }, (_, index) => 2025 + index).map((taxYear) => ({
        donorPersonId, taxYear,
        amountCents: asUsdCents(taxYear === year
          ? options.contribution?.[donorPersonId as 'p1' | 'p2'] ?? 0
          : 0),
        evidenceId: `contribution-${donorPersonId}-${taxYear}`,
        provenance: { source: 'manual' as const, sourceId: `ledger-${donorPersonId}-${taxYear}` },
      }))),
  }
  const parsed = parsePlan(rawPlan)
  if (!parsed.ok) throw new Error('invalid fixture Plan')
  const plan = parsed.plan
  const runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = {
    personAliveEvidence: requests.map((entry) => ({
      evidenceId: `alive-${entry.actionId}`, actionId: entry.actionId,
      personId: entry.donorPersonId, actionYear: year,
      actionDate: entry.executionDate ?? null, alive: true,
    })),
    priorQcdOffsetEvidence: requests.map((entry) => ({
      evidenceId: `offset-${entry.actionId}`, actionId: entry.actionId,
      donorPersonId: entry.donorPersonId, actionYear: year,
      actionDate: entry.executionDate ?? null,
      priorOffsetApplied: asUsdCents(options.priorOffset?.[entry.actionId] ?? 0),
    })),
  }
  const prerequisite = evaluateAnnualQcdExecutionPrerequisites({
    taxYear: year, plan, requests, runtimeEvidence,
  })
  if (prerequisite.status !== 'evaluated') throw new Error('invalid fixture prerequisite')
  const openingBalances = sourceIds.map((accountId) => ({
    accountId,
    openingBalance: asUsdCents(options.balance?.[accountId] ?? requests
      .filter((entry) => entry.allocation.sourceAccountId === accountId)
      .reduce((sum, entry) => sum + entry.requestedAmount, 0)),
  }))
  const rmdPools: AnnualQcdRmdPoolOpeningSnapshot[] = donors.map((donorPersonId) => ({
    predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot',
    poolId: `rmd-${donorPersonId}-${year}`, taxYear: year, donorPersonId,
    scope: 'ownedIra',
    sourceAccountIds: sourceIds.filter((sourceId) =>
      requests.some((entry) => entry.donorPersonId === donorPersonId &&
        entry.allocation.sourceAccountId === sourceId)) as [ReturnType<typeof asAccountId>, ...ReturnType<typeof asAccountId>[]],
    rmdRequiredAmount: asUsdCents(options.rmdRemaining ?? 500),
    rmdSatisfiedBefore: asUsdCents(0),
    rmdRemainingBefore: asUsdCents(options.rmdRemaining ?? 500),
    upstreamEvidenceId: `rmd-upstream-${donorPersonId}`,
  }))
  const physicalInput: StageAnnualQcdPhysicalExecutionInput = {
    prerequisite, plan, runtimeEvidence, openingBalances, rmdPools,
  }
  const physical = stageAnnualQcdPhysicalExecution(physicalInput)
  if (physical.status !== 'annualQcdPhysicalExecutionStaged') throw new Error('invalid fixture physical stage')
  const poolCapacityInputs = donors.map((donorPersonId): ClassifyOwnedNonRothIraAnnualWithdrawalsInput => {
    const donorApps = physical.applications.filter((entry) => entry.request.donorPersonId === donorPersonId)
    const physicalQcdTotal = donorApps.reduce(
      (sum, entry) => sum + entry.charitableDistributionAmount, 0,
    )
    const desiredCapacity = options.capacity?.[donorPersonId as 'p1' | 'p2'] ?? physicalQcdTotal + 1_000
    const gross = Math.max(physicalQcdTotal, desiredCapacity)
    const yearEnd = gross - physicalQcdTotal
    const accountIds = rmdPools.find((entry) => entry.donorPersonId === donorPersonId)!.sourceAccountIds
    return {
      ownerPersonId: donorPersonId,
      ownerWideNonRothIraPoolId: `tax-pool-${donorPersonId}-${year}`,
      completePoolEvidence: {
        predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
        ownerPersonId: donorPersonId,
        ownerWideNonRothIraPoolId: `tax-pool-${donorPersonId}-${year}`,
        taxYear: year, accountIds,
        yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd),
        evidenceId: `complete-pool-${donorPersonId}-${year}`,
      },
      annualBasisRecordEvidenceId: `basis-record-${donorPersonId}-${year}`,
      taxYear: year,
      poolMembers: accountIds.map((sourceAccountId, index) => ({
        sourceAccountId, ownerPersonId: donorPersonId,
        accountType: 'traditional', accountKind: 'ira', inheritanceStatus: 'owned',
        subtype: 'traditional',
        yearEndApplicableBalanceAmount: asUsdCents(index === 0 ? yearEnd : 0),
        iraClassificationEvidenceId: `tax-classification-${sourceAccountId}`,
        accountOwnershipEvidenceId: `tax-ownership-${sourceAccountId}`,
      })),
      annualFacts: {
        openingBasisAmount: asUsdCents(gross - desiredCapacity),
        taxYearNondeductibleContributionAmount: asUsdCents(0),
        postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
        yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd),
        outstandingRolloverAmount: asUsdCents(0),
        rolloverRepaymentAdjustmentAmount: asUsdCents(0),
        form8606Line7DistributionAmount: asUsdCents(0),
        form8606Line8NetConversionAmount: asUsdCents(0),
      },
      line7Distributions: [], line8Conversions: [],
    }
  })
  return { physicalInput, poolCapacityInputs }
}
function staged(input: StageAnnualQcdTaxCharacterPostPassInput) {
  const result = stageAnnualQcdTaxCharacterPostPass(input)
  expect(result.status).toBe('annualQcdTaxCharacterPostPassStaged')
  if (result.status !== 'annualQcdTaxCharacterPostPassStaged') throw new Error(result.issues[0].detail)
  return result
}
describe('stageAnnualQcdTaxCharacterPostPass', () => {
  it('stages a fully excludable provisional partition without final authority', () => {
    const input = fixture()
    const snapshot = structuredClone(input)
    const result = staged(input)
    expect(input).toEqual(snapshot)
    expect(result).toMatchObject({
      committed: false, movement: 'notCommitted',
      taxCharacterStatus: 'awaitingResidualAndSection170Reconciliation',
      personalLimitEvidence: {
        taxYear: 2026, personalLimitAmount: 11_100_000,
        parameterPackYear: 2026, parameterSource: { id: 'rmd-qcd' },
      },
      applications: [{
        charitableDistributionAmount: 1_000,
        qualifiedCharitableDistributionAmount: 1_000,
        excludableQcdAmount: 1_000, taxableQcdAmount: 0,
        nonQcdCharitableRemainder: 0, charitableDeductionEligibleAmount: 0,
        charitableDeductionRequirement: 'notApplicableZeroEligibleAmount',
        provisionalCharacter: {
          status: 'provisionalAwaitingResidualAndSection170Reconciliation',
          qcdIncomeExclusionAmount: 1_000, ordinaryIncomeAmount: 0, basisReturnAmount: 0,
        },
      }],
    })
    expect(Object.isFrozen(result.applications[0]?.provisionalCharacter)).toBe(true)
    expect(result.applications[0]).not.toHaveProperty('taxCharacter')
  })

  it('uses taxable capacity first and sends the excess to basis remainder', () => {
    const result = staged(fixture(undefined, { capacity: { p1: 600 } }))
    expect(result.applications[0]).toMatchObject({
      otherwiseTaxableAmountUsed: 600, qualifiedCharitableDistributionAmount: 600,
      nonQcdCharitableRemainder: 400, excludableQcdAmount: 600,
      taxableQcdAmount: 0, charitableDeductionEligibleAmount: 400,
    })
    expect(result.pools[0]).toMatchObject({
      physicalQcdGrossAmount: 1_000, taxablePoolGrossBalanceBefore: 1_000,
      taxablePoolBasisBefore: 400, otherwiseTaxableAmountBefore: 600,
      qualifiedCharitableDistributionAmount: 600, nonQcdCharitableRemainder: 400,
      adjustedResidualBasisDenominatorAmount: 400,
      adjustedResidualBasisNumeratorAmount: 400, otherwiseTaxableAmountAfter: 0,
    })
  })

  it('applies deductible-contribution offset before exclusion', () => {
    const result = staged(fixture(undefined, { contribution: { p1: 300 } }))
    expect(result.applications[0]).toMatchObject({
      deductibleContributionOffsetBefore: 300,
      deductibleContributionOffsetApplied: 300,
      excludableQcdAmount: 700, taxableQcdAmount: 300,
      charitableDeductionEligibleAmount: 300,
    })
  })

  it('opens lifetime offset state from prior-year QCD consumption', () => {
    const result = staged(fixture(undefined, {
      contribution: { p1: 500 }, priorOffset: { 'qcd-a': 200 },
    }))
    expect(result.applications[0]).toMatchObject({
      deductibleContributionOffsetBefore: 300,
      deductibleContributionOffsetApplied: 300,
      deductibleContributionOffsetAfter: 0,
      excludableQcdAmount: 700,
    })
  })

  // The flush sentence of IRC 408(d)(8)(A) subtracts the reductions ALREADY
  // made in earlier years from the aggregate section 219 deductions. Without
  // that subtraction the same deduction dollar would offset a QCD again every
  // year for the rest of the donor's life. Here 500 of deductions with 200
  // already consumed leaves 300 to offset, not the full 500.
  describeRule('irc-408-d-8-A-post-70-half-deduction-offset', {
    readings: { cumulativeNetOfPriorReductions: 300, aggregateDeductionsIgnoringPrior: 500 },
    accepted: 'cumulativeNetOfPriorReductions',
  }, ({ accepted, readings }) => {
    it('nets the prior reductions off the aggregate deductions', () => {
      const result = staged(fixture(undefined, {
        contribution: { p1: 500 }, priorOffset: { 'qcd-a': 200 },
      }))

      expect(result.applications[0]).toMatchObject({
        deductibleContributionOffsetBefore: accepted,
      })
      expect(result.applications[0]).not.toMatchObject({
        deductibleContributionOffsetBefore: readings.aggregateDeductionsIgnoringPrior,
      })
    })
  })

  it('applies the exact-year personal limit per donor', () => {
    // IRC 408(d)(8)(A) as indexed by Notice 2025-67: $111,000 for 2026.
    const result = staged(fixture([{ id: 'large', amount: 12_000_000 }]))
    expect(result.applications[0]).toMatchObject({
      personalLimitBefore: 11_100_000, personalLimitUsed: 11_100_000,
      excludableQcdAmount: 11_100_000, taxableQcdAmount: 900_000,
      // This pool carries no basis, so the over-limit portion raises no question.
      includibleQcdBasisTreatment: 'notApplicable',
    })
  })

  // IRC 408(d)(8)(D) deems a charitable distribution to come out of pre-tax
  // dollars first: "Notwithstanding section 72 ... the entire amount of the
  // distribution shall be treated as includible in gross income ... to the
  // extent that such amount does not exceed the aggregate amount which would
  // have been so includible if all amounts in all individual retirement plans of
  // the individual were distributed". So the QCD leaves the Form 8606 pro-rata
  // denominator entirely, full basis survives for the year's other
  // distributions, and only the part exceeding aggregate pre-tax dollars is not
  // a QCD at all.
  it('draws the QCD from pre-tax dollars first and leaves basis for the remainder', () => {
    // Gross 12,000,000c over 11,500,000c of pre-tax dollars, so 500,000c basis.
    const result = staged(fixture([{ id: 'large', amount: 12_000_000 }],
      { capacity: { p1: 11_500_000 } }))
    expect(result.applications[0]).toMatchObject({
      // The QCD is capped at aggregate pre-tax dollars and never reaches basis.
      otherwiseTaxableAmountBefore: 11_500_000,
      qualifiedCharitableDistributionAmount: 11_500_000,
      otherwiseTaxableAmountAfter: 0,
      // The 500,000c beyond pre-tax dollars is not a QCD. It is an ordinary
      // distribution and does belong on Form 8606 line 7 — the Pub 590-B "Amy"
      // example, where the non-QCD remainder draws basis.
      nonQcdCharitableRemainder: 500_000,
      // Of the QCD itself, only the annual limit is excluded.
      excludableQcdAmount: 11_100_000, taxableQcdAmount: 400_000,
    })
  })

  // No regulation, ruling, or IRS example addresses a partly-excludable QCD from
  // an IRA that also carries basis. IRC 408(d)(8)(E) denies a 170 deduction only
  // for QCDs "not includible in gross income pursuant to subparagraph (A)",
  // implying the includible excess stays a QCD — already deemed pre-tax by (D),
  // so no basis recovery. The Form 1040 instructions instead speak of "the part
  // that is not a QCD", which would route it to line 7 with pro-rata basis. This
  // engine takes the statutory reading, which is also the conservative one, and
  // must say so rather than imply the point is settled.
  it('discloses when a partly-excludable QCD rests on the unsettled basis reading', () => {
    const result = staged(fixture([{ id: 'large', amount: 12_000_000 }],
      { capacity: { p1: 11_500_000 } }))
    expect(result.applications[0]!.includibleQcdBasisTreatment)
      .toBe('statutoryTaxableFirstUnsettledAgainstBasis')
  })

  it('does not disclose an unsettled basis reading when the QCD is fully excluded', () => {
    // Within the annual limit and drawn wholly from pre-tax dollars: settled.
    const result = staged(fixture(undefined, { capacity: { p1: 5_000 } }))
    expect(result.applications[0]).toMatchObject({
      taxableQcdAmount: 0, includibleQcdBasisTreatment: 'notApplicable',
    })
  })

  describeRule('irc-408-d-8-A-annual-qcd-limit', {
    readings: { indexed2026: 11_100_000, prior2025: 10_800_000 },
    accepted: 'indexed2026',
  }, ({ accepted, readings }) => {
    it('excludes only the indexed annual limit', () => {
      const excluded = staged(fixture([{ id: 'large', amount: 12_000_000 }]))
        .applications[0]!.excludableQcdAmount
      expect(excluded).toBe(accepted)
      expect(excluded).not.toBe(readings.prior2025)
    })
  })

  describeRule('irc-408-d-8-D-qcd-taxable-first', {
    // Gross 12,000,000c against 11,500,000c of pre-tax dollars and 500,000c of
    // basis. Taxable-first caps the QCD at pre-tax dollars, leaving a 500,000c
    // non-QCD remainder that does draw basis. A plain section 72 pro-rata
    // reading would make the whole distribution a QCD and leave no remainder.
    readings: { taxableFirst: 500_000, proRataSection72: 0 },
    accepted: 'taxableFirst',
  }, ({ accepted, readings }) => {
    it('caps the QCD at aggregate pre-tax dollars and leaves the rest to basis', () => {
      const application = staged(fixture([{ id: 'large', amount: 12_000_000 }],
        { capacity: { p1: 11_500_000 } })).applications[0]!
      expect(application.nonQcdCharitableRemainder).toBe(accepted)
      expect(application.nonQcdCharitableRemainder).not.toBe(readings.proRataSection72)
      expect(application.otherwiseTaxableAmountAfter).toBe(0)
    })
  })

  describeRule('irc-408-d-8-includible-qcd-basis', {
    // The readings disagree on what remains a QCD once the annual limit binds.
    // Under 408(d)(8)(E) the whole pre-tax draw stays a QCD and the includible
    // excess recovers no basis; under the Form 1040 instructions "QCD" means the
    // capped amount and the excess would reach Form 8606 line 7 with basis.
    readings: { statutoryWholeDrawRemainsQcd: 11_500_000, form1040CappedQcd: 11_100_000 },
    accepted: 'statutoryWholeDrawRemainsQcd',
  }, ({ accepted, readings }) => {
    it('keeps the includible excess inside the QCD and discloses the reading', () => {
      const application = staged(fixture([{ id: 'large', amount: 12_000_000 }],
        { capacity: { p1: 11_500_000 } })).applications[0]!
      expect(application.qualifiedCharitableDistributionAmount).toBe(accepted)
      expect(application.qualifiedCharitableDistributionAmount).not.toBe(readings.form1040CappedQcd)
      expect(application.includibleQcdBasisTreatment)
        .toBe('statutoryTaxableFirstUnsettledAgainstBasis')
    })
  })

  // The three QCD adjustments are each pinned above, but nothing pinned the
  // order they compose in — the same gap that let the IRC 170(b)(1)(I) floor
  // ordering defect survive. It is the same shape, too: the offset F is a
  // subtraction rather than a cap, so it does not commute with either trim, and
  // the candidate orderings separate by real dollars.
  //
  // The statute fixes the order in its own text. The flush sentence of
  // 408(d)(8)(B) is definitional — a distribution is a QCD "only to the extent"
  // it would be includible without regard to (A) — so the taxable trim T runs
  // before (A) has a "qualified charitable distribution" to speak of, and (D)
  // supplies the measure of T. The first sentence of (A) then excludes so much
  // as does not exceed the annual limit L. The second sentence of (A) runs last
  // and names its own input: it reduces "the amount of distributions not
  // includible in gross income by reason of the preceding sentence
  // (determined without regard to this sentence) ... but not below zero".
  //
  //   excludable = max(0, min(min(Q, T), L) - F)
  //
  // Two fixtures are needed because no single one can separate all three
  // orderings: the limit-first reading only differs where T is the binding
  // minimum, and the offset-first reading only differs where L is. Those are
  // mutually exclusive, so each ordering gets the inputs that expose it.

  // Q = 12,000,000c against T = 10,000,000c of pre-tax dollars, L = 11,100,000c,
  // F = 800,000c. T binds.
  //   min(min(Q, T), L) - F = min(10,000,000, 11,100,000) - 800,000 = 9,200,000
  //   min(min(Q, L) - F, T) = min(11,100,000 - 800,000, 10,000,000) = 10,000,000
  describeRule('irc-408-d-8-A-qcd-exclusion-composition-order', {
    readings: {
      statuteTrimThenLimitThenOffset: 9_200_000,
      rejectedLimitOnGrossDistribution: 10_000_000,
    },
    accepted: 'statuteTrimThenLimitThenOffset',
    note: 'The 408(d)(8)(B) taxable trim runs before the annual limit, not after it.',
  }, ({ accepted, readings }) => {
    it('limits what survives the taxable trim, not the gross distribution', () => {
      const application = staged(fixture([{ id: 'large', amount: 12_000_000 }],
        { capacity: { p1: 10_000_000 }, contribution: { p1: 800_000 } })).applications[0]!

      expect(application.excludableQcdAmount).toBe(accepted)
      expect(application.excludableQcdAmount)
        .not.toBe(readings.rejectedLimitOnGrossDistribution)
      // The limit is charged against the trimmed 10,000,000, not the gross
      // 12,000,000, so it never binds and the offset is what reduces the result.
      expect(application.otherwiseTaxableAmountUsed).toBe(10_000_000)
      expect(application.personalLimitUsed).toBe(10_000_000)
    })

    it('reproduces the contract\'s $100,000-pool worked example', () => {
      // The plan doc's second worked example: a $131,000 transfer against only
      // $100,000 of otherwise-taxable pool, offset $20,000, limit $111,000. It
      // separates the statute from the limit-on-gross reading and NOT from the
      // offset-before-limit reading, because T < L makes those two coincide:
      //   statute            min(min(Q, T), L) - F = 10,000,000 - 2,000,000 = 8,000,000
      //   limit on gross     min(min(Q, L) - F, T) = min(9,100,000, 10,000,000) = 9,100,000
      //   offset before limit min(min(Q, T) - F, L) = min(8,000,000, 11,100,000) = 8,000,000
      // That coincidence is why this example alone cannot cover the rule, and
      // why the sibling suite below carries the L-binding half.
      const application = staged(fixture([{ id: 'worked-b', amount: 13_100_000 }],
        { capacity: { p1: 10_000_000 }, contribution: { p1: 2_000_000 } })).applications[0]!

      expect(application.excludableQcdAmount).toBe(8_000_000)
      expect(application.excludableQcdAmount)
        .not.toBe(readings.rejectedLimitOnGrossDistribution)
      // The contract states these two figures for this example by name.
      expect(application.qualifiedCharitableDistributionAmount).toBe(10_000_000)
      expect(application.nonQcdCharitableRemainder).toBe(3_100_000)
      expect(application.taxableQcdAmount).toBe(2_000_000)
      expect(application.charitableDeductionEligibleAmount).toBe(5_100_000)
    })
  })

  // Q = 12,000,000c against T = 11,800,000c of pre-tax dollars, L = 11,100,000c,
  // F = 800,000c. L binds.
  //   min(min(Q, T), L) - F = min(11,800,000, 11,100,000) - 800,000 = 10,300,000
  //   min(min(Q, T) - F, L) = min(11,800,000 - 800,000, 11,100,000) = 11,000,000
  describeRule('irc-408-d-8-A-qcd-exclusion-composition-order', {
    readings: {
      statuteLimitThenOffset: 10_300_000,
      rejectedOffsetBeforeLimit: 11_000_000,
    },
    accepted: 'statuteLimitThenOffset',
    note: 'The post-70.5 offset reduces the already-limited amount, not the amount going into the limit.',
  }, ({ accepted, readings }) => {
    it('subtracts the deduction offset after the annual limit has bound', () => {
      const application = staged(fixture([{ id: 'large', amount: 12_000_000 }],
        { capacity: { p1: 11_800_000 }, contribution: { p1: 800_000 } })).applications[0]!

      expect(application.excludableQcdAmount).toBe(accepted)
      expect(application.excludableQcdAmount).not.toBe(readings.rejectedOffsetBeforeLimit)
      // The limit binds first at 11,100,000 of the 11,800,000 trimmed amount,
      // and the offset then comes off that, not off the 11,800,000.
      expect(application.otherwiseTaxableAmountUsed).toBe(11_800_000)
      expect(application.personalLimitUsed).toBe(11_100_000)
      expect(application.deductibleContributionOffsetApplied).toBe(800_000)
    })

    it('floors the reduction at zero rather than going negative', () => {
      // "reduced (but not below zero)". A 1,000c QCD against 300,000c of
      // post-70.5 deductions excludes nothing and stays fully includible; it
      // does not carry a negative exclusion into the partition.
      const application = staged(fixture(undefined,
        { contribution: { p1: 300_000 } })).applications[0]!

      expect(application.deductibleContributionOffsetApplied).toBe(1_000)
      expect(application.excludableQcdAmount).toBe(0)
      expect(application.taxableQcdAmount).toBe(1_000)
    })

    it('reproduces the contract\'s fully-taxable worked example', () => {
      // The plan doc's first worked example: a $131,000 transfer wholly inside a
      // $131,000 otherwise-taxable pool, offset $20,000, limit $111,000. It
      // separates the statute from the offset-before-limit reading and NOT from
      // the limit-on-gross reading, because L < T makes those two coincide:
      //   statute            min(min(Q, T), L) - F = 11,100,000 - 2,000,000 = 9,100,000
      //   offset before limit min(min(Q, T) - F, L) = min(11,100,000, 11,100,000) = 11,100,000
      //   limit on gross     min(min(Q, L) - F, T) = min(9,100,000, 13,100,000) = 9,100,000
      // Together with the $100,000-pool variant in the sibling suite above, the
      // pair covers all three orderings; neither does so alone.
      const application = staged(fixture([{ id: 'worked-a', amount: 13_100_000 }],
        { capacity: { p1: 13_100_000 }, contribution: { p1: 2_000_000 } })).applications[0]!

      expect(application.excludableQcdAmount).toBe(9_100_000)
      expect(application.excludableQcdAmount).not.toBe(readings.rejectedOffsetBeforeLimit)
      // Every figure the contract states for this example by name.
      expect(application.personalLimitUsed).toBe(11_100_000)
      expect(application.otherwiseTaxableAmountUsed).toBe(13_100_000)
      expect(application.otherwiseTaxableAmountAfter).toBe(0)
      expect(application.deductibleContributionOffsetApplied).toBe(2_000_000)
      expect(application.qualifiedCharitableDistributionAmount).toBe(13_100_000)
      expect(application.taxableQcdAmount).toBe(4_000_000)
      expect(application.nonQcdCharitableRemainder).toBe(0)
      expect(application.charitableDeductionEligibleAmount).toBe(4_000_000)
      expect(application.personalLimitAfter).toBe(0)
      expect(application.deductibleContributionOffsetAfter).toBe(0)
    })
  })

  it('produces the exact three-way partition', () => {
    const result = staged(fixture(undefined, {
      capacity: { p1: 800 }, contribution: { p1: 300 },
    }))
    expect(result.applications[0]).toMatchObject({
      excludableQcdAmount: 500, taxableQcdAmount: 300,
      nonQcdCharitableRemainder: 200, charitableDeductionEligibleAmount: 500,
      provisionalCharacter: {
        qcdIncomeExclusionAmount: 500, ordinaryIncomeAmount: 300, basisReturnAmount: 200,
      },
    })
  })

  it('exhausts one donor pool in canonical schedule order', () => {
    const result = staged(fixture([
      { id: 'later', amount: 700, date: '2026-09-01' },
      { id: 'earlier', amount: 700, date: '2026-03-01' },
    ], { capacity: { p1: 1_000 } }))
    expect(result.applications.map((entry) => [
      entry.actionId, entry.otherwiseTaxableAmountBefore,
      entry.otherwiseTaxableAmountUsed, entry.otherwiseTaxableAmountAfter,
    ])).toEqual([
      ['earlier', 1_000, 700, 300], ['later', 300, 300, 0],
    ])
  })

  it('keeps spouse capacity, personal limits, and offsets separate', () => {
    const result = staged(fixture([
      { id: 'p1-qcd', donor: 'p1', amount: 1_000 },
      { id: 'p2-qcd', donor: 'p2', amount: 1_000, sequence: 2 },
    ], { contribution: { p1: 300 }, capacity: { p1: 600, p2: 1_000 } }))
    expect(result.applications.map((entry) => [
      entry.donorPersonId, entry.personalLimitBefore,
      entry.deductibleContributionOffsetBefore, entry.excludableQcdAmount,
    ])).toEqual([
      ['p1', 11_100_000, 300, 300], ['p2', 11_100_000, 0, 1_000],
    ])
  })

  it('does not let RMD remaining cap QCD character', () => {
    const none = staged(fixture(undefined, { rmdRemaining: 0 }))
    const full = staged(fixture(undefined, { rmdRemaining: 1_000 }))
    expect(none.applications[0]?.excludableQcdAmount).toBe(1_000)
    expect(full.applications[0]?.excludableQcdAmount).toBe(1_000)
    expect([none.applications[0]?.rmdSatisfiedByAction,
      full.applications[0]?.rmdSatisfiedByAction]).toEqual([0, 1_000])
  })

  it('does not consume annual state for a zero physical movement', () => {
    const result = staged(fixture(undefined, { balance: { 'ira-p1': 0 } }))
    expect(result.applications[0]).toMatchObject({
      charitableDistributionAmount: 0, otherwiseTaxableAmountUsed: 0,
      personalLimitUsed: 0, deductibleContributionOffsetApplied: 0,
      excludableQcdAmount: 0, charitableDeductionEligibleAmount: 0,
    })
  })

  it('fails closed for a future-year stand-in parameter pack', () => {
    const result = stageAnnualQcdTaxCharacterPostPass(fixture(undefined, { year: 2027 }))
    expect(result).toMatchObject({
      status: 'annualQcdTaxCharacterPostPassBlocked',
      issues: [{ kind: 'taxParameterUnavailable' }], applications: [], pools: [],
    })
  })

  it('rejects an incomplete Plan QCD batch', () => {
    const input = fixture()
    ;(input.physicalInput.plan as Plan).strategies.retirementActions.push(
      request({ id: 'omitted', amount: 1_000, date: '2026-10-01' }, 2026),
    )
    expect(stageAnnualQcdTaxCharacterPostPass(input)).toMatchObject({
      status: 'annualQcdTaxCharacterPostPassBlocked',
      issues: [{ kind: 'incompletePlanBatch' }],
    })
  })

  it('rejects forged physical prerequisite evidence atomically', () => {
    const input = structuredClone(fixture()) as StageAnnualQcdTaxCharacterPostPassInput
    const evidence = input.physicalInput.prerequisite.evidence[0]!
    ;(evidence as { actionId: string }).actionId = 'forged'
    expect(stageAnnualQcdTaxCharacterPostPass(input)).toMatchObject({
      status: 'annualQcdTaxCharacterPostPassBlocked', applications: [], pools: [],
      issues: [{ kind: 'physicalInvalid' }],
    })
  })

  it.each(['line7Distributions', 'line8Conversions'] as const)(
    'rejects physical QCD leakage into base %s', (ledger) => {
      const input = fixture()
      const leaked = [{
        actionId: asActionId('qcd-a'), allocationId: asAllocationId('allocation-qcd-a'),
        sourceAccountId: asAccountId('ira-p1'), scheduledDate: '2026-08-01',
        scheduledSequence: 1, grossAmount: asUsdCents(1_000),
      }]
      const capacity = input.poolCapacityInputs[0]!
      expect(stageAnnualQcdTaxCharacterPostPass({
        ...input, poolCapacityInputs: [{ ...capacity, [ledger]: leaked }],
      })).toMatchObject({
        status: 'annualQcdTaxCharacterPostPassBlocked',
        issues: [{ kind: 'poolCapacityInvalid' }],
      })
    },
  )

  it('rejects donor offset chronology that reuses an earlier offset', () => {
    const input = fixture([
      { id: 'first', amount: 200, date: '2026-03-01' },
      { id: 'second', amount: 200, date: '2026-06-01' },
    ], { contribution: { p1: 300 }, priorOffset: { first: 0, second: 0 } })
    expect(stageAnnualQcdTaxCharacterPostPass(input)).toMatchObject({
      status: 'annualQcdTaxCharacterPostPassBlocked',
      issues: [{ kind: 'contributionOffsetInvalid' }],
    })
  })

  it('names consumed-past-total as contributionOffsetInvalid, not a zero remainder', () => {
    // Eligibility already refuses `priorOffsetApplied > total`, and the
    // post-pass rebuilds that prerequisite from the Plan, so a forged batch
    // is `physicalInvalid` before the offset loop. The statutory reading is
    // still fail-closed: limb (ii) cannot exceed limb (i). The predicate the
    // loop uses is the same one the helper suite pins — $400 already taken
    // against $300 of §219 is unprovable, not "offset exhausted".
    expect(irc408d8APriorReductionsAreProvable(300, 400)).toBe(false)
    expect(irc408d8APriorReductionsAreProvable(300, 300)).toBe(true)
  })
})
