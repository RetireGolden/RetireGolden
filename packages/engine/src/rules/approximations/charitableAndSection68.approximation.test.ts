/**
 * Pins for the OBBBA charitable and section 68 cluster — one `settled` record
 * and four `approximated` ones, kept together in one file because what they
 * have to say is the same thing said five times.
 *
 * The engine holds an exact implementation of these rules under
 * `packages/engine/src/actions`: a section 170 ledger for itemizers, a section
 * 170(p) ledger for everyone else, a section 68 attribution chain, and the
 * exact-law parameters all three read. Nothing under
 * `packages/engine/src/projection` or in `packages/engine/src/tax/federalTax.ts`
 * refers to any of it. The deduction a plan actually shows comes from
 * `itemizedTotal` (federalTax.ts:111-119), which is capped SALT plus mortgage
 * interest plus the charitable figure at face value:
 *
 *     return salt + Math.max(0, items.mortgageInterest) + Math.max(0, items.charitable)
 *
 * No 0.5 percent floor, no 60 percent ceiling, no carryforward, no section 68
 * reduction, and nothing at all for a household that takes the standard
 * deduction. So the first fixture below drives the shelved ledger to show the
 * rule IS implemented, and the other four drive `computeFederalTax` to show
 * that the number a user sees does not come from there.
 *
 * Every scenario sets `peopleAged65Plus: 0` so the OBBBA senior deduction is
 * out of the arithmetic and the only thing moving between two readings is the
 * limitation under test.
 */

import { describe, expect, it } from 'vitest'
import { describeRule } from '../describeRule.js'
import { computeFederalTax } from '../../tax/federalTax.js'
import type { TaxYearInput } from '../../projection/types.js'
import { parsePlan } from '../../model/plan.js'
import { couplePlan, singlePersonPlan, traditionalAccount } from '../../testing/planFixtures.js'
import type { RetirementActionEligibilityRuntimeEvidence } from '../../strategies/accountEligibility.js'
import type { QualifiedCharitableDistributionRequest } from '../../actions/contract.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from '../../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../../actions/money.js'
import { evaluateAnnualQcdExecutionPrerequisites } from '../../actions/annualQcdExecutionPrerequisite.js'
import type { AnnualQcdRmdPoolOpeningSnapshot } from '../../actions/annualQcdPhysicalExecution.js'
import type { ClassifyOwnedNonRothIraAnnualWithdrawalsInput } from '../../actions/ownedNonRothIraWithdrawalCharacter.js'
import {
  stageAnnualQcdStandardSection170pLedger,
  type AnnualQcdStandardSection170pTaxUnitInput,
} from '../../actions/annualQcdStandardSection170pLedger.js'

const TAX_YEAR = 2026

function taxpayer(
  ordinaryIncome: number,
  itemizedDeductions: TaxYearInput['itemizedDeductions'],
  filingStatus: TaxYearInput['filingStatus'] = 'single',
): TaxYearInput {
  return {
    year: TAX_YEAR,
    filingStatus,
    ordinaryIncome,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    itemizedDeductions,
  }
}

/**
 * Two of the gaps below are a *missing fact* rather than mis-sized arithmetic —
 * the engine has nowhere to put a contribution carryforward, and nowhere to put
 * a gift that should be deducted off the standard-deduction branch. A fixture
 * that feeds only the three fields `itemizedDeductions` has today would stay
 * green on the day someone adds the field and closes the gap. So each of those
 * fixtures also supplies the fact under the names a fix would plausibly give it
 * and asserts the answer does not move. The first commit that honours any of
 * these keys fails the fixture and names the record to reclassify.
 */
function withExtraFacts(
  items: NonNullable<TaxYearInput['itemizedDeductions']>,
  facts: Readonly<Record<string, number>>,
): NonNullable<TaxYearInput['itemizedDeductions']> {
  return { ...items, ...facts } as NonNullable<TaxYearInput['itemizedDeductions']>
}

