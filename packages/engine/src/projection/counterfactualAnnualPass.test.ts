import { describe, expect, it, vi } from 'vitest'

import type { ProjectionResult, YearResult } from './types.js'
import type {
  SimulatorAnnualPassStateBindings,
} from './annualPassTransaction.js'
import type {
  CounterfactualAnnualLiabilityRead,
  CounterfactualAnnualLiabilityResult,
} from '../internal/counterfactualAnnualLiability.js'

/**
 * The counterfactual annual pass, against the real annual pass.
 *
 * Three invariants are the whole of this file, and each is a claim that only a
 * real multi-year projection can settle.
 *
 * 1. **Empty-omission identity.** A pre-pass that omits nothing, followed by its
 *    rollback and then the run that commits, produces a projection byte for byte
 *    identical to one that never pre-passed — including both runtime journals,
 *    every occurrence key, and the mutation-ordinal contiguity that a leaked
 *    mint would break. This is the single best evidence that the two runs differ
 *    only in what they are meant to differ in, because it is asserted over
 *    serialized state rather than over spot figures.
 * 2. **Restoration.** After the pre-pass rolls back, the whole checkpoint
 *    binding state is byte-equal to what it was before the pre-pass opened. The
 *    stakes are why this is pinned on the state itself: the occurrence recorder
 *    is a bare push with no dedupe, and a leaked occurrence does not crash — it
 *    fails an ordinal-contiguity or coverage check, disqualifies the owner, and
 *    drops the year silently to legacy pro-rata economics.
 * 3. **Omission honesty.** Naming a committed conversion in the omission set
 *    actually removes its movement and its income from the counterfactual run,
 *    and the run that commits afterwards is untouched by the omission.
 *
 * The observations come from a mock that delegates to the real driver and only
 * watches: it reads the checkpoint bindings on either side of the call and keeps
 * the counterfactual year the pass produced, which the driver itself discards
 * because a caller has no business with a year that was rolled back.
 */

interface Observation {
  readonly taxYear: number
  readonly stateBytesBefore: string
  readonly stateBytesAfter: string
  readonly counterfactualYear: YearResult | null
  readonly result: Readonly<CounterfactualAnnualLiabilityResult>
}

const controller = vi.hoisted(() => ({
  observations: [] as Observation[],
}))

vi.mock('../internal/counterfactualAnnualLiability.js', async (
  importOriginal,
) => {
  const original = await importOriginal<
    typeof import('../internal/counterfactualAnnualLiability.js')
  >()
  return {
    ...original,
    runCounterfactualAnnualLiability: (
      input: Parameters<typeof original.runCounterfactualAnnualLiability>[0],
    ) => {
      const stateBytesBefore = annualPassStateBytes(input.state)
      let counterfactualYear: YearResult | null = null
      const result = original.runCounterfactualAnnualLiability({
        ...input,
        runPass: (omittedRetirementActionIds) => {
          const passResult = input.runPass(omittedRetirementActionIds)
          counterfactualYear = passResult.yearResult as YearResult
          return passResult
        },
      })
      controller.observations.push({
        taxYear: input.request.taxYear,
        stateBytesBefore,
        stateBytesAfter: annualPassStateBytes(input.state),
        counterfactualYear,
        result,
      })
      return result
    },
  }
})

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  type ActionId,
} from '../actions/identity.js'
import { asPositiveUsdCents } from '../actions/money.js'
import type { AnnualLiabilityRunTaxInput } from '../actions/annualLiabilityRunIdentity.js'
import { parseRetirementActionRequest } from '../actions/index.js'
import type { Account, Plan } from '../model/plan.js'
import {
  recurringOrdinaryIncome,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan, type SimulateAnnualCounterfactualRequest } from './simulate.js'

const START_YEAR = 2026
const END_YEAR = 2029
const CONVERSION_YEAR = 2026
const CONVERSION_ACTION_ID = 'named-conversion'
const CONVERSION_DOLLARS = 40_000
const FLAT_RATE_PCT = 22
const TAX_UNIT_ID = 'counterfactual-tax-unit'

const NON_GROUP_INPUTS: readonly Readonly<AnnualLiabilityRunTaxInput>[] = [
  {
    inputId: 'federalFilingStatus',
    value: { representation: 'declaredTerm', term: 'single' },
  },
]

