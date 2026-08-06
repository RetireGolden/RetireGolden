import { describe, expect, it } from 'vitest'

import { parseRetirementActionRequest } from '../actions/index.js'
import type { Account, Plan } from '../model/plan.js'
import {
  recurringOrdinaryIncome,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { ProjectionResult, YearResult } from './types.js'

/**
 * The linked-funding group, end to end through a real projection.
 *
 * What the executor's own tests cannot settle is whether the two liabilities
 * are real: they supply a baseline and a candidate and check the arithmetic
 * between them. Here both come from the annual pass — `T0` from a
 * counterfactual run with the group's two legs removed, `T1(F)` from the run
 * that commits — and every figure below is asserted exactly rather than
 * approximately, because a flat tax calculator makes them arithmetic rather
 * than a snapshot.
 *
 * Two shapes are pinned, and the difference between them is the point.
 *
 * In a plan with no aggregate conversion strategy, removing a refused group
 * changes nothing, so `T0` and `T1` are equal to the cent. That is not a
 * degenerate case to be embarrassed about — it is the strongest available
 * statement that the group evaluation did not perturb the year it evaluated,
 * and it is only true because both legs refuse.
 *
 * In a plan that *does* carry an aggregate conversion strategy, the named
 * conversion's mere presence stands that strategy down for the year. Removing
 * the named request therefore lets the aggregate one convert, and `T0` comes
 * back strictly higher than `T1`. Two genuinely different liabilities, from two
 * genuinely different runs, with the requirement floored at zero because the
 * group lowered the bill rather than raising it.
 *
 * Neither shape moves a dollar, and the last test says so in the way that will
 * still be checkable when one of them does.
 */

const START_YEAR = 2026
const END_YEAR = 2028
const ACTION_YEAR = 2026
const FLAT_RATE_PCT = 22
const CONVERSION_ACTION_ID = 'linked-conversion'
const WITHDRAWAL_ACTION_ID = 'linked-funding-withdrawal'
const SECOND_CONVERSION_ACTION_ID = 'linked-conversion-b'
const CONVERSION_CENTS = 40_000_00
const WITHDRAWAL_CENTS = 8_000_00

function cash(): Account {
  return {
    type: 'cash',
    id: 'cash-a',
    name: 'cash-a',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance: 1_000_000,
    annualContribution: 0,
  }
}

function traditionalIra(): Account {
  return {
    type: 'traditional',
    id: 'ira-a',
    name: 'ira-a',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: 400_000,
    annualContribution: 0,
    // A nondeductible basis is what makes the owned-IRA annual settlement run,
    // so the committed pass really is the bounded attempt driver's — which is
    // where the counterfactual is launched from, sharing its assumption vector.
    nondeductibleBasis: 20_000,
  }
}

function rothIra(): Account {
  return {
    type: 'roth',
    id: 'roth-a',
    name: 'roth-a',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: 0,
    annualContribution: 0,
  }
}

function request(input: Record<string, unknown>) {
  const parsed = parseRetirementActionRequest(input)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function fundingWithdrawal(actionId: string, referenceId: string, sequence: number) {
  return request({
    actionId,
    kind: 'ordinaryWithdrawal',
    personId: 'p1',
    year: ACTION_YEAR,
    executionDate: `${ACTION_YEAR}-06-14`,
    executionSequence: sequence,
    requestedAmount: WITHDRAWAL_CENTS,
    allocations: [{
      allocationId: `${actionId}-allocation`,
      sourceAccountId: 'cash-a',
      requestedAmount: WITHDRAWAL_CENTS,
    }],
    purpose: { kind: 'taxPayment', referenceId },
    provenance: { source: 'manual' },
  })
}

function linkedConversion(
  actionId: string,
  withdrawalActionId: string,
  sequence: number,
) {
  return request({
    actionId,
    kind: 'rothConversion',
    personId: 'p1',
    year: ACTION_YEAR,
    executionDate: `${ACTION_YEAR}-06-15`,
    executionSequence: sequence,
    requestedAmount: CONVERSION_CENTS,
    allocations: [{
      allocationId: `${actionId}-allocation`,
      sourceAccountId: 'ira-a',
      requestedAmount: CONVERSION_CENTS,
    }],
    destinationRothAccountId: 'roth-a',
    taxFunding: { kind: 'linkedWithdrawal', withdrawalActionId },
    provenance: { source: 'manual' },
  })
}

/** Present in every plan below, so the ordinary executor always runs. */
function unrelatedWithdrawal() {
  return request({
    actionId: 'unrelated-withdrawal',
    kind: 'ordinaryWithdrawal',
    personId: 'p1',
    year: ACTION_YEAR,
    executionDate: `${ACTION_YEAR}-03-01`,
    executionSequence: 9,
    requestedAmount: 1_000_00,
    allocations: [{
      allocationId: 'unrelated-withdrawal-allocation',
      sourceAccountId: 'cash-a',
      requestedAmount: 1_000_00,
    }],
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  })
}

function basePlan(): Plan {
  const base = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  base.id = 'linked-funding-group-execution'
  base.accounts = [cash(), traditionalIra(), rothIra()]
  base.incomes = [recurringOrdinaryIncome('pension', 90_000)]
  base.expenses.baseAnnual = 50_000
  base.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'ira-a-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'ira-a',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  base.strategies.retirementActions = [unrelatedWithdrawal()]
  return base
}

function linkedPlan(): Plan {
  const base = basePlan()
  base.strategies.retirementActions = [
    fundingWithdrawal(WITHDRAWAL_ACTION_ID, CONVERSION_ACTION_ID, 1),
    linkedConversion(CONVERSION_ACTION_ID, WITHDRAWAL_ACTION_ID, 2),
    unrelatedWithdrawal(),
  ]
  return validatePlan(base)
}

/** The same year with the group's two legs simply absent. */
function withoutGroupPlan(): Plan {
  return validatePlan(basePlan())
}

/**
 * The linked group beside an aggregate conversion strategy the named request
 * stands down.
 *
 * This is what makes `T0` and `T1` genuinely different figures while every
 * group still refuses: the counterfactual removes the named conversion, the
 * aggregate strategy is no longer suppressed, and the baseline year converts
 * and pays tax the committed year does not.
 */
function linkedPlanWithAggregateStrategy(): Plan {
  const base = basePlan()
  base.strategies.retirementActions = [
    fundingWithdrawal(WITHDRAWAL_ACTION_ID, CONVERSION_ACTION_ID, 1),
    linkedConversion(CONVERSION_ACTION_ID, WITHDRAWAL_ACTION_ID, 2),
    unrelatedWithdrawal(),
  ]
  base.strategies.rothConversion = {
    mode: 'manual',
    conversions: [{ year: ACTION_YEAR, amount: 25_000 }],
  }
  return validatePlan(base)
}

/**
 * Two conversions naming one withdrawal: the contested set.
 *
 * Deliberately not run through `validatePlan`, and it could not be. The Plan
 * schema requires each linked conversion's withdrawal to point back at it, and
 * `purpose.referenceId` is single-valued, so at most one contestant can satisfy
 * it — a contested set is unbuildable through validation by construction. That
 * is exactly the shape this pins: a Plan that reached the simulator without
 * validation should refuse inside it rather than abort the projection.
 */
function contestedPlan(): Plan {
  const base = basePlan()
  base.strategies.retirementActions = [
    fundingWithdrawal(WITHDRAWAL_ACTION_ID, CONVERSION_ACTION_ID, 1),
    linkedConversion(CONVERSION_ACTION_ID, WITHDRAWAL_ACTION_ID, 2),
    linkedConversion(SECOND_CONVERSION_ACTION_ID, WITHDRAWAL_ACTION_ID, 3),
    unrelatedWithdrawal(),
  ]
  return base
}

function project(target: Plan): ProjectionResult {
  return simulatePlan(target, {
    startYear: START_YEAR,
    horizonEndYear: END_YEAR,
    taxCalculator: createFlatTaxCalculator(FLAT_RATE_PCT),
  })
}

function actionYear(result: ProjectionResult): YearResult {
  const year = result.years.find((entry) => entry.year === ACTION_YEAR)
  if (year === undefined) throw new Error('the action year is missing')
  return year
}

function groupExecution(year: YearResult) {
  const execution = year.conversionLinkedWithdrawalGroupExecution
  if (execution === undefined) {
    throw new Error('the year published no linked-funding group execution')
  }
  return execution
}

function evaluatedFunding(year: YearResult) {
  const funding = groupExecution(year).funding
  if (funding.status !== 'annualGroupEvaluated') {
    throw new Error(`funding not evaluated: ${funding.reason}`)
  }
  return funding
}

function publishedRecord(year: YearResult, actionId: string) {
  const record = year.retirementActionPublication?.records
    .find((entry) => entry.actionId === actionId)
  if (record === undefined) throw new Error(`no published record for ${actionId}`)
  return record
}

/** The plan-dollar liability an exact-cent amount stands for. */
function liabilityPlanDollars(amount: {
  numeratorMinorUnits: number
  denominator: number
}): number {
  return amount.numeratorMinorUnits / amount.denominator / 100
}

describe('the conversion-linked withdrawal group, executed in a real projection', () => {
  describe('a refused group whose removal changes nothing', () => {
    const withGroup = actionYear(project(linkedPlan()))
    const withoutGroup = actionYear(project(withoutGroupPlan()))
    const funding = evaluatedFunding(withGroup)
    const evidence = funding.members[0]!

    it('reads T0 and T1 off two real annual passes, exactly', () => {
      // Both legs refuse, so the year with the group and the year without it
      // are the same year. `T1` is therefore the committed run's own
      // tax-and-penalty total, and `T0` is that same total recomputed with both
      // legs removed — equal to the cent, which is what "the group cost the
      // filing unit nothing" means when the group did nothing.
      expect(liabilityPlanDollars(evidence.candidateAnnualTaxLiability))
        .toBeCloseTo(withGroup.tax + withGroup.penalties, 6)
      expect(evidence.baselineAnnualTaxLiability)
        .toEqual(evidence.candidateAnnualTaxLiability)
      expect(liabilityPlanDollars(evidence.baselineAnnualTaxLiability))
        .toBeCloseTo(withoutGroup.tax + withoutGroup.penalties, 6)

      // And so the requirement, the allocation, and the funding are all zero —
      // a fixed point that is true and says exactly as much as it should.
      expect(evidence).toMatchObject({
        evaluation: 'satisfied',
        fundingEquality: 'exactCentQuantized',
        annualGroupRequiredFundingAmount: 0,
        annualGroupFundedAmount: 0,
        requiredFundingAmount: 0,
        fundedAmount: 0,
        fundedAmountDifference: 0,
        annualGroupFundedAmountDifference: 0,
        allocationOrder: 1,
        // A refused conversion converted nothing, so it has no taxable
        // principal to be weighted by. That is why the allocation above is
        // vacuous today and why it starts to bite the moment one commits.
        allocationWeight: 0,
      })
      expect(evidence.unquantizedAnnualGroupRequiredFundingAmount)
        .toEqual({
          representation: 'exactRationalMinorUnits',
          numeratorMinorUnits: 0,
          denominator: 1,
          intermediateArithmetic: 'bigintRational',
        })
    })

    it('binds the pair to two distinct runs over two distinct input sets', () => {
      expect(funding.baselineRun.liabilityRun.liabilityRunKind).toBe('baselineT0')
      expect(funding.candidateRun.liabilityRun.liabilityRunKind).toBe('candidateT1')
      // Distinct evidence IDs, because the run kind is part of what an evidence
      // ID names — this would hold even if both runs had been handed identical
      // inputs.
      expect(funding.baselineRun.annualTaxLiabilityEvidenceId)
        .not.toBe(funding.candidateRun.annualTaxLiabilityEvidenceId)
      // Distinct snapshot IDs, which is the stronger claim and the one the
      // minter's asymmetry makes checkable: the snapshot names the inputs and
      // only the inputs, so two runs share it exactly when they were handed the
      // same figures. The baseline removed two requests and said so, so it did
      // not. A counterfactual that failed to remove anything would show up
      // here as a shared snapshot rather than as a caller's assurance.
      expect(funding.taxInputSnapshotsShared).toBe(false)
      expect(funding.baselineRun.taxInputSnapshotId)
        .not.toBe(funding.candidateRun.taxInputSnapshotId)
      expect(
        funding.baselineRun.orderedTaxInputs.find((input) =>
          input.inputId === 'counterfactualOmittedRetirementActionIds')?.value,
      ).toEqual({
        representation: 'declaredTerm',
        term: JSON.stringify([CONVERSION_ACTION_ID, WITHDRAWAL_ACTION_ID].sort()),
      })
      // Both runs answer for the same filing unit and year, which is the whole
      // reason their difference is a liability rather than a coincidence.
      expect(funding.baselineRun.taxUnitId).toBe(funding.taxUnit.taxUnitId)
      expect(funding.candidateRun.taxUnitId).toBe(funding.taxUnit.taxUnitId)
      expect(funding.taxUnit).toMatchObject({
        taxYear: ACTION_YEAR,
        federalFilingStatus: 'single',
        taxUnitMemberPersonIds: ['p1'],
      })
    })

    it('publishes the ordering the group would have occupied', () => {
      const execution = groupExecution(withGroup)

      expect(execution.ordering?.orderingSource)
        .toBe('mergedRetirementActionSchedule')
      expect(execution.ordering?.positions.map((position) => ({
        actionId: position.actionId,
        order: position.order,
        effectiveDate: position.effectiveDate,
      }))).toEqual([
        {
          actionId: WITHDRAWAL_ACTION_ID,
          order: 1,
          effectiveDate: `${ACTION_YEAR}-06-14`,
        },
        {
          actionId: CONVERSION_ACTION_ID,
          order: 2,
          effectiveDate: `${ACTION_YEAR}-06-15`,
        },
      ])
      expect(execution.groups[0]).toMatchObject({
        conversionActionId: CONVERSION_ACTION_ID,
        withdrawalActionId: WITHDRAWAL_ACTION_ID,
        refusalKind: 'pendingGroupExecution',
        reasonCode: 'conversion-tax-funding-unallocated',
        orderingComplete: true,
        movement: 'none',
      })
    })

    it('carries the funding evidence onto the published conversion record', () => {
      // Funding evidence used to be verified by the publication and then
      // dropped. This is the assertion that it now survives onto the record a
      // consumer actually reads.
      const conversionRecord = publishedRecord(withGroup, CONVERSION_ACTION_ID)
      const withdrawalRecord = publishedRecord(withGroup, WITHDRAWAL_ACTION_ID)

      expect(conversionRecord.conversionTaxFunding).toEqual(evidence)
      // The withdrawal leg carries no evaluation of its own: the evaluation is
      // the conversion's share of the filing unit's liability, and a withdrawal
      // has no share.
      expect(withdrawalRecord.conversionTaxFunding).toBeUndefined()
      expect('conversionTaxFunding' in withdrawalRecord).toBe(false)
    })

    it('leaves the committed year exactly as it would have been', () => {
      // The group evaluation runs a whole extra annual pass and rolls it back.
      // If any of it leaked, this is where it would show: the year with a
      // refused group and the year without one describe the same economics to
      // the cent, including both runtime journals.
      expect(withGroup.tax).toBe(withoutGroup.tax)
      expect(withGroup.penalties).toBe(withoutGroup.penalties)
      expect(withGroup.balances).toEqual(withoutGroup.balances)
      expect(withGroup.netWorth).toBe(withoutGroup.netWorth)
      expect(withGroup.withdrawals.total).toBe(withoutGroup.withdrawals.total)
      expect(JSON.stringify(withGroup.retirementRuntimeSource))
        .toBe(JSON.stringify(withoutGroup.retirementRuntimeSource))
      expect(JSON.stringify(withGroup.retirementRuntimeApplicationSource))
        .toBe(JSON.stringify(withoutGroup.retirementRuntimeApplicationSource))
    })
  })

  describe('a refused group whose removal does change the year', () => {
    const year = actionYear(project(linkedPlanWithAggregateStrategy()))
    const funding = evaluatedFunding(year)
    const evidence = funding.members[0]!

    it('reads a baseline strictly above the candidate, and floors at zero', () => {
      const baseline = liabilityPlanDollars(evidence.baselineAnnualTaxLiability)
      const candidate = liabilityPlanDollars(evidence.candidateAnnualTaxLiability)

      // The candidate is the committed year: the named conversion refused, and
      // its presence stood the aggregate strategy down, so nothing converted.
      expect(candidate).toBeCloseTo(year.tax + year.penalties, 6)
      expect(year.rothConversion).toBeCloseTo(0, 6)
      // The baseline removed the named request, which released the aggregate
      // strategy to convert 25,000 — of which the includible part is the
      // Form 8606 pro-rata share: the IRA's 20,000 nondeductible basis against
      // its 400,000 balance leaves 95 percent taxable, or 23,750, at the flat
      // 22 percent. Two different liabilities, from two different runs of the
      // same year, and the figure is spelled out rather than snapshotted so
      // that a change to either run has to explain itself here.
      const aggregateConversion = 25_000
      const includibleFraction = 1 - 20_000 / 400_000
      expect(baseline - candidate).toBeCloseTo(
        aggregateConversion * includibleFraction * (FLAT_RATE_PCT / 100),
        6,
      )
      expect(baseline - candidate).toBeCloseTo(5_225, 6)
      expect(baseline).toBeGreaterThan(candidate)

      // `max(0, T1 - T0)` is a floor, not an absolute difference. A group whose
      // presence lowered the filing unit's bill owes nothing, and a negative
      // requirement is not a thing a household can be asked to fund.
      expect(evidence.unquantizedAnnualGroupRequiredFundingAmount.numeratorMinorUnits)
        .toBe(0)
      expect(evidence.annualGroupRequiredFundingAmount).toBe(0)
      expect(evidence).toMatchObject({
        evaluation: 'satisfied',
        requiredFundingAmount: 0,
        fundedAmount: 0,
      })
    })
  })

  describe('the tie-break, in a real projection', () => {
    const year = actionYear(project(contestedPlan()))

    it('refuses every contesting pair and the withdrawal they share', () => {
      const execution = groupExecution(year)

      expect(execution.groups.map((group) => ({
        conversionActionId: group.conversionActionId,
        refusalKind: group.refusalKind,
        reasonCode: group.reasonCode,
        contested: group.withdrawalActionId,
      }))).toEqual([
        {
          conversionActionId: CONVERSION_ACTION_ID,
          refusalKind: 'sharedFundingWithdrawal',
          reasonCode: 'conversion-tax-funding-unallocated',
          contested: WITHDRAWAL_ACTION_ID,
        },
        {
          conversionActionId: SECOND_CONVERSION_ACTION_ID,
          refusalKind: 'sharedFundingWithdrawal',
          reasonCode: 'conversion-tax-funding-unallocated',
          contested: WITHDRAWAL_ACTION_ID,
        },
      ])

      // Published, not thrown. This shape used to abort the whole projection at
      // publication: `assertLinkedWithdrawalRequests` refused a withdrawal named
      // by two conversions with an exception, so a malformed plan crashed the
      // simulator rather than refusing inside it.
      for (const actionId of [
        CONVERSION_ACTION_ID,
        SECOND_CONVERSION_ACTION_ID,
        WITHDRAWAL_ACTION_ID,
      ]) {
        expect(publishedRecord(year, actionId).executedAmount).toBe(0)
      }
      expect(publishedRecord(year, WITHDRAWAL_ACTION_ID).reasons
        .map((reason) => reason.code))
        .toContain('conversion-tax-funding-unallocated')
    })

    it('evaluates both contesting conversions against one annual liability', () => {
      const funding = evaluatedFunding(year)

      // The filing unit owed whatever it owed regardless of how badly the
      // funding was formed, so both members carry the group's own figures and
      // the allocation covers both — a contest is not a reason to stop
      // measuring.
      expect(funding.members.map((member) => member.conversionActionId))
        .toEqual([CONVERSION_ACTION_ID, SECOND_CONVERSION_ACTION_ID])
      expect(new Set(funding.members.map((member) =>
        member.annualGroupRequiredFundingAmount))).toHaveLength(1)
      expect(funding.members.map((member) => member.allocationOrder))
        .toEqual([1, 2])
      for (const member of funding.members) {
        expect(publishedRecord(year, member.conversionActionId)
          .conversionTaxFunding).toEqual(member)
      }
    })
  })

  describe('the atomicity assertion this slice leaves unreachable', () => {
    it('cannot fire, because neither leg of any group moves', () => {
      // `assertLinkedWithdrawalRecordAtomicity` throws unless a conversion and
      // its funding withdrawal agree about whether they moved. It has never
      // fired and cannot while every group refuses: both legs report a zero
      // executed amount, so both sides of its comparison are false and they
      // agree.
      //
      // Pinned rather than assumed, because the slice that opens the gate makes
      // it a live crash surface for every partial and insufficient case. What
      // this asserts is the premise that keeps it dormant — not that the check
      // is absent, but that nothing yet reaches it with a disagreement.
      for (const target of [
        linkedPlan(),
        linkedPlanWithAggregateStrategy(),
        contestedPlan(),
      ]) {
        const year = actionYear(project(target))
        const execution = groupExecution(year)

        for (const group of execution.groups) {
          const conversion = publishedRecord(year, group.conversionActionId)
          const withdrawal = publishedRecord(year, group.withdrawalActionId)

          expect(conversion.executedAmount).toBe(0)
          expect(withdrawal.executedAmount).toBe(0)
          expect(conversion.executedAmount > 0)
            .toBe(withdrawal.executedAmount > 0)
          expect(group.movement).toBe('none')
        }
        // And the executor itself has no arm that could disagree with them.
        const status: 'refused' = execution.status
        expect(status).toBe('refused')
      }
    })
  })
})
