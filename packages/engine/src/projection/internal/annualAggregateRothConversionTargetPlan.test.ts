import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Plan } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import {
  annualAggregateRothConversionTargetPlan,
  type AnnualAggregateRothConversionTargetPlanInput,
} from './annualAggregateRothConversionTargetPlan.js'

const { sizeRothConversionMock } = vi.hoisted(() => ({
  sizeRothConversionMock: vi.fn(),
}))

vi.mock('../../strategies/rothConversion.js', () => ({
  sizeRothConversion: sizeRothConversionMock,
}))

type Strategy = Plan['strategies']['rothConversion']
type AcaContract = NonNullable<
  Plan['expenses']['healthcare']['acaYears']
>[number]

const YEAR = 2026

function contract(): AcaContract {
  return {
    year: YEAR,
    fplRegion: 'contiguous',
    taxFamilyMembers: [
      {
        personId: 'p1',
        relationship: 'primary',
        requiredToFile: 'required',
        magi: 10,
      },
      {
        personId: 'dependent',
        relationship: 'dependent',
        requiredToFile: 'required',
        magi: 1_500,
      },
      {
        personId: 'non-filer',
        relationship: 'dependent',
        requiredToFile: 'notRequired',
        magi: 9_000,
      },
    ],
    coveredMembers: [],
    taxExemptInterest: { state: 'known', amount: 3_000 },
    foreignExclusionAddback: { state: 'known', amount: 700 },
    assertions: {
      coverageEligibility: 'supported',
      form8814: 'notApplicable',
      specialAllocation: 'notApplicable',
      marriedFilingSeparatelyException: 'notApplicable',
      selfEmployedHealthInsuranceDeduction: 'notApplicable',
      otherMaterialFacts: 'none',
    },
  }
}

function baseInput(
  strategy: Strategy,
  overrides: Partial<AnnualAggregateRothConversionTargetPlanInput> = {},
): AnnualAggregateRothConversionTargetPlanInput {
  return {
    strategy,
    namedConversionActionCount: 0,
    anyAlive: true,
    year: YEAR,
    readSources: vi.fn(() => [{
      balancePlanDollars: 100,
      convertible: true,
      taxableFraction: 1,
    }]),
    sizing: {
      pack: packForYear(YEAR).pack,
      filingStatus: 'single',
      ordinaryIncomeBase: 30_000,
      capitalGains: 2_000,
      qualifiedDividends: 300,
      ssBenefits: 4_000,
      peopleAged65Plus: 0,
      householdSize: 1,
      taxExemptInterest: 600,
      inflationScale: 1,
      itemizedDeductions: undefined,
      aca: {
        active: false,
        contract: undefined,
        initialSupportCodeCount: 0,
        generatedTaxExemptInterest: 0,
        planDerivedTaxExemptInterest: false,
        fallbackTaxFamilySize: 1,
      },
    },
    safetyNet: {
      floorTodayPlanDollars: 0,
      inflationFactor: 1,
      readSpendableLiquidBalances: vi.fn(() => []),
      preConversionInflows: 0,
      totalExpenses: 0,
      contributions: 0,
      computeTaxForTaxableConversion: vi.fn(() => 0),
    },
    ...overrides,
  }
}