/**
 * Drives the real section 170(p) ledger end to end, from a parsed Plan through
 * the QCD execution prerequisite and the tax-character post-pass, so the cap
 * under test is applied by the shipped code rather than by the fixture.
 *
 * `giftCents` is distributed from an IRA carrying no pre-tax dollars, which is
 * what makes the whole gift a section 170 contribution: 408(d)(8)(D) deems a
 * QCD to come out of otherwise-includible dollars first, so with none to find
 * nothing is excluded and the entire distribution is charitable-deduction
 * eligible. `contributionBaseCents` is set high enough that the 60 percent
 * ceiling of 170(b)(1)(G)(i) has spare capacity and the dollar cap is the only
 * limitation that binds.
 */
function section170pLedger(
  giftCents: number,
  contributionBaseCents: number,
  joint = false,
): ReturnType<typeof stageAnnualQcdStandardSection170pLedger> {
  // Only p1 gives, on either return. A joint fixture is the same single gift
  // against a two-member tax unit, which is exactly the case the record is
  // about: the $2,000 figure is a per-return cap the spouses share, not a
  // second $1,000 that has to be earned by a second gift.
  const donors = [asPersonId('p1')]
  const members = joint ? [asPersonId('p1'), asPersonId('p2')] : [asPersonId('p1')]
  const requests: QualifiedCharitableDistributionRequest[] = [{
    actionId: asActionId('qcd-under-test'),
    kind: 'qcd',
    year: TAX_YEAR,
    executionDate: '2026-08-01',
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(giftCents),
    provenance: { source: 'manual' },
    donorPersonId: asPersonId('p1'),
    allocation: {
      allocationId: asAllocationId('allocation-qcd-under-test'),
      sourceAccountId: asAccountId('ira-p1'),
      requestedAmount: asPositiveUsdCents(giftCents),
    },
    charity: {
      designationId: 'public-charity',
      name: 'Public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
  }]
  const rawPlan = joint
    ? couplePlan({ p1Dob: '1955-01-31', p2Dob: '1955-01-31', p1PlanningAge: 90, p2PlanningAge: 90 })
    : singlePersonPlan({ dob: '1955-01-31', planningAge: 90 })
  rawPlan.accounts = donors.map((donor) => traditionalAccount(`ira-${donor}`, 1_000_000, donor))
  rawPlan.strategies.retirementActions = [...requests]
  rawPlan.retirementActionEligibilityFacts = {
    iraClassifications: donors.map((donor) => ({
      sourceAccountId: asAccountId(`ira-${donor}`),
      subtype: 'traditional' as const,
      evidenceId: `classification-${donor}`,
      provenance: { source: 'manual' as const },
    })),
    sepSimpleActivities: [],
    deductibleIraContributions: donors.flatMap((donorPersonId) =>
      [2025, 2026].map((taxYear) => ({
        donorPersonId,
        taxYear,
        amountCents: asUsdCents(0),
        evidenceId: `contribution-${donorPersonId}-${taxYear}`,
        provenance: { source: 'manual' as const, sourceId: `ledger-${donorPersonId}-${taxYear}` },
      }))),
  }
  const parsed = parsePlan(rawPlan)
  if (!parsed.ok) throw new Error('invalid Plan fixture')
  const runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = {
    personAliveEvidence: requests.map((entry) => ({
      evidenceId: `alive-${entry.actionId}`, actionId: entry.actionId, personId: entry.donorPersonId,
      actionYear: TAX_YEAR, actionDate: entry.executionDate ?? null, alive: true,
    })),
    priorQcdOffsetEvidence: requests.map((entry) => ({
      evidenceId: `offset-${entry.actionId}`, actionId: entry.actionId,
      donorPersonId: entry.donorPersonId, actionYear: TAX_YEAR,
      actionDate: entry.executionDate ?? null, priorOffsetApplied: asUsdCents(0),
    })),
  }
  const prerequisite = evaluateAnnualQcdExecutionPrerequisites({
    taxYear: TAX_YEAR, plan: parsed.plan, requests, runtimeEvidence,
  })
  if (prerequisite.status !== 'evaluated') throw new Error('invalid prerequisite fixture')
  const rmdPools: AnnualQcdRmdPoolOpeningSnapshot[] = donors.map((donor) => ({
    predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot', poolId: `rmd-${donor}-${TAX_YEAR}`,
    taxYear: TAX_YEAR, donorPersonId: donor, scope: 'ownedIra',
    sourceAccountIds: [asAccountId(`ira-${donor}`)], rmdRequiredAmount: asUsdCents(0),
    rmdSatisfiedBefore: asUsdCents(0), rmdRemainingBefore: asUsdCents(0),
    upstreamEvidenceId: `rmd-source-${donor}`,
  }))
  const poolCapacityInputs = donors.map((donor): ClassifyOwnedNonRothIraAnnualWithdrawalsInput => {
    // Every dollar in the pool is basis, so nothing is excludable as a QCD and
    // the whole gift reaches section 170. See the doc comment above.
    const physical = donor === 'p1' ? giftCents : 0
    return {
      ownerPersonId: donor, ownerWideNonRothIraPoolId: `pool-${donor}-${TAX_YEAR}`,
      completePoolEvidence: {
        predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear', ownerPersonId: donor,
        ownerWideNonRothIraPoolId: `pool-${donor}-${TAX_YEAR}`, taxYear: TAX_YEAR,
        accountIds: [asAccountId(`ira-${donor}`)],
        yearEndApplicablePoolBalanceAmount: asUsdCents(0), evidenceId: `complete-pool-${donor}`,
      },
      annualBasisRecordEvidenceId: `basis-record-${donor}`, taxYear: TAX_YEAR,
      poolMembers: [{
        sourceAccountId: asAccountId(`ira-${donor}`), ownerPersonId: donor,
        accountType: 'traditional', accountKind: 'ira', inheritanceStatus: 'owned',
        subtype: 'traditional', yearEndApplicableBalanceAmount: asUsdCents(0),
        iraClassificationEvidenceId: `tax-classification-${donor}`,
        accountOwnershipEvidenceId: `tax-ownership-${donor}`,
      }],
      annualFacts: {
        openingBasisAmount: asUsdCents(physical),
        taxYearNondeductibleContributionAmount: asUsdCents(0),
        postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
        yearEndApplicablePoolBalanceAmount: asUsdCents(0), outstandingRolloverAmount: asUsdCents(0),
        rolloverRepaymentAdjustmentAmount: asUsdCents(0), form8606Line7DistributionAmount: asUsdCents(0),
        form8606Line8NetConversionAmount: asUsdCents(0),
      },
      line7Distributions: [], line8Conversions: [],
    }
  })
  const suffix = joint ? 'joint' : 'p1'
  const taxUnit: AnnualQcdStandardSection170pTaxUnitInput = {
    taxUnit: {
      taxUnitId: `tax-unit-${suffix}`,
      taxUnitMemberPersonIds: members.map((member) => asPersonId(member)) as [ReturnType<typeof asPersonId>, ...ReturnType<typeof asPersonId>[]],
      federalFilingStatus: joint ? 'marriedFilingJointly' : 'single',
      stateFilingStatusId: joint ? 'state-joint' : 'state-single',
      taxUnitEvidenceId: `tax-unit-evidence-${suffix}`, taxYear: TAX_YEAR,
    },
    annualTaxLiabilityEvidenceId: `liability-${suffix}`, taxInputSnapshotId: `tax-input-${suffix}`,
    liabilityRun: { liabilityRunKind: 'committedAnnual', candidateFundingVectorEvidenceId: null },
    sourceTaxYears: {
      standardDeduction: TAX_YEAR, priorQualifyingCashContributions: TAX_YEAR, cashPercentageLimit: TAX_YEAR,
    },
    sourceTaxUnitIds: {
      standardDeduction: `tax-unit-${suffix}`, priorQualifyingCashContributions: `tax-unit-${suffix}`,
      cashPercentageLimit: `tax-unit-${suffix}`,
    },
    adjustedGrossIncomeBeforeCharitableDeductionCents: contributionBaseCents,
    unchangedItemizedDeductionCents: 0,
    standardDeductionCents: joint ? 3_220_000 : 1_610_000,
    selectedStandardDeductionEvidenceId: `standard-${suffix}`,
    contributionBaseCents,
    contributionBaseEvidenceId: `contribution-base-${suffix}`,
    priorQualifyingCashContributionUsedCents: 0,
    priorQualifyingCashContributionEvidenceId: `prior-gift-${suffix}`,
    priorCashPercentageLimitUsedCents: 0,
    cashPercentageLimitEvidenceId: `cash-capacity-${suffix}`,
  }
  return stageAnnualQcdStandardSection170pLedger({
    postPassInput: {
      physicalInput: {
        prerequisite, plan: parsed.plan, runtimeEvidence,
        openingBalances: donors.map((donor) => ({
          accountId: asAccountId(`ira-${donor}`),
          openingBalance: asUsdCents(donor === 'p1' ? giftCents : 0),
        })),
        rmdPools,
      },
      poolCapacityInputs,
    },
    taxUnits: [taxUnit],
  })
}

function stagedLedger(giftCents: number, contributionBaseCents: number, joint = false) {
  const result = section170pLedger(giftCents, contributionBaseCents, joint)
  if (result.status !== 'annualQcdStandardSection170pStaged') {
    throw new Error(result.issues[0]?.detail ?? 'ledger did not stage')
  }
  return result.taxUnits[0]!
}

describe('charitable and section 68 rules', () => {
  // IRC 170(p) allows a non-electing individual up to $1,000 ($2,000 joint) of
  // cash gifts to a 170(b)(1)(A) organization. The predecessor figure matters:
  // this subsection carried $300 ($600 joint) for 2021, and Pub. L. 119-21
  // §70424(a) substituted "$1,000 ($2,000" for "$300 ($600" effective for
  // taxable years beginning after 2025. Code or test data ported from the
  // CARES-era rule is wrong by more than a factor of three, so that is the
  // reading this fixture has to be able to see, and it is what the second
  // reading below stands for.
  //
  // The gift is $5,000 against a $100,000 contribution base, so the 60 percent
  // ceiling has $60,000 of capacity and the dollar cap is the only limitation
  // that binds.
  describeRule('irc-170-p-nonitemizer-deduction-dollar-cap', {
    readings: { statuteThousandDollarCap: 100_000, rejectedPreObbbaThreeHundredCap: 30_000 },
    accepted: 'statuteThousandDollarCap',
    note: 'a gift far above the cap, with percentage-ceiling capacity to spare',
  }, ({ accepted, readings }) => {
    const giftCents = 500_000
    const contributionBaseCents = 10_000_000

    it('claims the statutory cap and not the CARES-era figure', () => {
      const ledger = stagedLedger(giftCents, contributionBaseCents)

      expect(ledger.filingTreatment).toBe('standardDeduction')
      expect(ledger.statutoryLimitCents).toBe(accepted)
      expect(ledger.statutoryLimitCents).not.toBe(readings.rejectedPreObbbaThreeHundredCap)
      expect(ledger.annualClaimedDeductionCents).toBe(accepted)
      // The cap binds, not the ceiling: 60% of the contribution base is
      // $60,000 and the gift is $5,000, so capacity is never the constraint.
      expect(ledger.cashPercentageLimitAmountCents).toBe(6_000_000)
      expect(ledger.openingState.cashPercentageLimitCapacityRemainingCents).toBe(6_000_000)
      expect(ledger.finalState.remainingStatutoryLimitCents).toBe(0)
    })

    it('adds the capped amount to the standard deduction rather than replacing it', () => {
      // 63(b) lists the standard deduction and the 170(p) deduction as separate
      // subtractions from AGI, so the ledger reports their sum.
      const ledger = stagedLedger(giftCents, contributionBaseCents)

      expect(ledger.finalTotalDeductionAppliedCents).toBe(1_610_000 + accepted)
    })

    it('doubles the cap on a joint return and only there', () => {
      // 170(p) writes the joint figure as a parenthetical on the same sentence,
      // so it is a per-return cap the spouses share, not a per-person one.
      expect(stagedLedger(giftCents, contributionBaseCents, true).statutoryLimitCents).toBe(200_000)
      expect(stagedLedger(giftCents, contributionBaseCents).statutoryLimitCents).toBe(100_000)
    })

    it('loses the excess over the cap outright, because 170(p) is not a carryover rule', () => {
      // 170(d)(1)(C)(ii) lists the carryover rules and 170(p) is not among
      // them, so with ceiling capacity to spare the unclaimed $4,000 is gone.
      const action = stagedLedger(giftCents, contributionBaseCents).orderedActionEvidence[0]!

      expect(action.eligibleContributionCents).toBe(giftCents)
      expect(action.claimedByActionCents).toBe(accepted)
      expect(action.limitationCarryforwardCents).toBe(0)
      expect(action.unclaimedWithoutCarryforwardCents).toBe(giftCents - accepted)
    })
  })

  // IRC 170(b)(1)(I) allows a contribution only above 0.5 percent of the
  // contribution base, which 170(b)(1)(H) defines as AGI. `itemizedTotal`
  // (federalTax.ts:111-119) subtracts no floor and has no contribution-base
  // concept at all.
  //
  // $200,000 of AGI puts the floor at $1,000, so of a $20,000 gift the statute
  // allows $19,000. With $30,000 of SALT (under the $40,400 2026 cap) the
  // statutory itemized total is $49,000 and the engine's is $50,000; both beat
  // the $16,100 standard deduction, so the election is not what separates them.
  // The 60 percent ceiling is $120,000 here and never binds, which keeps this
  // fixture on the floor alone.
  describeRule('irc-170-b-1-I-projection-floor-not-applied', {
    readings: { statute: 49_000, engineSubtractsNoFloor: 50_000 },
    accepted: 'statute',
    produced: 'engineSubtractsNoFloor',
    note: 'a $20,000 gift against $200,000 of AGI, well inside the percentage ceiling',
  }, ({ accepted, produced }) => {
    const agi = 200_000
    const gift = 20_000
    const salt = 30_000
    // 0.5 percent as an exact integer ratio. Writing it as 0.005 * agi makes the
    // expected value a float intermediate, and every assertion below is a toBe
    // against an exact integer.
    const floorFor = (base: number): number => (base * 5) / 1_000
    const allowedAfterFloor = gift - floorFor(agi)

    it('deducts the whole gift with no floor subtracted', () => {
      const detail = computeFederalTax(taxpayer(agi, {
        stateAndLocalTaxes: salt, mortgageInterest: 0, charitable: gift,
      }))

      expect(allowedAfterFloor).toBe(19_000)
      expect(detail.agi).toBe(agi)
      expect(detail.itemized).toBe(true)
      expect(detail.deduction).toBe(produced)
      expect(detail.deduction).not.toBe(accepted)
      // The overstatement is the lesser of the gift and the floor. This gift is
      // twenty times the floor, so here the lesser is the floor itself; a gift
      // at or below $1,000 would be disallowed in full and the overstatement
      // would be the whole gift instead.
      expect(detail.deduction - accepted).toBe(floorFor(agi))
    })

    it('understates tax against the return that applies the floor', () => {
      // The statutory reading is the same engine call with the post-floor
      // amount on the charitable line, so both sides are real engine output.
      const engine = computeFederalTax(taxpayer(agi, {
        stateAndLocalTaxes: salt, mortgageInterest: 0, charitable: gift,
      }))
      const statutory = computeFederalTax(taxpayer(agi, {
        stateAndLocalTaxes: salt, mortgageInterest: 0, charitable: allowedAfterFloor,
      }))

      expect(statutory.deduction).toBe(accepted)
      expect(engine.taxableIncome).toBe(150_000)
      expect(statutory.taxableIncome).toBe(151_000)
      // errorDirection: 'understatesTax'.
      expect(engine.totalTax).toBeLessThan(statutory.totalTax)
    })

    it('scales the error with AGI, because the floor is a fraction of it', () => {
      // Doubling AGI doubles the disallowance the engine skips, so this is not
      // a fixed-size gap that could be waved through as immaterial.
      const richer = computeFederalTax(taxpayer(2 * agi, {
        stateAndLocalTaxes: salt, mortgageInterest: 0, charitable: gift,
      }))
      const richerStatutory = computeFederalTax(taxpayer(2 * agi, {
        stateAndLocalTaxes: salt, mortgageInterest: 0, charitable: gift - 2 * floorFor(agi),
      }))

      expect(richer.deduction - richerStatutory.deduction).toBe(2_000)
    })
  })

  // IRC 170(b)(1)(G)(i) caps cash gifts to public charities at 60 percent of
  // the contribution base and (G)(ii) carries the excess forward five years.
  // The engine deducts the whole gift at once and holds no carryforward state.
  //
  // $100,000 of AGI puts the ceiling at $60,000, so an $80,000 gift leaves
  // $20,000 to carry. With $10,000 of SALT the ceiling-respecting itemized
  // total is $70,000 and the engine's is $90,000. The 0.5 percent floor would
  // take a further $500 from the statutory figure; that gap is pinned
  // separately at irc-170-b-1-I-projection-floor-not-applied, and the readings
  // here isolate the ceiling.
  describeRule('irc-170-b-1-G-projection-cash-ceiling-not-applied', {
    readings: { ceilingApplied: 70_000, engineAllowsTheWholeGift: 90_000 },
    accepted: 'ceilingApplied',
    produced: 'engineAllowsTheWholeGift',
    note: 'an $80,000 gift against a $100,000 contribution base',
  }, ({ accepted, produced }) => {
    const agi = 100_000
    const gift = 80_000
    const salt = 10_000
    // 60 percent as an exact ratio, for the same reason as the floor above.
    const ceiling = (agi * 6) / 10
    const carriedForward = gift - ceiling

    it('deducts a gift above the ceiling in full in the year it is made', () => {
      const detail = computeFederalTax(taxpayer(agi, {
        stateAndLocalTaxes: salt, mortgageInterest: 0, charitable: gift,
      }))

      expect(ceiling).toBe(60_000)
      expect(detail.itemized).toBe(true)
      expect(detail.deduction).toBe(produced)
      expect(detail.deduction).not.toBe(accepted)
      expect(detail.deduction - accepted).toBe(carriedForward)
    })

    it('understates tax in the gift year', () => {
      const engine = computeFederalTax(taxpayer(agi, {
        stateAndLocalTaxes: salt, mortgageInterest: 0, charitable: gift,
      }))
      const statutory = computeFederalTax(taxpayer(agi, {
        stateAndLocalTaxes: salt, mortgageInterest: 0, charitable: ceiling,
      }))

      expect(statutory.deduction).toBe(accepted)
      expect(engine.taxableIncome).toBe(10_000)
      expect(statutory.taxableIncome).toBe(30_000)
      expect(engine.totalTax).toBeLessThan(statutory.totalTax)
    })

    it('overstates tax in the following year, which is why the direction is bothDirections', () => {
      // Same household, next year, no new gift. The statute deducts the
      // $20,000 carried forward and the engine deducts nothing, so the sign
      // flips. errorDirection: 'bothDirections' — and it does not net to zero,
      // because a carryforward the household never has income to absorb simply
      // expires after five years and the year-one generosity becomes permanent.
      const engineNextYear = computeFederalTax(taxpayer(agi, {
        stateAndLocalTaxes: salt, mortgageInterest: 0, charitable: 0,
      }))
      const statutoryNextYear = computeFederalTax(taxpayer(agi, {
        stateAndLocalTaxes: salt, mortgageInterest: 0, charitable: carriedForward,
      }))

      expect(engineNextYear.itemized).toBe(false)
      expect(engineNextYear.deduction).toBe(16_100)
      expect(statutoryNextYear.deduction).toBe(salt + carriedForward)
      expect(engineNextYear.totalTax).toBeGreaterThan(statutoryNextYear.totalTax)
    })

    it('has nowhere to put a carryforward, however it is supplied', () => {
      // The missing half of this rule is a fact the input model cannot carry.
      // Offering it under the names a fix would give it must change nothing
      // until someone actually reads one of them.
      const supplied = computeFederalTax(taxpayer(agi, withExtraFacts({
        stateAndLocalTaxes: salt, mortgageInterest: 0, charitable: 0,
      }, {
        charitableCarryforward: carriedForward,
        charitableCarryover: carriedForward,
        priorYearCharitableCarryforward: carriedForward,
        contributionCarryforward: carriedForward,
      })))

      expect(supplied.deduction).toBe(16_100)
      expect(supplied.itemized).toBe(false)
    })
  })

  // IRC 68(a) reduces itemized deductions by 2/37 of the lesser of those
  // deductions or the excess of taxable income (computed without regard to
  // section 68 and increased by those deductions) over the 37 percent bracket
  // start, and 68(b) applies it after every other limitation. `computeFederalTax`
  // takes `Math.max(standardBase, itemized)` and never reduces it.
  //
  // A single filer with $800,000 of AGI and $37,000 of SALT is chosen so the
  // arithmetic is exact rather than repeating: taxable income increased by the
  // itemized deductions is the AGI itself, $800,000, which exceeds the 2026
  // single threshold of $640,600 by $159,400. The lesser of that and the
  // $37,000 of deductions is $37,000, and 2/37 of $37,000 is exactly $2,000.
  describeRule('irc-68-projection-overall-limitation-not-applied', {
    readings: { statute: 35_000, engineAppliesNoOverallLimitation: 37_000 },
    accepted: 'statute',
    produced: 'engineAppliesNoOverallLimitation',
    note: 'a single filer $159,400 past the 37 percent bracket start',
  }, ({ accepted, produced }) => {
    const agi = 800_000
    const salt = 37_000
    const bracketStart = 640_600
    // 68(a) reduces by 2/37 of the lesser figure. Multiply first, divide last:
    // 2/37 is not representable, so computing it before the multiplication
    // leaves an intermediate that only happens to land on an integer.
    const reduction = (2 * Math.min(salt, agi - bracketStart)) / 37

    it('keeps every dollar of itemized deduction section 68 would take away', () => {
      const detail = computeFederalTax(taxpayer(agi, {
        stateAndLocalTaxes: salt, mortgageInterest: 0, charitable: 0,
      }))

      expect(reduction).toBe(2_000)
      expect(detail.itemized).toBe(true)
      expect(detail.deduction).toBe(produced)
      expect(detail.deduction).not.toBe(accepted)
      expect(detail.deduction - accepted).toBe(reduction)
    })

    it('understates tax against the return that applies the limitation', () => {
      const engine = computeFederalTax(taxpayer(agi, {
        stateAndLocalTaxes: salt, mortgageInterest: 0, charitable: 0,
      }))
      const statutory = computeFederalTax(taxpayer(agi, {
        stateAndLocalTaxes: salt - reduction, mortgageInterest: 0, charitable: 0,
      }))

      expect(statutory.deduction).toBe(accepted)
      expect(engine.taxableIncome).toBe(763_000)
      expect(statutory.taxableIncome).toBe(765_000)
      // errorDirection: 'understatesTax'. Nothing carries forward under section
      // 68, so no later year returns the disallowed deduction.
      expect(engine.totalTax).toBeLessThan(statutory.totalTax)
    })

    it('leaves a household below the bracket threshold untouched', () => {
      // The record claims the gap is confined to high income, and this is what
      // confines it: at $200,000 of AGI the (a)(2) excess is zero, so the
      // statutory and engine readings coincide and there is nothing to pin.
      const detail = computeFederalTax(taxpayer(200_000, {
        stateAndLocalTaxes: salt, mortgageInterest: 0, charitable: 0,
      }))

      expect(200_000).toBeLessThan(bracketStart)
      expect(detail.deduction).toBe(produced)
    })
  })

  // IRC 63(b) subtracts BOTH the standard deduction and the section 170(p)
  // deduction from AGI for a non-electing individual, so the nonitemizer
  // charitable allowance rides on top of the standard deduction. The engine
  // uses the charitable figure only inside `itemizedTotal` and then discards
  // that total whenever the standard deduction wins.
  //
  // $100,000 of AGI with $5,000 of SALT and a $3,000 cash gift gives an
  // itemized total of $8,000, well under the $16,100 standard deduction, so the
  // household does not itemize. The statute gives it $16,100 + $1,000 = $17,100.
  describeRule('irc-170-p-projection-nonitemizer-deduction-not-allowed', {
    readings: { statute: 17_100, engineAllowsNothingOffTheStandardDeduction: 16_100 },
    accepted: 'statute',
    produced: 'engineAllowsNothingOffTheStandardDeduction',
    note: 'a $3,000 cash gift by a household that takes the standard deduction',
  }, ({ accepted, produced }) => {
    const agi = 100_000
    const gift = 3_000
    const salt = 5_000
    const nonitemizerCap = 1_000
    const items = { stateAndLocalTaxes: salt, mortgageInterest: 0, charitable: gift }

    it('deducts nothing at all for a gift made in a standard-deduction year', () => {
      const detail = computeFederalTax(taxpayer(agi, items))

      expect(detail.itemized).toBe(false)
      expect(detail.deduction).toBe(produced)
      expect(detail.deduction).not.toBe(accepted)
      expect(accepted - produced).toBe(nonitemizerCap)
    })

    it('returns the same deduction whether the household gave or not', () => {
      // The sharpest form of the claim: on the standard-deduction branch the
      // charitable input is inert, so a $3,000 gift and no gift at all produce
      // an identical return.
      const gave = computeFederalTax(taxpayer(agi, items))
      const gaveNothing = computeFederalTax(taxpayer(agi, { ...items, charitable: 0 }))

      expect(gave.deduction).toBe(gaveNothing.deduction)
      expect(gave.totalTax).toBe(gaveNothing.totalTax)
    })

    it('ignores the gift however it is labelled as a nonitemizer amount', () => {
      // A fix would most likely arrive as a new field rather than a change to
      // the meaning of `charitable`, so the plausible names are fed here too.
      const supplied = computeFederalTax(taxpayer(agi, withExtraFacts(items, {
        nonitemizerCharitable: gift,
        cashCharitable: gift,
        charitableCashToPublicCharity: gift,
        section170pCharitable: gift,
      })))

      expect(supplied.deduction).toBe(produced)
    })

    it('overstates tax, by the allowance it never grants', () => {
      // The engine cannot be made to return a $17,100 deduction, so the
      // comparison runs on taxable income instead: a household with $1,000 less
      // AGI reaches the taxable income the statute would have given this one,
      // and its tax is the tax this household should have paid.
      const engine = computeFederalTax(taxpayer(agi, items))
      const statutoryEquivalent = computeFederalTax(taxpayer(agi - nonitemizerCap, items))

      expect(engine.taxableIncome).toBe(agi - produced)
      expect(statutoryEquivalent.taxableIncome).toBe(agi - accepted)
      // errorDirection: 'overstatesTax'.
      expect(engine.totalTax).toBeGreaterThan(statutoryEquivalent.totalTax)
    })

    it('withholds twice as much from a joint return, where the cap is $2,000', () => {
      const joint = computeFederalTax(taxpayer(agi, items, 'marriedFilingJointly'))
      const jointEquivalent = computeFederalTax(taxpayer(agi - 2_000, items, 'marriedFilingJointly'))

      expect(joint.itemized).toBe(false)
      expect(joint.deduction).toBe(32_200)
      expect(joint.taxableIncome - jointEquivalent.taxableIncome).toBe(2_000)
      expect(joint.totalTax).toBeGreaterThan(jointEquivalent.totalTax)
    })
  })
})