/**
 * The same serialization the checkpoint's own tests use, over the whole named
 * binding list rather than a chosen subset — a binding this omitted is a
 * binding whose restoration this file would not notice.
 */
function annualPassStateBytes(
  state: SimulatorAnnualPassStateBindings,
): string {
  return JSON.stringify({
    balances: state.balances.map(({ account, balance, costBasis }) =>
      ({ id: account.id, balance, costBasis })),
    retirementRuntimeOccurrences: state.retirementRuntimeOccurrences,
    retirementRuntimeApplications: state.retirementRuntimeApplications,
    nextRetirementRuntimeMutationOrdinal:
      state.nextRetirementRuntimeMutationOrdinal.read(),
    iraProRata: [...state.iraProRata],
    iraBasisByOwner: [...state.iraBasisByOwner],
    rothBasis: [...state.rothBasis],
    propertyValues: [...state.propertyValues],
    hecmStates: [...state.hecmStates],
    insuranceCashValues: [...state.insuranceCashValues],
    allocationTrack: [...state.allocationTrack],
    seppAmortAmount: [...state.seppAmortAmount],
    magiHistory: [...state.magiHistory],
    namedQcdOffsetConsumedByDonor: [...state.namedQcdOffsetConsumedByDonor],
    namedQcdOffsetHistoryUnprovable: [...state.namedQcdOffsetHistoryUnprovable],
    warnings: [...state.warnings],
    scalars: {
      unassignedCash: state.unassignedCash.read(),
      priorYearPortfolioReturnPct: state.priorYearPortfolioReturnPct.read(),
      capitalLossPool: state.capitalLossPool.read(),
      hsaReimbursablePool: state.hsaReimbursablePool.read(),
      depletionYear: state.depletionYear.read(),
      conversionNontaxable: state.conversionNontaxable.read(),
      healthcare: state.healthcare.read(),
      qualifiedMedicalThisYear: state.qualifiedMedicalThisYear.read(),
      hsaQualifiedCap: state.hsaQualifiedCap.read(),
      requiredSpendingBase: state.requiredSpendingBase.read(),
      targetSpendingBase: state.targetSpendingBase.read(),
    },
    expenses: state.expenses,
  })
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
    // Nondeductible basis is what makes the owned-IRA annual settlement run, so
    // the committed pass below really is the bounded attempt driver's, not the
    // legacy fallback's.
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

function conversionRequest() {
  const parsed = parseRetirementActionRequest({
    actionId: CONVERSION_ACTION_ID,
    kind: 'rothConversion',
    personId: 'p1',
    year: CONVERSION_YEAR,
    executionDate: '2026-06-15',
    executionSequence: 1,
    requestedAmount: CONVERSION_DOLLARS * 100,
    allocations: [{
      allocationId: 'named-conversion-allocation',
      sourceAccountId: 'ira-a',
      requestedAmount: CONVERSION_DOLLARS * 100,
    }],
    destinationRothAccountId: 'roth-a',
    taxFunding: { kind: 'noneExpected' },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

const FUNDING_WITHDRAWAL_ACTION_ID = 'funding-withdrawal'

/** The conversion, funded by a dedicated linked withdrawal that names it back. */
function linkedFundingRequests() {
  const withdrawal = parseRetirementActionRequest({
    actionId: FUNDING_WITHDRAWAL_ACTION_ID,
    kind: 'ordinaryWithdrawal',
    personId: 'p1',
    year: CONVERSION_YEAR,
    executionDate: '2026-06-14',
    executionSequence: 1,
    requestedAmount: 8_000_00,
    allocations: [{
      allocationId: 'funding-withdrawal-allocation',
      sourceAccountId: 'cash-a',
      requestedAmount: 8_000_00,
    }],
    purpose: { kind: 'taxPayment', referenceId: CONVERSION_ACTION_ID },
    provenance: { source: 'manual' },
  })
  if (!withdrawal.ok) throw new Error(withdrawal.issues.join('; '))
  const conversion = parseRetirementActionRequest({
    actionId: CONVERSION_ACTION_ID,
    kind: 'rothConversion',
    personId: 'p1',
    year: CONVERSION_YEAR,
    executionDate: '2026-06-15',
    executionSequence: 2,
    requestedAmount: CONVERSION_DOLLARS * 100,
    allocations: [{
      allocationId: 'named-conversion-allocation',
      sourceAccountId: 'ira-a',
      requestedAmount: CONVERSION_DOLLARS * 100,
    }],
    destinationRothAccountId: 'roth-a',
    taxFunding: {
      kind: 'linkedWithdrawal',
      withdrawalActionId: FUNDING_WITHDRAWAL_ACTION_ID,
    },
    provenance: { source: 'manual' },
  })
  if (!conversion.ok) throw new Error(conversion.issues.join('; '))
  // An unrelated withdrawal, so the ordinary executor is invoked even in the
  // run that omits both legs of the group. Without it the counterfactual would
  // hand the executor an empty request set, the executor would not run, and its
  // group-completeness check -- the thing that makes the substituted request
  // list necessary -- would never be reached.
  const unrelated = parseRetirementActionRequest({
    actionId: 'unrelated-withdrawal',
    kind: 'ordinaryWithdrawal',
    personId: 'p1',
    year: CONVERSION_YEAR,
    executionDate: '2026-03-01',
    executionSequence: 3,
    requestedAmount: 1_000_00,
    allocations: [{
      allocationId: 'unrelated-withdrawal-allocation',
      sourceAccountId: 'cash-a',
      requestedAmount: 1_000_00,
    }],
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  })
  if (!unrelated.ok) throw new Error(unrelated.issues.join('; '))
  return [withdrawal.request, conversion.request, unrelated.request]
}

function plan(options: { withConversion?: boolean } = {}): Plan {
  const base = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  base.id = 'counterfactual-annual-pass'
  base.accounts = [cash(), traditionalIra(), rothIra()]
  // Ordinary income every year, so `T0` is a real nonzero liability rather than
  // the zero a household with no income would owe either way. A counterfactual
  // that differed from the committed run only by "0 versus something" would
  // prove far less than one that differs by the conversion's own income.
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
  base.strategies.retirementActions = options.withConversion === false
    ? []
    : [conversionRequest()]
  return validatePlan(base)
}

function linkedFundingPlan(): Plan {
  const base = plan()
  base.strategies.retirementActions = linkedFundingRequests()
  return validatePlan(base)
}

const QCD_ACTION_ID = 'qcd-action'
const QCD_GIFT_DOLLARS = 5_000

/**
 * A donor past the applicable age with both QCD arms available: the aggregate
 * `strategies.qcdAnnual` gift, and a named QCD request that stands it down.
 *
 * The aggregate arm is suppressed for the whole year by the mere presence of a
 * named request, which is a derivation from the Plan's request list that sits
 * far above the year's own request filters — and so is the one a counterfactual
 * could most easily leave reading the wrong list.
 */
function donorPlan(): Plan {
  const base = singlePersonPlan({ dob: '1950-03-01', planningAge: 95 })
  base.id = 'counterfactual-qcd-suppression'
  const account = traditionalAccount('ira', 500_000, 'p1', 'ira')
  if (account.type !== 'traditional') throw new Error('expected an IRA')
  base.accounts = [{ ...account, annualReturnPct: 0 }]
  base.strategies.qcdAnnual = QCD_GIFT_DOLLARS
  base.strategies.retirementActions = [{
    actionId: asActionId(QCD_ACTION_ID),
    kind: 'qcd',
    year: CONVERSION_YEAR,
    executionDate: `${CONVERSION_YEAR}-11-14`,
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(QCD_GIFT_DOLLARS * 100),
    provenance: { source: 'manual' },
    donorPersonId: asPersonId('p1'),
    allocation: {
      allocationId: asAllocationId('qcd-allocation'),
      sourceAccountId: asAccountId('ira'),
      requestedAmount: asPositiveUsdCents(QCD_GIFT_DOLLARS * 100),
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
  }]
  return validatePlan(base)
}

function ordinaryDisposition(
  year: Readonly<YearResult> | null,
  actionId: string,
) {
  return year?.retirementActionExecution?.evidence
    ?.find((entry) => entry.actionId === actionId)?.disposition
}

function project(
  target: Plan,
  annualCounterfactual?: Readonly<SimulateAnnualCounterfactualRequest>,
): ProjectionResult {
  controller.observations.length = 0
  return simulatePlan(target, {
    startYear: START_YEAR,
    horizonEndYear: END_YEAR,
    taxCalculator: createFlatTaxCalculator(FLAT_RATE_PCT),
    ...(annualCounterfactual === undefined ? {} : { annualCounterfactual }),
  })
}

function counterfactualRequest(
  omitActionIds: readonly ActionId[],
  captured: CounterfactualAnnualLiabilityResult[],
): Readonly<SimulateAnnualCounterfactualRequest> {
  return {
    omitActionIds,
    taxUnitId: TAX_UNIT_ID,
    nonGroupTaxInputs: NON_GROUP_INPUTS,
    capture: (result) => {
      captured.push(result)
    },
  }
}

function reading(
  result: Readonly<CounterfactualAnnualLiabilityResult> | undefined,
): Readonly<CounterfactualAnnualLiabilityRead> {
  if (result?.status !== 'counterfactualAnnualLiabilityRead') {
    throw new Error(`expected a reading, got ${JSON.stringify(result)}`)
  }
  return result
}

/** Every occurrence key a year minted, in journal order. */
function occurrenceKeys(year: Readonly<YearResult>): string[] {
  return (year.retirementRuntimeSource?.runtimeOccurrences ?? [])
    .map((occurrence) => occurrence.producerOccurrenceKey)
}

/** Every application's mutation ordinal, in journal order. */
function mutationOrdinals(year: Readonly<YearResult>): number[] {
  return (year.retirementRuntimeApplicationSource?.applications ?? [])
    .map((application) => application.mutationOrdinal)
}

function liabilityPlanDollars(
  read: Readonly<CounterfactualAnnualLiabilityRead>,
): number {
  return read.liabilityComponents.taxPlanDollars +
    read.liabilityComponents.penaltiesPlanDollars
}

describe('counterfactual annual pass, against the real annual pass', () => {
  it('leaves the projection byte-identical when the omission set is empty', () => {
    const target = plan()
    const neverPrePassed = project(target)
    const captured: CounterfactualAnnualLiabilityResult[] = []
    const prePassed = project(target, counterfactualRequest([], captured))

    // The whole projection, not a chosen figure: every year, every balance,
    // every published record, both runtime journals.
    expect(JSON.stringify(prePassed)).toBe(JSON.stringify(neverPrePassed))
    // The pre-pass really ran -- one per projected year -- so the identity above
    // is not the identity of two runs that both skipped it.
    expect(captured).toHaveLength(END_YEAR - START_YEAR + 1)
    expect(captured.every((result) =>
      result.status === 'counterfactualAnnualLiabilityRead')).toBe(true)
  })

  it('leaves both runtime journals byte-identical, with no leaked pre-pass mint', () => {
    const target = plan()
    const neverPrePassed = project(target)
    const captured: CounterfactualAnnualLiabilityResult[] = []
    const prePassed = project(target, counterfactualRequest([], captured))

    prePassed.years.forEach((year, index) => {
      const control = neverPrePassed.years[index]!
      expect(JSON.stringify(year.retirementRuntimeSource))
        .toBe(JSON.stringify(control.retirementRuntimeSource))
      expect(JSON.stringify(year.retirementRuntimeApplicationSource))
        .toBe(JSON.stringify(control.retirementRuntimeApplicationSource))
      // Two minting passes are safe only because the rollback splices the
      // journals back rather than reassigning them. Duplicate keys and a broken
      // ordinal run are the two shapes a leak would take, and both are checked
      // directly rather than left to a downstream validator that answers a
      // leak by silently disqualifying the owner.
      const keys = occurrenceKeys(year)
      expect(new Set(keys).size).toBe(keys.length)
      const ordinals = mutationOrdinals(year)
      expect(ordinals).toEqual(
        Array.from({ length: ordinals.length }, (_, offset) => offset + 1),
      )
    })
    // The conversion year mints something, so the checks above are not vacuous.
    expect(occurrenceKeys(prePassed.years[0]!).length).toBeGreaterThan(0)
  })

  it('restores the whole checkpoint binding state after the pre-pass rolls back', () => {
    const captured: CounterfactualAnnualLiabilityResult[] = []
    project(plan(), counterfactualRequest([asActionId(CONVERSION_ACTION_ID)], captured))

    expect(controller.observations).toHaveLength(END_YEAR - START_YEAR + 1)
    for (const observation of controller.observations) {
      expect(observation.stateBytesAfter).toBe(observation.stateBytesBefore)
      expect(observation.result.status)
        .toBe('counterfactualAnnualLiabilityRead')
    }
    // A pre-pass that mutated nothing would satisfy the equality above
    // vacuously. The conversion year's counterfactual really did run a whole
    // annual pass, which is what makes the restoration worth asserting.
    const conversionYear = controller.observations[0]!.counterfactualYear
    expect(conversionYear?.year).toBe(CONVERSION_YEAR)
    expect(conversionYear?.tax).toBeGreaterThan(0)
  })

  it('removes the named conversion’s movement and income from the counterfactual run', () => {
    const captured: CounterfactualAnnualLiabilityResult[] = []
    const committed = project(
      plan(),
      counterfactualRequest([asActionId(CONVERSION_ACTION_ID)], captured),
    )
    const committedYear = committed.years[0]!
    const counterfactualYear = controller.observations[0]!.counterfactualYear

    // The committed run converted, and the counterfactual did not.
    expect(committedYear.rothConversion).toBeCloseTo(CONVERSION_DOLLARS, 6)
    expect(committedYear.balances['roth-a']).toBeCloseTo(CONVERSION_DOLLARS, 6)
    expect(counterfactualYear?.rothConversion).toBeCloseTo(0, 6)
    expect(counterfactualYear?.balances['roth-a']).toBeCloseTo(0, 6)
    expect(counterfactualYear?.balances['ira-a'])
      .toBeCloseTo(committedYear.balances['ira-a']! + CONVERSION_DOLLARS, 6)
    // The income went with the movement: no named conversion occurrence, and no
    // conversion evidence, in the run that omitted it.
    expect(counterfactualYear?.rothConversionActionExecution).toBeUndefined()
    expect(occurrenceKeys(committedYear).some((key) =>
      key.includes('namedRothConversion'))).toBe(true)
  })

  it('reads a T0 liability equal to the same year run without the conversion at all', () => {
    const captured: CounterfactualAnnualLiabilityResult[] = []
    const committed = project(
      plan(),
      counterfactualRequest([asActionId(CONVERSION_ACTION_ID)], captured),
    )
    const withoutTheRequest = project(plan({ withConversion: false }))

    const baseline = reading(captured[0])
    const committedYear = committed.years[0]!
    const controlYear = withoutTheRequest.years[0]!

    // T0 is the year's final post-pass tax-and-penalty total, so omitting the
    // request through the omission set has to land on exactly the figure a Plan
    // that never held the request produces.
    expect(liabilityPlanDollars(baseline))
      .toBeCloseTo(controlYear.tax + controlYear.penalties, 6)
    // And it is genuinely lower than the committed run's: the conversion is
    // ordinary income, and this is the difference the funding requirement is.
    expect(liabilityPlanDollars(baseline))
      .toBeLessThan(committedYear.tax + committedYear.penalties)
    expect(baseline.identity.liabilityRun.liabilityRunKind).toBe('baselineT0')
    expect(baseline.omittedActionIds).toEqual([CONVERSION_ACTION_ID])
  })

  it('leaves the committed run untouched by the omission the counterfactual made', () => {
    const target = plan()
    const neverPrePassed = project(target)
    const captured: CounterfactualAnnualLiabilityResult[] = []
    const withOmission = project(
      target,
      counterfactualRequest([asActionId(CONVERSION_ACTION_ID)], captured),
    )

    expect(JSON.stringify(withOmission)).toBe(JSON.stringify(neverPrePassed))
  })

  it('runs the counterfactual the contract asks for: a group and its funding withdrawal, omitted together', () => {
    // This is the case `T0` exists for, and the case an omission set confined
    // to the pass's own derivations could not run at all: the ordinary
    // executor re-derives the linked-withdrawal groups it can see from the Plan
    // it is handed, and throws when the verdict it was given omits one of them.
    const captured: CounterfactualAnnualLiabilityResult[] = []
    const committed = project(
      linkedFundingPlan(),
      counterfactualRequest(
        [asActionId(CONVERSION_ACTION_ID), asActionId(FUNDING_WITHDRAWAL_ACTION_ID)],
        captured,
      ),
    )
    const committedYear = committed.years[0]!
    const counterfactualYear = controller.observations[0]!.counterfactualYear

    // Both legs still refuse as a group, which is what makes the pair real.
    // The code they refuse under follows the run rather than the pair: this
    // projection's own group executor reads a baseline liability for the year,
    // so the refusal is on the merits and carries the refused-classified
    // `unallocated` rather than the unsupported-classified
    // `evidence-unsupported`. Nothing about the amounts moved.
    expect(ordinaryDisposition(committedYear, FUNDING_WITHDRAWAL_ACTION_ID))
      .toMatchObject({
        outcome: 'refused',
        executedAmount: 0,
        reasons: [{ code: 'conversion-tax-funding-unallocated' }],
      })

    // The counterfactual ran to completion rather than throwing inside the
    // executor, and neither leg is in it.
    const baseline = reading(captured[0])
    expect(baseline.omittedActionIds).toEqual(
      [CONVERSION_ACTION_ID, FUNDING_WITHDRAWAL_ACTION_ID].sort(),
    )
    expect(ordinaryDisposition(counterfactualYear, FUNDING_WITHDRAWAL_ACTION_ID))
      .toBeUndefined()
    expect(counterfactualYear?.rothConversion).toBeCloseTo(0, 6)
    // The executor really did run in the counterfactual, so the completeness
    // check really was reached and really was satisfied.
    expect(ordinaryDisposition(counterfactualYear, 'unrelated-withdrawal'))
      .toBeDefined()
    // And the run that commits is untouched.
    expect(JSON.stringify(committed))
      .toBe(JSON.stringify(project(linkedFundingPlan())))
  })

  it('carries no group verdict about a conversion the run does not contain', () => {
    // The group assessment reads the Plan's whole request list directly, not
    // just the year's, so it is the one derivation that could still answer for
    // a request this run removed. A verdict about an absent conversion is not a
    // verdict this run is entitled to hold.
    const captured: CounterfactualAnnualLiabilityResult[] = []
    project(
      linkedFundingPlan(),
      counterfactualRequest([asActionId(CONVERSION_ACTION_ID)], captured),
    )
    const counterfactualYear = controller.observations[0]!.counterfactualYear

    expect(reading(captured[0]).omittedActionIds).toEqual([CONVERSION_ACTION_ID])
    expect(ordinaryDisposition(counterfactualYear, FUNDING_WITHDRAWAL_ACTION_ID))
      .not.toMatchObject({
        reasons: [{ code: 'conversion-tax-funding-evidence-unsupported' }],
      })
  })

  it('restores the arm a removed request had been suppressing', () => {
    // Omitting a request has to remove everything that request decided, not
    // just its own movement. A named QCD stands the aggregate arm down for the
    // whole year, so a counterfactual that removed the named gift while leaving
    // the aggregate arm suppressed would report a household that gave nothing
    // at all -- a `T0` too high, from a year that never existed.
    const captured: CounterfactualAnnualLiabilityResult[] = []
    const committed = project(
      donorPlan(),
      counterfactualRequest([asActionId(QCD_ACTION_ID)], captured),
    )
    const counterfactualYear = controller.observations[0]!.counterfactualYear

    // Zero for a reason specific to this fixture, not because the named arm
    // cannot move: a committed named QCD has debited its source since PR #213,
    // and `donorPlan` carries no `retirementActionEligibilityFacts`, so this
    // request is refused. The suppression it triggers is unconditional, which
    // is the whole point — the year gives nothing at all.
    expect(committed.years[0]!.qcd).toBeCloseTo(0, 6)
    // The counterfactual, with no named request in it, gives the aggregate gift.
    expect(counterfactualYear?.qcd).toBeCloseTo(QCD_GIFT_DOLLARS, 6)
    expect(reading(captured[0]).identity.liabilityRun.liabilityRunKind)
      .toBe('baselineT0')
  })

  it('mints a different input snapshot than a counterfactual that removed nothing', () => {
    const emptyOmission: CounterfactualAnnualLiabilityResult[] = []
    project(plan(), counterfactualRequest([], emptyOmission))
    const namedOmission: CounterfactualAnnualLiabilityResult[] = []
    project(
      plan(),
      counterfactualRequest([asActionId(CONVERSION_ACTION_ID)], namedOmission),
    )

    expect(reading(namedOmission[0]).identity.taxInputSnapshotId)
      .not.toBe(reading(emptyOmission[0]).identity.taxInputSnapshotId)

    // And the ID is a function of the inputs, not of when the run happened: the
    // same omission over the same year mints the same snapshot again.
    const repeated: CounterfactualAnnualLiabilityResult[] = []
    project(
      plan(),
      counterfactualRequest([asActionId(CONVERSION_ACTION_ID)], repeated),
    )
    expect(reading(repeated[0]).identity.taxInputSnapshotId)
      .toBe(reading(namedOmission[0]).identity.taxInputSnapshotId)
  })
})