describe('annualAggregateRothConversionTargetPlan', () => {
  beforeEach(() => {
    sizeRothConversionMock.mockReset()
  })

  it('suppresses aggregate targeting when a named conversion owns the year', () => {
    const readSources = vi.fn(() => {
      throw new Error('suppressed target must not read conversion sources')
    })
    const input = baseInput({
      mode: 'fillToTarget',
      target: 'topOfBracket',
      targetValue: 24,
      startYear: YEAR,
      endYear: YEAR,
    }, {
      namedConversionActionCount: 1,
      readSources,
    })

    const result = annualAggregateRothConversionTargetPlan(input)

    expect(result.desiredPlanDollars).toBe(0)
    expect(result.fillToTargetSelected).toBe(false)
    expect(result.warnings).toStrictEqual([])
    expect(sizeRothConversionMock).not.toHaveBeenCalled()
    expect(readSources).not.toHaveBeenCalled()
  })

  it('preserves manual conversion fold order without reading sizing callbacks', () => {
    const input = baseInput({
      mode: 'manual',
      conversions: [
        { year: YEAR, amount: 0.1 },
        { year: YEAR + 1, amount: 99 },
        { year: YEAR, amount: 0.2 },
      ],
    })

    const result = annualAggregateRothConversionTargetPlan(input)

    expect(result.desiredPlanDollars).toBe(0.30000000000000004)
    expect(result.warnings).toStrictEqual([])
    expect(input.readSources).not.toHaveBeenCalled()
    expect(input.safetyNet.computeTaxForTaxableConversion).not.toHaveBeenCalled()
  })

  it('keeps none, no-survivor, and out-of-window decisions lazy and fail-closed', () => {
    const fillStrategy: Strategy = {
      mode: 'fillToTarget',
      target: 'fixedMagi',
      targetValue: 100_000,
      startYear: YEAR,
      endYear: YEAR,
    }
    const readSources = vi.fn(() => {
      throw new Error('inactive target must not read conversion sources')
    })
    const inactiveAca = {
      active: true,
      contract: undefined,
      initialSupportCodeCount: 0,
      generatedTaxExemptInterest: 0,
      planDerivedTaxExemptInterest: false,
      fallbackTaxFamilySize: 2,
    } as const
    const inputs = [
      baseInput({ mode: 'none' }, {
        readSources,
        sizing: { ...baseInput({ mode: 'none' }).sizing, aca: inactiveAca },
      }),
      baseInput(fillStrategy, { anyAlive: false, readSources }),
      baseInput({ ...fillStrategy, startYear: YEAR + 1, endYear: YEAR + 2 }, {
        readSources,
      }),
    ]

    expect(inputs.map((input) =>
      annualAggregateRothConversionTargetPlan(input).desiredPlanDollars,
    )).toStrictEqual([0, 0, 0])
    expect(
      annualAggregateRothConversionTargetPlan(inputs[0]!).acaSizingInput,
    ).toStrictEqual({
      actionable: false,
      taxFamilySize: 2,
      fplRegion: 'contiguous',
      fixedMagiAddbacks: 0,
      taxExemptInterest: 0,
      foreignExclusionAddback: 0,
    })
    expect(sizeRothConversionMock).not.toHaveBeenCalled()
    expect(readSources).not.toHaveBeenCalled()
  })

  it('adapts unknown ACA attestations without inventing income', () => {
    sizeRothConversionMock.mockReturnValue({ ok: true, amount: 0 })
    const unknownContract = contract()
    unknownContract.taxExemptInterest = { state: 'unknown', amount: null }
    unknownContract.foreignExclusionAddback = { state: 'unknown', amount: null }
    const input = baseInput({
      mode: 'fillToTarget',
      target: 'acaCliff',
      targetValue: null,
      startYear: YEAR,
      endYear: YEAR,
    }, {
      sizing: {
        ...baseInput({ mode: 'none' }).sizing,
        aca: {
          active: true,
          contract: unknownContract,
          initialSupportCodeCount: 1,
          generatedTaxExemptInterest: 2_000,
          planDerivedTaxExemptInterest: true,
          fallbackTaxFamilySize: 1,
        },
      },
    })

    annualAggregateRothConversionTargetPlan(input)

    expect(sizeRothConversionMock).toHaveBeenCalledWith(
      input.strategy,
      expect.objectContaining({
        aca: {
          actionable: false,
          taxFamilySize: 3,
          fplRegion: 'contiguous',
          fixedMagiAddbacks: 1_500,
          taxExemptInterest: 2_000,
          foreignExclusionAddback: 0,
        },
      }),
    )
  })

  it('exposes a lazy then-current gross-to-taxable translator', () => {
    let taxableFraction = 0.25
    const readSources = vi.fn(() => [{
      balancePlanDollars: 100,
      convertible: true,
      taxableFraction,
    }])
    const result = annualAggregateRothConversionTargetPlan(
      baseInput({ mode: 'none' }, { readSources }),
    )

    expect(readSources).not.toHaveBeenCalled()
    expect(result.taxableAmountForGross(40)).toBe(10)
    taxableFraction = 0.5
    expect(result.taxableAmountForGross(40)).toBe(20)
    expect(readSources).toHaveBeenCalledTimes(2)
  })

  it('grosses a taxable target through ordered zero-, partial-, and fully-taxable sources', () => {
    sizeRothConversionMock.mockReturnValue({ ok: true, amount: 80 })
    const input = baseInput({
      mode: 'fillToTarget',
      target: 'acaCliff',
      targetValue: null,
      startYear: YEAR,
      endYear: YEAR,
    }, {
      readSources: vi.fn(() => [
        { balancePlanDollars: 20, convertible: true, taxableFraction: 0 },
        { balancePlanDollars: 100, convertible: true, taxableFraction: 0.5 },
        { balancePlanDollars: 100, convertible: true, taxableFraction: 1 },
      ]),
      sizing: {
        ...baseInput({ mode: 'none' }).sizing,
        aca: {
          active: true,
          contract: contract(),
          initialSupportCodeCount: 0,
          generatedTaxExemptInterest: 2_000,
          planDerivedTaxExemptInterest: true,
          fallbackTaxFamilySize: 3,
        },
      },
    })

    const result = annualAggregateRothConversionTargetPlan(input)

    expect(result.desiredPlanDollars).toBe(150)
    expect(result.fillToTargetSelected).toBe(true)
    expect(sizeRothConversionMock).toHaveBeenCalledWith(
      input.strategy,
      expect.objectContaining({
        aca: {
          actionable: true,
          taxFamilySize: 3,
          fplRegion: 'contiguous',
          fixedMagiAddbacks: 2_200,
          taxExemptInterest: 3_000,
          foreignExclusionAddback: 700,
        },
      }),
    )
  })

  it('preserves the above-capacity gross signal for the execution warning path', () => {
    sizeRothConversionMock.mockReturnValue({ ok: true, amount: 200 })
    const input = baseInput({
      mode: 'fillToTarget',
      target: 'fixedMagi',
      targetValue: 100_000,
      startYear: YEAR,
      endYear: YEAR,
    })

    expect(
      annualAggregateRothConversionTargetPlan(input).desiredPlanDollars,
    ).toBe(200)
  })

  it('trims only a generated target against ordered liquid headroom', () => {
    sizeRothConversionMock.mockReturnValue({ ok: true, amount: 100 })
    const readLiquid = vi.fn(() => [20, 130])
    const computeTax = vi.fn((taxable: number) => taxable)
    const input = baseInput({
      mode: 'fillToTarget',
      target: 'fixedMagi',
      targetValue: 100_000,
      startYear: YEAR,
      endYear: YEAR,
    }, {
      safetyNet: {
        floorTodayPlanDollars: 100,
        inflationFactor: 1,
        readSpendableLiquidBalances: readLiquid,
        preConversionInflows: 0,
        totalExpenses: 0,
        contributions: 0,
        computeTaxForTaxableConversion: computeTax,
      },
    })

    const result = annualAggregateRothConversionTargetPlan(input)

    expect(result.desiredPlanDollars).toBe(50)
    expect(result.warnings).toStrictEqual([
      'Roth conversions were trimmed so their tax bill stays payable without breaching the taxable safety-net floor.',
    ])
    expect(readLiquid).toHaveBeenCalledTimes(1)
    expect(computeTax.mock.calls.map(([taxable]) => taxable)).toStrictEqual([
      0,
      100,
      50,
    ])
  })

  it('bounds safety-net refinement to three passes and can trim to zero', () => {
    sizeRothConversionMock.mockReturnValue({ ok: true, amount: 100 })
    const strategy: Strategy = {
      mode: 'fillToTarget',
      target: 'fixedMagi',
      targetValue: 100_000,
      startYear: YEAR,
      endYear: YEAR,
    }
    const threePassTax = vi.fn((taxable: number) =>
      taxable === 0 ? 0 : 50 + taxable * 1.5)
    const threePass = annualAggregateRothConversionTargetPlan(
      baseInput(strategy, {
        safetyNet: {
          floorTodayPlanDollars: 100,
          inflationFactor: 1,
          readSpendableLiquidBalances: vi.fn(() => [150]),
          preConversionInflows: 0,
          totalExpenses: 0,
          contributions: 0,
          computeTaxForTaxableConversion: threePassTax,
        },
      }),
    )

    expect(threePass.desiredPlanDollars).toBeCloseTo(10)
    expect(threePassTax).toHaveBeenCalledTimes(4)
    expect(threePass.warnings).toHaveLength(1)

    const trimToZeroTax = vi.fn((taxable: number) => taxable)
    const zero = annualAggregateRothConversionTargetPlan(
      baseInput(strategy, {
        safetyNet: {
          floorTodayPlanDollars: 100,
          inflationFactor: 1,
          readSpendableLiquidBalances: vi.fn(() => [100]),
          preConversionInflows: 0,
          totalExpenses: 0,
          contributions: 0,
          computeTaxForTaxableConversion: trimToZeroTax,
        },
      }),
    )

    expect(zero.desiredPlanDollars).toBe(0)
    expect(trimToZeroTax.mock.calls.map(([taxable]) => taxable)).toStrictEqual([
      0,
      100,
    ])
    expect(zero.warnings).toHaveLength(1)
  })

  it('keeps invalid and non-actionable targets fail-closed with distinct warnings', () => {
    const strategy: Strategy = {
      mode: 'fillToTarget',
      target: 'acaCliff',
      targetValue: null,
      startYear: YEAR,
      endYear: YEAR,
    }
    const input = baseInput(strategy)

    sizeRothConversionMock.mockReturnValueOnce({
      ok: false,
      reason: 'bad_target',
    })
    expect(annualAggregateRothConversionTargetPlan(input)).toEqual(
      expect.objectContaining({
        desiredPlanDollars: 0,
        warnings: [
          'The Roth-conversion target is invalid for this plan (unknown bracket or tier); no conversion made.',
        ],
      }),
    )

    sizeRothConversionMock.mockReturnValueOnce({
      ok: false,
      reason: 'aca_nonactionable',
    })
    expect(annualAggregateRothConversionTargetPlan(input)).toEqual(
      expect.objectContaining({
        desiredPlanDollars: 0,
        warnings: [
          'The ACA-cliff Roth-conversion target was skipped because current-year ACA evidence is non-actionable.',
        ],
      }),
    )
  })
})
