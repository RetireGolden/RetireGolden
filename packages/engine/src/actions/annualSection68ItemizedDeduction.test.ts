import { describe, expect, it } from 'vitest'
import { describeRule } from '../rules/describeRule.js'
import {
  buildAnnualSection68ItemizedDeductionEvidence,
  type BuildAnnualSection68ItemizedDeductionEvidenceInput,
} from './annualSection68ItemizedDeduction.js'

const base = (overrides: Partial<BuildAnnualSection68ItemizedDeductionEvidenceInput> = {}) => ({
  taxUnitId: 'tax-unit-1',
  taxYear: 2026,
  annualTaxLiabilityEvidenceId: 'liability-1',
  taxInputSnapshotId: 'tax-input-1',
  liabilityRun: {
    liabilityRunKind: 'committedAnnual' as const,
    candidateFundingVectorEvidenceId: null,
  },
  filingStatus: 'single' as const,
  adjustedGrossIncomeBeforeItemizedDeductionCents: 67_760_000,
  qualifiedBusinessIncomeDeductionCents: 0,
  qualifiedBusinessIncomeComputedWithoutSection68: true as const,
  additionalSchedule1ADeductionCents: 0,
  nonActionItemizedDeductionCents: 10_000_000,
  actions: [],
  ...overrides,
}) satisfies BuildAnnualSection68ItemizedDeductionEvidenceInput

function built(input = base()) {
  const result = buildAnnualSection68ItemizedDeductionEvidence(input)
  expect(result.status).toBe('built')
  if (result.status !== 'built') throw new Error('expected built evidence')
  return result.evidence
}

describe('buildAnnualSection68ItemizedDeductionEvidence', () => {
  // Publication 505 states the rate as 5.4%, a truncation of 2/37. Over this
  // fixture's 3,700,000c limitation base the exact rational gives 200,000c and
  // the truncation gives 199,800c - a $2 gap on one taxpayer, and the provision
  // only bites at incomes where that scales.
  describeRule('irc-68-overall-itemized-limitation', {
    readings: { exactTwoThirtySevenths: 200_000, publication505Truncation: 199_800 },
    accepted: 'exactTwoThirtySevenths',
  }, ({ accepted, readings }) => {
    it('reduces by the exact rational rather than the published 5.4 percent', () => {
      const evidence = built()
      expect(evidence.finalState.overallLimitationCents).toBe(accepted)
      expect(evidence.finalState.overallLimitationCents)
        .not.toBe(readings.publication505Truncation)
      expect(evidence).toMatchObject({
        limitationRateNumerator: 2, limitationRateDenominator: 37,
        intermediateArithmetic: 'bigintRational',
      })
    })
  })

  it('applies the exact 2/37 limitation once over the smaller statutory base', () => {
    const evidence = built()

    expect(evidence).toMatchObject({
      taxYear: 2026,
      thresholdAmount: 640_600,
      thresholdCents: 64_060_000,
      taxableIncomeForOverallLimitationCents: 67_760_000,
      thresholdExcessCents: 3_700_000,
      limitationRateNumerator: 2,
      limitationRateDenominator: 37,
      intermediateArithmetic: 'bigintRational',
      limitationQuantization: 'nearestCentHalfUp',
    })
    expect(evidence.finalState).toMatchObject({
      limitationBaseCents: 3_700_000,
      limitationFloorQuotientCents: 200_000,
      limitationRemainderNumerator: 0,
      limitationRoundedUpOneCent: false,
      overallLimitationCents: 200_000,
      allowedItemizedDeductionCents: 9_800_000,
    })
  })

  it.each([
    ['single', 64_060_000],
    ['headOfHousehold', 64_060_000],
    ['marriedFilingJointly', 76_870_000],
    ['marriedFilingSeparately', 38_435_000],
    ['qualifyingSurvivingSpouse', 76_870_000],
  ] as const)('binds the sourced 2026 threshold for %s', (filingStatus, thresholdCents) => {
    for (const delta of [-1, 0, 1]) {
      const evidence = built(base({
        filingStatus,
        adjustedGrossIncomeBeforeItemizedDeductionCents: thresholdCents + delta,
      }))
      expect(evidence.thresholdCents).toBe(thresholdCents)
      expect(evidence.thresholdExcessCents).toBe(Math.max(0, delta))
      expect(evidence.thresholdSourceId).toMatch(/^annual-section68-threshold-source:/)
    }
  })

  it('uses exact bigint remainder comparison at the half-up boundary', () => {
    const below = built(base({
      adjustedGrossIncomeBeforeItemizedDeductionCents: 64_060_009,
      nonActionItemizedDeductionCents: 9,
    })).finalState
    const above = built(base({
      adjustedGrossIncomeBeforeItemizedDeductionCents: 64_060_010,
      nonActionItemizedDeductionCents: 10,
    })).finalState

    expect(below).toMatchObject({
      limitationRemainderNumerator: 18,
      limitationRoundedUpOneCent: false,
      overallLimitationCents: 0,
    })
    expect(above).toMatchObject({
      limitationRemainderNumerator: 20,
      limitationRoundedUpOneCent: true,
      overallLimitationCents: 1,
    })
  })

  it('clamps AGI after subtracting QBI and Schedule 1-A deductions', () => {
    const evidence = built(base({
      adjustedGrossIncomeBeforeItemizedDeductionCents: 65_060_000,
      qualifiedBusinessIncomeDeductionCents: 600_000,
      additionalSchedule1ADeductionCents: 400_000,
    }))

    expect(evidence.taxableIncomeForOverallLimitationCents).toBe(64_060_000)
    expect(evidence.thresholdExcessCents).toBe(0)
    expect(evidence.finalState.allowedItemizedDeductionCents).toBe(10_000_000)
    expect(built(base({ adjustedGrossIncomeBeforeItemizedDeductionCents: -1 })).taxableIncomeForOverallLimitationCents).toBe(0)
  })

  it('builds a canonical contiguous action-delta chain without mutating input', () => {
    const actions = [
      { actionKind: 'qcd' as const, actionId: 'later', scheduledDate: '2026-12-31',
        scheduledSequence: 2, itemizedDeductionIncreaseCents: 200 },
      { actionKind: 'qcd' as const, actionId: 'earlier', scheduledDate: '2026-01-02',
        scheduledSequence: 1, itemizedDeductionIncreaseCents: 100 },
    ]
    const evidence = built(base({
      actions, nonActionItemizedDeductionCents: 100,
      adjustedGrossIncomeBeforeItemizedDeductionCents: 64_060_150,
    }))
    const [first, second] = evidence.orderedActionAttributions

    expect(actions.map(({ actionId }) => actionId)).toEqual(['later', 'earlier'])
    expect(evidence.orderedActionAttributions.map(({ actionId }) => actionId))
      .toEqual(['earlier', 'later'])
    expect(first?.beforeAction).toBe(evidence.initialState)
    expect(second?.beforeAction).toBe(first?.afterAction)
    expect(second?.afterAction).toBe(evidence.finalState)
    expect(first?.beforeAction.limitationBaseCents).toBe(100)
    expect(first?.afterAction.limitationBaseCents).toBe(150)
    expect(evidence.orderedActionAttributions.reduce(
      (sum, action) => sum + action.allowedItemizedDeductionDeltaCents, 0,
    )).toBe(evidence.finalState.allowedItemizedDeductionCents -
      evidence.initialState.allowedItemizedDeductionCents)
    expect(Object.isFrozen(evidence)).toBe(true)
    expect(Object.isFrozen(evidence.orderedActionAttributions)).toBe(true)
    expect(Object.isFrozen(first?.beforeAction)).toBe(true)
  })

  it('makes empty-ledger endpoints identical and identities run-specific', () => {
    const committed = built()
    const t0 = built(base({ liabilityRun: {
      liabilityRunKind: 'baselineT0', candidateFundingVectorEvidenceId: null,
    } }))
    const t1 = built(base({ liabilityRun: {
      liabilityRunKind: 'candidateT1', candidateFundingVectorEvidenceId: 'funding-vector-1',
    } }))
    const reorderedT1 = built(base({ liabilityRun: {
      candidateFundingVectorEvidenceId: 'funding-vector-1', liabilityRunKind: 'candidateT1',
    } }))

    expect(committed.finalState).toBe(committed.initialState)
    expect(new Set([committed.section68EvidenceId, t0.section68EvidenceId, t1.section68EvidenceId]))
      .toHaveLength(3)
    expect(t1).toMatchObject({
      liabilityRunKind: 'candidateT1', candidateFundingVectorEvidenceId: 'funding-vector-1',
    })
    expect(reorderedT1.section68EvidenceId).toBe(t1.section68EvidenceId)
    expect(built(base({ taxInputSnapshotId: 'tax-input-2' })).section68EvidenceId)
      .not.toBe(committed.section68EvidenceId)
    expect(built(base({ annualTaxLiabilityEvidenceId: 'liability-2' })).section68EvidenceId)
      .not.toBe(committed.section68EvidenceId)
  })

  it('fails closed on hostile objects before reading reusable evidence', () => {
    const result = buildAnnualSection68ItemizedDeductionEvidence(
      new Proxy(base(), {}) as BuildAnnualSection68ItemizedDeductionEvidenceInput,
    )
    expect(result).toMatchObject({ status: 'blocked', issues: [{ kind: 'invalidInput' }] })
  })

  it.each([
    ['unsupportedTaxYear', base({ taxYear: 2027 })],
    ['invalidInput', base({ taxUnitId: ' ' })],
    ['invalidInput', base({ adjustedGrossIncomeBeforeItemizedDeductionCents: 0.5 })],
    ['invalidInput', base({ liabilityRun: {
      liabilityRunKind: 'candidateT1', candidateFundingVectorEvidenceId: '',
    } })],
    ['invalidInput', base({ actions: [{ actionKind: 'qcd', actionId: 'zero-sequence',
      scheduledDate: '2026-01-01', scheduledSequence: 0, itemizedDeductionIncreaseCents: 1 }] })],
    ['duplicateActionId', base({ actions: [
      { actionKind: 'qcd', actionId: 'same', scheduledDate: '2026-01-01',
        scheduledSequence: 1, itemizedDeductionIncreaseCents: 1 },
      { actionKind: 'qcd', actionId: 'same', scheduledDate: '2026-02-01',
        scheduledSequence: 2, itemizedDeductionIncreaseCents: 1 },
    ] })],
    ['duplicateSchedulePosition', base({ actions: [
      { actionKind: 'qcd', actionId: 'one', scheduledDate: '2026-01-01',
        scheduledSequence: 1, itemizedDeductionIncreaseCents: 1 },
      { actionKind: 'qcd', actionId: 'two', scheduledDate: '2026-01-01',
        scheduledSequence: 1, itemizedDeductionIncreaseCents: 1 },
    ] })],
    ['arithmeticOverflow', base({
      nonActionItemizedDeductionCents: Number.MAX_SAFE_INTEGER,
      actions: [{ actionKind: 'qcd', actionId: 'overflow', scheduledDate: '2026-01-01',
        scheduledSequence: 1, itemizedDeductionIncreaseCents: 1 }],
    })],
  ] as const)('fails closed with typed issue %s', (kind, input) => {
    const result = buildAnnualSection68ItemizedDeductionEvidence(input)

    expect(result).toMatchObject({ status: 'blocked', issues: [{ kind }] })
    expect(Object.isFrozen(result)).toBe(true)
    if (result.status === 'blocked') expect(Object.isFrozen(result.issues)).toBe(true)
  })
})
